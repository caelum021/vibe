import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { getVersion } from '@tauri-apps/api/app'
import * as api from './api'
import FileExplorer from './components/FileExplorer'
import FileViewer from './components/FileViewer'
import ProjectDashboard from './components/Dashboard'
import NoRootScreen, { ProjectDropdown } from './components/NoRootScreen'
import {
  resolveKey, formatReadError, FONT_MONO, FONT_SERIF, FONT_UI,
  DOC_EXTENSIONS, DOC_FOLDERS, EXT_TO_LANG, LANG_COLORS,
  RECENT_CHANGES_LIMIT, isHiddenFile, basenameOf, makeRecentEntry,
  loadProjects, addProject,
  SHORTCUTS_VIEWER_VIEW, SHORTCUTS_VIEWER_VIEW_DIRTY, SHORTCUTS_VIEWER_DIFF,
  SHORTCUTS_VIEWER_EDIT, SHORTCUTS_VIEWER_EDIT_MD, SHORTCUTS_EXPLORER,
} from './constants'

// ── Doc description extraction ───────────────────────────────────────────────
function stripMd(text) {
  return text
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')        // images
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')     // [text](url)
    .replace(/\*\*([^*]+)\*\*/g, '$1')           // bold
    .replace(/\*([^*]+)\*/g, '$1')               // italic
    .replace(/`([^`]+)`/g, '$1')                 // inline code
    .replace(/^>\s*/, '')                         // blockquote prefix
    .replace(/^[-*+]\s+/, '')                    // list prefix
    .trim()
}

function extractDesc(content) {
  const lines = content.split('\n')
  let i = 0
  // Skip frontmatter block
  if (lines[0]?.trim() === '---') {
    i = 1
    while (i < lines.length && lines[i]?.trim() !== '---') i++
    i++
  }
  let afterH1 = false
  let fallback = ''
  for (; i < lines.length; i++) {
    const t = lines[i].trim()
    if (!t || t.startsWith('<!--')) continue
    if (t.startsWith('# ')) { afterH1 = true; continue }
    if (t.startsWith('#')) continue
    if (afterH1) return stripMd(t)
    if (!fallback) fallback = t
  }
  return stripMd(fallback)
}

// ── About modal ───────────────────────────────────────────────────────────────
function AboutModal({ onClose }) {
  const [version, setVersion] = useState('')
  useEffect(() => { getVersion().then(setVersion) }, [])
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
      <div onClick={e => e.stopPropagation()} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'12px', padding:'36px 40px', width:'320px', display:'flex', flexDirection:'column', gap:'16px', boxShadow:'0 16px 48px rgba(0,0,0,0.2)' }}>
        <div>
          <div style={{ fontFamily:FONT_SERIF, fontStyle:'italic', fontSize:'28px', fontWeight:400, color:'var(--text)', lineHeight:1.1 }}>vibe</div>
          <div style={{ fontFamily:FONT_MONO, fontSize:'11px', color:'var(--muted)', marginTop:'4px' }}>{version ? `v${version}` : ''}</div>
        </div>
        <div style={{ fontSize:'13px', color:'var(--muted)', lineHeight:1.6 }}>
          코드베이스를 위한 옵시디언.<br />
          AI CLI와 함께 쓰는 문서 편집기.
        </div>
        <div style={{ height:'1px', background:'var(--border)' }} />
        <div style={{ fontSize:'11px', color:'var(--muted)', lineHeight:2 }}>
          <div style={{ fontWeight:500, marginBottom:'4px', textTransform:'uppercase', letterSpacing:'0.08em', fontSize:'10px' }}>Git badges</div>
          <div style={{ display:'flex', flexDirection:'column', gap:'2px' }}>
            {[['var(--success)','added'],['#4DA8A4','untracked'],['var(--warning)','modified'],['var(--error)','deleted'],['#7B9FD4','renamed']].map(([color, label]) => (
              <div key={label} style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                <span style={{ fontFamily:FONT_MONO, fontSize:'12px', color, flexShrink:0 }}>●</span>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ height:'1px', background:'var(--border)' }} />
        <div style={{ fontFamily:FONT_MONO, fontSize:'11px', color:'var(--muted)', lineHeight:1.8 }}>
          Tauri v2 · Rust · React + Vite
        </div>
        <a href="https://github.com/solpop-arch/vibe" target="_blank" rel="noreferrer"
          style={{ fontFamily:FONT_MONO, fontSize:'11px', color:'var(--accent)', textDecoration:'none' }}>
          github.com/solpop-arch/vibe ↗
        </a>
        <button onClick={onClose}
          onMouseEnter={e => { e.currentTarget.style.background='var(--surface-2)' }}
          onMouseLeave={e => { e.currentTarget.style.background='none' }}
          style={{ background:'none', border:'1px solid var(--border)', color:'var(--muted)', borderRadius:'6px', padding:'6px', fontSize:'12px', cursor:'pointer', transition:'background 150ms', marginTop:'4px' }}>
          Close
        </button>
      </div>
    </div>
  )
}

// ── App ───────────────────────────────────────────────────────────────────────
function App() {
  const explorerRef = useRef(null)
  const viewerRef   = useRef(null)

  const selectedFileRef    = useRef(null)
  const isEditingRef       = useRef(false)
  const editContentRef     = useRef('')
  const fileContentRef     = useRef('')
  const rootPathRef        = useRef('')
  const requireCleanRef    = useRef(null)
  const handleEscapeKeyRef = useRef(null)
  const handleViewerKeyRef = useRef(null)
  const openSearchRef      = useRef(null)
  const closeSearchRef     = useRef(null)
  const externallyChangedRef = useRef(false)
  const activeFocusRef     = useRef('explorer')

  const [rootReady, setRootReady]               = useState(false)
  const [selectedFile, setSelectedFile]         = useState(null)
  const [fileContent, setFileContent]           = useState('')
  const [isEditing, setIsEditing]               = useState(false)
  const [diffMode, setDiffMode]                 = useState(false)
  const [externallyChanged, setExternallyChanged] = useState(false)
  const [editContent, setEditContent]           = useState('')
  const [pendingAction, setPendingAction]       = useState(null)
  const [activeFocus, setActiveFocus]           = useState('explorer')
  const [sidebarVisible, setSidebarVisible]     = useState(true)
  const [explorerAtRoot, setExplorerAtRoot]     = useState(true)
  const [refreshKey, setRefreshKey]             = useState(0)
  const [theme, setTheme]                       = useState(() => localStorage.getItem('vibe-theme') || 'light')
  const [aboutOpen, setAboutOpen]               = useState(false)
  const [rootPath, setRootPath]                 = useState('')
  const [changedFiles, setChangedFiles]         = useState(new Set())
  const [recentChanges, setRecentChanges]       = useState([])
  const [dashboardData, setDashboardData]       = useState(null)
  const [projects, setProjects]                 = useState(() => loadProjects())
  const [gitInfo, setGitInfo]                   = useState({ isRepo: false, branch: null, filesByAbs: new Map(), dirtyCount: 0 })
  const [refreshing, setRefreshing]             = useState(false)
  const [justRefreshed, setJustRefreshed]       = useState(false)
  const gitRefetchTimerRef                      = useRef(null)
  const dashboardRefetchTimerRef                = useRef(null)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme === 'dark' ? 'dark' : '')
    localStorage.setItem('vibe-theme', theme)
  }, [theme])

  const isDark = theme === 'dark'

  selectedFileRef.current     = selectedFile
  isEditingRef.current        = isEditing
  editContentRef.current      = editContent
  fileContentRef.current      = fileContent
  rootPathRef.current         = rootPath
  externallyChangedRef.current = externallyChanged
  activeFocusRef.current       = activeFocus

  const isDirty = isEditing && editContent !== fileContent

  useEffect(() => {
    if (!selectedFile || selectedFile.isDirectory) { setFileContent(''); return }
    setIsEditing(false); setEditContent(''); setDiffMode(false)
    api.readFile(selectedFile.path)
      .then(d => setFileContent(d.content || ''))
      .catch(err => setFileContent(formatReadError(err)))
  }, [selectedFile])

  const loadGitStatus = useCallback(async (rootAbs) => {
    try {
      const s = await api.gitStatus()
      setGitInfo(prev => {
        if (!s.isRepo) {
          if (!prev.isRepo) return prev
          return { isRepo: false, branch: null, filesByAbs: new Map(), dirtyCount: 0 }
        }
        const base = rootAbs || ''
        const filesByAbs = new Map()
        Object.entries(s.files || {}).forEach(([rel, state]) => {
          filesByAbs.set(base + '/' + rel, state)
        })
        // Short-circuit when nothing materially changed — avoids cascading re-renders
        if (
          prev.isRepo &&
          prev.branch === s.branch &&
          prev.filesByAbs.size === filesByAbs.size
        ) {
          let same = true
          for (const [k, v] of filesByAbs) {
            if (prev.filesByAbs.get(k) !== v) { same = false; break }
          }
          if (same) return prev
        }
        return { isRepo: true, branch: s.branch, filesByAbs, dirtyCount: filesByAbs.size }
      })
    } catch (e) { console.error('git_status failed:', e) }
  }, [])

  const scheduleGitRefetch = useCallback((rootAbs) => {
    if (gitRefetchTimerRef.current) clearTimeout(gitRefetchTimerRef.current)
    gitRefetchTimerRef.current = setTimeout(() => loadGitStatus(rootAbs), 200)
  }, [loadGitStatus])

  useEffect(() => () => {
    if (gitRefetchTimerRef.current) clearTimeout(gitRefetchTimerRef.current)
    if (dashboardRefetchTimerRef.current) clearTimeout(dashboardRefetchTimerRef.current)
  }, [])

  const loadDashboard = useCallback(async () => {
    try {
      const result = await api.listAllFiles()
      const rootPath_ = result.rootPath || ''
      const allFiles = (result.files || []).map(f => {
        const rel = f.path.startsWith(rootPath_) ? f.path.slice(rootPath_.length + 1) : f.name
        const slashIdx = rel.indexOf('/')
        const parentDir = slashIdx >= 0 ? rel.slice(0, slashIdx) : null
        return { ...f, parentDir, relDir: slashIdx >= 0 ? rel.slice(0, rel.lastIndexOf('/')) : null }
      })
      const totalFolders = result.totalFolders || 0
      const extCounts = {}, docs = []
      allFiles.forEach(file => {
        if (isHiddenFile(file)) return
        const ext = file.name.split('.').pop()?.toLowerCase() || ''
        extCounts[ext] = (extCounts[ext] || 0) + 1
        if (DOC_EXTENSIONS.has(ext)) docs.push(file)
        else if (file.relDir && DOC_FOLDERS.has(file.relDir.split('/')[0]?.toLowerCase())) docs.push(file)
      })
      const docsWithLines = await Promise.all(docs.map(async (doc) => {
        try {
          const d = await api.readFile(doc.path)
          const content = d.content || ''
          const lines = content.split('\n').length
          let desc = extractDesc(content)
          if (desc.length > 60) desc = desc.slice(0, 57) + '...'
          return { ...doc, lineCount: lines, desc }
        } catch (_) { return { ...doc, lineCount: 0, desc: '' } }
      }))
      const docGroups = [], folderMap = {}
      for (const d of docsWithLines) {
        const groupKey = d.relDir || ''
        ;(folderMap[groupKey] ??= []).push(d)
      }
      if (folderMap['']?.length) docGroups.push({ group: null, items: folderMap[''] })
      Object.keys(folderMap).filter(k => k).sort().forEach(f => docGroups.push({ group: f + '/', items: folderMap[f] }))

      const langCounts = {}
      Object.entries(extCounts).forEach(([ext, count]) => { const lang = EXT_TO_LANG[ext]; if (lang) langCounts[lang] = (langCounts[lang] || 0) + count })
      const totalLang = Object.values(langCounts).reduce((a, b) => a + b, 0) || 1
      const langStats = Object.entries(langCounts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, count]) => ({ name, pct: Math.round(count / totalLang * 100), color: LANG_COLORS[name] || LANG_COLORS.Other }))
      const recentFiles = allFiles
        .filter(f => f.modifiedMs && !isHiddenFile(f))
        .sort((a, b) => b.modifiedMs - a.modifiedMs)
        .slice(0, RECENT_CHANGES_LIMIT)
        .map(f => makeRecentEntry(f.path, f.modifiedMs))
      setRecentChanges(recentFiles)
      setDashboardData({ projectName: basenameOf(rootPath_) || 'project', projectPath: rootPath_, totalFiles: allFiles.length, totalFolders, langStats, docGroups })
    } catch (e) { console.error('Dashboard load failed:', e) }
  }, [])

  const handleFocusChange = useCallback((target) => {
    setActiveFocus(target)
    setTimeout(() => {
      if (target === 'explorer' && explorerRef.current) explorerRef.current.focus()
      else if (target === 'viewer' && viewerRef.current) viewerRef.current.focus()
    }, 10)
  }, [])

  const saveFile = useCallback(async () => {
    if (!selectedFileRef.current) return
    try { await api.writeFile(selectedFileRef.current.path, editContentRef.current); setFileContent(editContentRef.current) }
    catch (e) { console.error('Save failed:', e) }
  }, [])

  const executeAction = useCallback((action) => {
    setPendingAction(null); setIsEditing(false)
    switch (action.type) {
      case 'close': setSelectedFile(null); setFileContent(''); setExternallyChanged(false); handleFocusChange('explorer'); break
      case 'changeFile': setSelectedFile(action.file); setChangedFiles(prev => { const n = new Set(prev); n.delete(action.file.path); return n }); setExternallyChanged(false); handleFocusChange('viewer'); break
      case 'exitEdit':
        if (externallyChangedRef.current) {
          setExternallyChanged(false)
          if (selectedFileRef.current) {
            api.readFile(selectedFileRef.current.path)
              .then(d => setFileContent(d.content || ''))
              .catch(err => setFileContent(formatReadError(err)))
          }
        }
        break
      default: console.warn('Unknown action:', action.type)
    }
  }, [handleFocusChange])

  const requireClean = useCallback((action) => {
    if (isEditingRef.current && editContentRef.current !== fileContentRef.current) setPendingAction(action); else executeAction(action)
  }, [executeAction])
  requireCleanRef.current = requireClean

  const handleFileSelect       = useCallback((file) => requireClean({ type:'changeFile', file }), [requireClean])
  const toggleSidebar          = useCallback(() => setSidebarVisible(p => !p), [])
  const enterEditMode          = useCallback(() => { setDiffMode(false); setEditContent(fileContentRef.current); setIsEditing(true) }, [])
  const enterDiffMode          = useCallback(() => setDiffMode(true), [])
  const exitDiffMode           = useCallback(() => setDiffMode(false), [])
  const exitEditMode           = useCallback(() => requireClean({ type:'exitEdit' }), [requireClean])
  const closeViewer            = useCallback(() => requireClean({ type:'close' }), [requireClean])
  const focusExplorer          = useCallback(() => setActiveFocus('explorer'), [])
  const focusViewer            = useCallback(() => setActiveFocus('viewer'), [])
  const handleUnsavedSave      = useCallback(async () => { const a = pendingAction; await saveFile(); executeAction(a) }, [saveFile, pendingAction, executeAction])
  const handleUnsavedDiscard   = useCallback(() => executeAction(pendingAction), [pendingAction, executeAction])

  const handleEscapeKey = () => {
    if (aboutOpen) { setAboutOpen(false); return }
    if (closeSearchRef.current?.()) return
    if (isEditingRef.current) { requireCleanRef.current({ type:'exitEdit' }); return }
    if (selectedFileRef.current) { requireCleanRef.current({ type:'close' }); return }
    handleFocusChange('explorer')
  }
  handleEscapeKeyRef.current = handleEscapeKey

  const refreshAll = useCallback(async () => {
    setRefreshKey(k => k + 1)
    setRefreshing(true)
    setJustRefreshed(false)
    const minSpin = new Promise(r => setTimeout(r, 650))
    try { await Promise.all([loadDashboard(), loadGitStatus(rootPathRef.current), minSpin]) }
    finally { setRefreshing(false); setJustRefreshed(true); setTimeout(() => setJustRefreshed(false), 900) }
  }, [loadDashboard, loadGitStatus])

  const reloadCurrentFile = useCallback(() => {
    if (!selectedFileRef.current) return
    api.readFile(selectedFileRef.current.path)
      .then(d => { setFileContent(d.content || ''); setExternallyChanged(false) })
      .catch(err => setFileContent(formatReadError(err)))
  }, [])

  const handleViewerKey = (e) => {
    if (!selectedFileRef.current || isEditingRef.current) return false
    const t = e.target
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return false
    const k = resolveKey(e.key)
    if (k === 'e') { e.preventDefault(); setDiffMode(false); setEditContent(fileContentRef.current); setIsEditing(true); return true }
    if (k === 'd' && selectedFileRef.current && gitInfo.filesByAbs.has(selectedFileRef.current.path)) { e.preventDefault(); setDiffMode(true); return true }
    if (k === 'l' && externallyChangedRef.current) { e.preventDefault(); reloadCurrentFile(); return true }
    if (e.key === ' ') {
      e.preventDefault()
      // Find first actually scrollable element inside the viewer
      const findScrollable = (root) => {
        if (!root) return null
        for (const el of root.querySelectorAll('*')) {
          if (el.scrollHeight > el.clientHeight + 1 && getComputedStyle(el).overflowY !== 'hidden') return el
        }
        return root
      }
      const sc = findScrollable(viewerRef.current)
      if (sc) sc.scrollBy({ top: e.shiftKey ? -sc.clientHeight * 0.8 : sc.clientHeight * 0.8, behavior: 'smooth' })
      return true
    }
    return false
  }
  handleViewerKeyRef.current = handleViewerKey

  const switchProject = useCallback(async (path) => {
    await api.setRoot(path)
    setSelectedFile(null); setFileContent(''); setIsEditing(false); setEditContent('')
    setChangedFiles(new Set()); setRecentChanges([])
    setDashboardData(null)
    setGitInfo({ isRepo: false, branch: null, filesByAbs: new Map(), dirtyCount: 0 })
    setRootPath(path)
    getCurrentWindow().setTitle(`vibe — ${basenameOf(path)}`)
    const list = addProject(path)
    setProjects(list)
    setRefreshKey(k => k + 1)
    setRootReady(true)
  }, [])

  useEffect(() => {
    api.getRoot().then(r => {
      if (r) { const list = addProject(r); setProjects(list); getCurrentWindow().setTitle(`vibe — ${basenameOf(r)}`) }
      setRootReady(!!r); setRootPath(r || '')
    }).catch(() => setRootReady(false))
  }, [])
  useEffect(() => { if (rootReady) { loadDashboard(); loadGitStatus(rootPath) } }, [rootReady, loadDashboard, loadGitStatus, rootPath])

  useEffect(() => {
    const ref = { current: null }; let unmounted = false
    api.onFileChanged((payload) => {
      const allPaths = payload.paths || []
      const gitEvent = allPaths.some(p => p.includes('/.git/'))
      const paths = allPaths.filter(p => !p.includes('/.git/'))
      if (gitEvent) scheduleGitRefetch(rootPathRef.current)
      if (paths.length > 0) {
        setRefreshKey(k => k + 1)
        setChangedFiles(prev => { const n = new Set(prev); paths.forEach(p => n.add(p)); return n })
        const now = Date.now()
        const filtered = paths.filter(p => !isHiddenFile({ name: basenameOf(p) }))
        if (filtered.length > 0) {
          const filteredSet = new Set(filtered)
          const newEntries = filtered.map(p => makeRecentEntry(p, now))
          setRecentChanges(prev => [...newEntries, ...prev.filter(e => !filteredSet.has(e.path))].slice(0, RECENT_CHANGES_LIMIT))
          Promise.all(newEntries.map(entry =>
            api.readFile(entry.path).then(d => ({ path: entry.path, time: entry.time, lineCount: (d.content || '').split('\n').length })).catch(() => null)
          )).then(results => {
            const counts = Object.fromEntries(results.filter(Boolean).map(r => [r.path + r.time, r.lineCount]))
            if (Object.keys(counts).length > 0) setRecentChanges(prev => prev.map(e => counts[e.path + e.time] ? { ...e, lineCount: counts[e.path + e.time] } : e))
          })
        }
        // Debounced dashboard refresh on file changes
        if (dashboardRefetchTimerRef.current) clearTimeout(dashboardRefetchTimerRef.current)
        dashboardRefetchTimerRef.current = setTimeout(() => loadDashboard(), 2000)
        // External change detection for the currently viewed file
        if (selectedFileRef.current && paths.includes(selectedFileRef.current.path)) {
          if (isEditingRef.current) {
            setExternallyChanged(true)
          } else {
            api.readFile(selectedFileRef.current.path)
              .then(d => setFileContent(d.content || ''))
              .catch(err => setFileContent(formatReadError(err)))
          }
        }
      }
    }).then(fn => { if (unmounted) fn(); else ref.current = fn })
    return () => { unmounted = true; ref.current?.() }
  }, [])

  useEffect(() => {
    const handle = (e) => {
      const key = resolveKey(e.key)
      if (e.ctrlKey && key === 'b') { e.preventDefault(); toggleSidebar() }
      else if (e.ctrlKey && e.shiftKey && key === 'l') { e.preventDefault(); setTheme(t => t === 'dark' ? 'light' : 'dark') }
      else if ((e.metaKey || e.ctrlKey) && key >= '1' && key <= '9') {
        const idx = parseInt(key) - 1
        if (idx < projects.length && projects[idx].path !== rootPath) { e.preventDefault(); switchProject(projects[idx].path) }
      }
      else if (e.key === '?' && !e.target?.matches('input,textarea,[contenteditable]')) { e.preventDefault(); setAboutOpen(a => !a) }
      else if (e.key === 'Escape') { e.preventDefault(); handleEscapeKeyRef.current() }
      else if (e.ctrlKey && key === 'r') { e.preventDefault(); refreshAll() }
      else if (e.ctrlKey && key === 'f' && activeFocusRef.current === 'viewer' && selectedFileRef.current && !isEditingRef.current) { e.preventDefault(); openSearchRef.current?.() }
      else if (activeFocusRef.current === 'viewer' && handleViewerKeyRef.current?.(e)) { /* handled */ }
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [toggleSidebar, projects, rootPath, switchProject, refreshAll])

  const isMd = selectedFile?.name.split('.').pop() === 'md'
  const gitDirty = !!(selectedFile && gitInfo.filesByAbs.has(selectedFile.path))

  const footerShortcuts = useMemo(() => {
    if (activeFocus === 'viewer') {
      if (isEditing) return isMd ? SHORTCUTS_VIEWER_EDIT_MD : SHORTCUTS_VIEWER_EDIT
      if (diffMode) return SHORTCUTS_VIEWER_DIFF
      return gitDirty ? SHORTCUTS_VIEWER_VIEW_DIRTY : SHORTCUTS_VIEWER_VIEW
    }
    return SHORTCUTS_EXPLORER
  }, [activeFocus, isEditing, isMd, diffMode, gitDirty, selectedFile])

  const handlePickFolder = async () => {
    const path = await api.pickFolder()
    if (path) await switchProject(path)
  }

  if (!rootReady) {
    return <NoRootScreen projects={projects} onOpen={switchProject} onPick={handlePickFolder} onProjectsChange={setProjects} />
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', width:'100%', height:'100vh', background:'var(--bg)', overflow:'hidden' }}>

      {aboutOpen && <AboutModal onClose={() => setAboutOpen(false)} />}

      {pendingAction && (
        <div style={{ position:'fixed', inset:0, background:'rgba(26,22,18,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
          <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'8px', padding:'24px 32px', textAlign:'center', minWidth:'280px', boxShadow:'0 8px 32px rgba(26,22,18,0.12)' }}>
            <p style={{ marginBottom:'20px', color:'var(--text)', fontSize:'14px' }}>저장하지 않은 변경사항이 있습니다.</p>
            <div style={{ display:'flex', gap:'8px', justifyContent:'center' }}>
              <button onClick={handleUnsavedSave} style={{ background:'var(--accent-sub)', border:'1px solid var(--accent)', color:'var(--accent)', cursor:'pointer', padding:'6px 16px', borderRadius:'4px', fontSize:'13px', fontFamily:FONT_UI }}>저장</button>
              <button onClick={handleUnsavedDiscard} style={{ background:'transparent', border:'1px solid var(--border)', color:'var(--muted)', cursor:'pointer', padding:'6px 16px', borderRadius:'4px', fontSize:'13px', fontFamily:FONT_UI }}>버리기</button>
              <button onClick={() => setPendingAction(null)} style={{ background:'transparent', border:'1px solid var(--border)', color:'var(--muted)', cursor:'pointer', padding:'6px 16px', borderRadius:'4px', fontSize:'13px', fontFamily:FONT_UI }}>취소</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display:'flex', flex:1, overflow:'hidden' }}>
        <div style={{ width: sidebarVisible ? '220px' : '0px', opacity: sidebarVisible ? 1 : 0, visibility: sidebarVisible ? 'visible' : 'hidden', display:'flex', flexDirection:'column', flexShrink:0, borderRight: sidebarVisible ? '1px solid var(--border)' : 'none', background:'var(--bg)', overflow:'hidden', transition:'width 0.25s ease-in-out, opacity 0.2s ease-in-out', userSelect:'none', WebkitUserSelect:'none' }}>
          <FileExplorer key={rootPath} innerRef={explorerRef} onFocus={focusExplorer} onFileSelect={handleFileSelect} isFocused={activeFocus === 'explorer'} onAtRootChange={setExplorerAtRoot} refreshKey={refreshKey} activeFilePath={selectedFile?.path} changedFiles={changedFiles} gitFiles={gitInfo.filesByAbs} gitInfo={gitInfo} />
        </div>

        <div style={{ display:'flex', flex:1, overflow:'hidden', background:'var(--surface)' }}>
          {selectedFile ? (
            <div style={{ flex:1, minWidth:'40%', overflow:'hidden' }}>
              <FileViewer innerRef={viewerRef} onFocus={focusViewer} onClose={closeViewer} onEnterEdit={enterEditMode} onExitEdit={exitEditMode} onSave={saveFile} onEditContentChange={setEditContent} selectedFile={selectedFile} content={fileContent} isEditing={isEditing} editContent={editContent} isDirty={isDirty} isMd={isMd} isDark={isDark} isFocused={activeFocus === 'viewer'} gitDirty={gitDirty} diffMode={diffMode} onEnterDiff={enterDiffMode} onExitDiff={exitDiffMode} externallyChanged={externallyChanged} onReload={reloadCurrentFile} openSearchRef={openSearchRef} closeSearchRef={closeSearchRef} />
            </div>
          ) : (
            <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
              <ProjectDashboard data={dashboardData} recentChanges={recentChanges} onFileOpen={handleFileSelect} onRefresh={refreshAll} refreshing={refreshing} justRefreshed={justRefreshed} gitInfo={gitInfo} />
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{ height:'22px', background:'var(--bg)', borderTop:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 16px', flexShrink:0 }}>
        <div style={{ display:'flex', gap:'14px', overflow:'hidden' }}>
          {footerShortcuts.map(([key, desc]) => (
            <span key={key} style={{ display:'flex', alignItems:'center', gap:'3px', fontSize:'10.5px', color:'var(--muted)', whiteSpace:'nowrap' }}>
              <kbd style={{ fontFamily:FONT_MONO, fontSize:'10px', color:'var(--text)', fontStyle:'normal' }}>{key}</kbd> {desc}
            </span>
          ))}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'8px', flexShrink:0 }}>
          {projects.length > 1 && (
            <ProjectDropdown projects={projects} currentPath={rootPath} onSelect={switchProject} />
          )}
          <button onClick={handlePickFolder} title="Add project"
            onMouseEnter={e => { e.currentTarget.style.background='var(--surface)'; e.currentTarget.style.color='var(--text)' }}
            onMouseLeave={e => { e.currentTarget.style.background='none'; e.currentTarget.style.color='var(--muted)' }}
            style={{ background:'none', border:'1px solid var(--border)', color:'var(--muted)', borderRadius:'4px', padding:'1px 6px', fontSize:'11px', cursor:'pointer', transition:'all 150ms' }}>+</button>
          <button onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} title="Ctrl+Shift+L"
            onMouseEnter={e => { e.currentTarget.style.background='var(--surface)'; e.currentTarget.style.color='var(--text)' }}
            onMouseLeave={e => { e.currentTarget.style.background='none'; e.currentTarget.style.color='var(--muted)' }}
            style={{ background:'none', border:'1px solid var(--border)', color:'var(--muted)', borderRadius:'4px', padding:'2px 8px', fontSize:'10px', cursor:'pointer', fontFamily:FONT_UI, transition:'all 150ms' }}>
            {isDark ? 'Light' : 'Dark'}
          </button>
          <button onClick={() => setAboutOpen(true)}
            onMouseEnter={e => { e.currentTarget.style.color='var(--text)' }}
            onMouseLeave={e => { e.currentTarget.style.color='var(--muted)' }}
            style={{ background:'none', border:'none', color:'var(--muted)', padding:'1px 4px', fontSize:'12px', cursor:'pointer', transition:'color 150ms' }}>
            ?
          </button>
        </div>
      </div>
    </div>
  )
}

export default App
