import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import * as api from './api'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { oneLight }    from 'react-syntax-highlighter/dist/esm/styles/prism'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// ── Korean keyboard ───────────────────────────────────────────────────────────
const KEY_ALIASES = {
  'ㅂ':'q','ㅈ':'w','ㄷ':'e','ㄱ':'r','ㅅ':'t','ㅛ':'y','ㅕ':'u','ㅑ':'i','ㅐ':'o','ㅔ':'p',
  'ㅁ':'a','ㄴ':'s','ㅇ':'d','ㄹ':'f','ㅎ':'g','ㅗ':'h','ㅓ':'j','ㅏ':'k','ㅣ':'l',
  'ㅋ':'z','ㅌ':'x','ㅊ':'c','ㅍ':'v','ㅠ':'b','ㅜ':'n','ㅡ':'m','₩':'`',
}
const resolveKey = (key) => KEY_ALIASES[key] ?? key

// ── Font family constants ────────────────────────────────────────────────────
const FONT_MONO  = "'JetBrains Mono',monospace"
const FONT_SERIF = "'Instrument Serif',serif"
const FONT_UI    = "'Geist',sans-serif"

// ── File icons (matching prototype: jsx:'⚛' js:'⚡' ts:'⬡' rs:'⬢' …) ────────
const ICON_MAP = {
  jsx: { ch:'⚛', color:'#C85A2A' }, tsx: { ch:'⚛', color:'#3178C6' },
  js:  { ch:'⚡', color:'#D4A017' }, ts:  { ch:'⬡', color:'#3178C6' },
  rs:  { ch:'⬢', color:'#CE422B' }, py:  { ch:'⬢', color:'#3572A5' }, go: { ch:'⬢', color:'#00ADD8' },
  md:  { ch:'✦', color:'var(--muted)' }, mdx: { ch:'✦', color:'var(--muted)' }, txt: { ch:'✦', color:'var(--muted)' },
  json:{ ch:'{ }', color:'var(--muted)' }, toml:{ ch:'⊕', color:'var(--muted)' }, yaml:{ ch:'⊕', color:'var(--muted)' }, yml:{ ch:'⊕', color:'var(--muted)' },
  html:{ ch:'◇', color:'#E34C26' }, css:{ ch:'◈', color:'#563D7C' }, scss:{ ch:'◈', color:'#563D7C' },
  sh:{ ch:'$', color:'var(--muted)' }, lock:{ ch:'⊘', color:'var(--muted)' },
}
const getIcon = (name) => { const ext = name.split('.').pop()?.toLowerCase(); return ICON_MAP[ext] || { ch:'·', color:'var(--muted)' } }
// Document-specific icons (richer than generic extension icons)
const DOC_ICON_MAP = { 'CLAUDE.md':'⚙︎', 'DESIGN.md':'◈', 'README.md':'✦', 'readme.md':'✦', 'TODO.md':'☐', 'todo.md':'☐', 'CHANGELOG.md':'◉', 'changelog.md':'◉', 'LICENSE':'§', 'LICENSE.md':'§' }
const getDocIcon = (name) => DOC_ICON_MAP[name] || DOC_ICON_MAP[name.toLowerCase()] || getIcon(name).ch

// ── Document + language classification ────────────────────────────────────────
const DOC_EXTENSIONS = new Set(['md','mdx','txt','rst','doc','docx','pdf'])
const DOC_FOLDERS    = new Set(['docs','doc','documentation','notes','wiki','pages','tasks'])
const EXT_TO_LANG = { js:'JavaScript', jsx:'JSX', ts:'TypeScript', tsx:'TSX', rs:'Rust', py:'Python', css:'CSS', scss:'CSS', html:'HTML', json:'JSON', toml:'TOML', md:'Markdown', mdx:'Markdown', sh:'Shell' }
const LANG_COLORS = { JSX:'#E8703A', JavaScript:'#F0C945', TypeScript:'#3178C6', TSX:'#61DAFB', Rust:'#9C4221', Python:'#3572A5', CSS:'#563D7C', HTML:'#E34C26', JSON:'#A0A0A0', TOML:'#9C4221', Markdown:'#5D8FBD', Shell:'#89E051', Other:'#8C8070' }

// ── Footer shortcut arrays ────────────────────────────────────────────────────
const SHORTCUTS_VIEWER_VIEW      = [['E','Edit'], ['Enter','Fullscreen'], ['Esc','Close']]
const SHORTCUTS_VIEWER_FULLSCREEN = [['E','Edit'], ['Enter / Esc','Exit fullscreen']]
const SHORTCUTS_VIEWER_EDIT      = [['Tab','Indent'], ['Ctrl+S','Save'], ['Esc','Exit edit']]
const SHORTCUTS_VIEWER_EDIT_MD   = [['Tab','Indent'], ['Ctrl+P','Edit/Preview'], ['Ctrl+S','Save'], ['Esc','Exit edit']]
const SHORTCUTS_EXPLORER         = [['↑↓','Navigate'], ['A','New'], ['R','Rename'], ['Del','Delete'], ['C','Copy'], ['Ctrl+B','Sidebar'], ['Enter','Open/Toggle']]

// ── Markdown ──────────────────────────────────────────────────────────────────
function makeMarkdownComponents(isDark) {
  const border = '1px solid var(--border)'
  const hl = isDark ? vscDarkPlus : oneLight
  return {
    h1: ({children}) => <h1 style={{ fontFamily:FONT_SERIF, fontStyle:'italic', fontSize:'26px', fontWeight:400, color:'var(--text)', borderBottom:border, paddingBottom:'8px', marginBottom:'16px', marginTop:'32px' }}>{children}</h1>,
    h2: ({children}) => <h2 style={{ fontSize:'16px', fontWeight:600, color:'var(--text)', borderBottom:border, paddingBottom:'4px', marginTop:'32px', marginBottom:'8px' }}>{children}</h2>,
    h3: ({children}) => <h3 style={{ fontSize:'14px', fontWeight:600, color:'var(--text)', marginTop:'16px', marginBottom:'6px' }}>{children}</h3>,
    p: ({children}) => <p style={{ marginBottom:'8px', color:'var(--text)', lineHeight:'1.75' }}>{children}</p>,
    code: ({children, className, node}) => {
      const isBlock = node?.position?.start?.line !== node?.position?.end?.line || !!className
      return isBlock
        ? <SyntaxHighlighter language={className?.replace('language-','') || 'text'} style={hl} customStyle={{ borderRadius:'6px', fontSize:'12px', marginBottom:'12px', border, fontFamily:FONT_MONO }}>{String(children).replace(/\n$/,'')}</SyntaxHighlighter>
        : <code style={{ background:'var(--surface-2)', padding:'1px 5px', borderRadius:'3px', color:'var(--accent)', fontSize:'11.5px', fontFamily:FONT_MONO, letterSpacing:'0.01em' }}>{children}</code>
    },
    a: ({href, children}) => <a href={href} style={{ color:'var(--accent)', textDecoration:'underline', textUnderlineOffset:'2px' }} target="_blank" rel="noreferrer">{children}</a>,
    ul: ({children}) => <ul style={{ paddingLeft:'16px', marginBottom:'8px' }}>{children}</ul>,
    ol: ({children}) => <ol style={{ paddingLeft:'16px', marginBottom:'8px' }}>{children}</ol>,
    li: ({children}) => <li style={{ marginBottom:'3px', color:'var(--text)' }}>{children}</li>,
    blockquote: ({children}) => <blockquote style={{ borderLeft:'3px solid var(--accent)', paddingLeft:'16px', margin:'0 0 8px 0', color:'var(--muted)' }}>{children}</blockquote>,
    hr: () => <hr style={{ border:'none', borderTop:'1px solid var(--border)', margin:'24px 0' }} />,
    strong: ({children}) => <strong style={{ fontWeight:600 }}>{children}</strong>,
    table: ({children}) => <table style={{ borderCollapse:'collapse', width:'100%', marginBottom:'16px', fontSize:'13px' }}>{children}</table>,
    thead: ({children}) => <thead style={{ borderBottom:'2px solid var(--border)' }}>{children}</thead>,
    th: ({children}) => <th style={{ padding:'5px 8px', textAlign:'left', fontWeight:600 }}>{children}</th>,
    td: ({children}) => <td style={{ padding:'5px 8px', borderBottom:'1px solid var(--border)' }}>{children}</td>,
    tr: ({children}) => <tr>{children}</tr>,
  }
}

const MarkdownView = ({ content, isDark }) => {
  const components = useMemo(() => makeMarkdownComponents(isDark), [isDark])
  return (
    <div style={{ color:'var(--text)', lineHeight:'1.75', fontSize:'14px', maxWidth:'72ch' }}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>{content}</ReactMarkdown>
    </div>
  )
}

// ── Project Dashboard ─────────────────────────────────────────────────────────
function formatAge(ms) {
  const s = Math.floor((Date.now() - ms) / 1000)
  if (s < 10) return 'just now'
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  return `${Math.floor(m / 60)}h ago`
}

function StatCard({ value, label, accent }) {
  return (
    <div style={{ background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:'6px', padding:'8px 16px' }}>
      <div style={{ fontFamily:FONT_MONO, fontSize:'20px', fontWeight:500, color: accent ? 'var(--accent)' : 'var(--text)', lineHeight:1.2 }}>{value}</div>
      <div style={{ fontSize:'10px', color:'var(--muted)', marginTop:'2px', textTransform:'uppercase', letterSpacing:'0.06em' }}>{label}</div>
    </div>
  )
}

const SECTION_LABEL = { fontSize:'10px', fontWeight:500, textTransform:'uppercase', letterSpacing:'0.1em', color:'var(--muted)', marginBottom:'8px' }
const DIVIDER       = { border:'none', borderTop:'1px solid var(--border)', margin:0 }

function ProjectDashboard({ data, recentChanges, onFileOpen }) {
  if (!data) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:'var(--muted)', fontSize:'13px' }}>Loading…</div>
  const { projectName, projectPath, totalFiles, langStats, docGroups } = data

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflowY:'auto', padding:'32px 48px', gap:'32px' }}>
      <div>
        <div style={{ fontFamily:FONT_SERIF, fontStyle:'italic', fontSize:'26px', fontWeight:400, color:'var(--text)', lineHeight:1.2 }}>{projectName}</div>
        <div style={{ fontFamily:FONT_MONO, fontSize:'11px', color:'var(--muted)', marginTop:'4px' }}>{projectPath}</div>
      </div>

      <hr style={DIVIDER} />

      <div>
        <div style={SECTION_LABEL}>Project</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'8px' }}>
          <StatCard value={totalFiles} label="Files" />
          <StatCard value="—" label="Lines" />
          <StatCard value={langStats.length} label="Languages" />
          <StatCard value="●" label="Watching" accent />
        </div>
      </div>

      {langStats.length > 0 && (
        <div>
          <div style={SECTION_LABEL}>Languages</div>
          <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
            {langStats.map(l => (
              <div key={l.name} style={{ display:'grid', gridTemplateColumns:'70px 1fr 44px', alignItems:'center', gap:'8px' }}>
                <span style={{ fontFamily:FONT_MONO, fontSize:'12px', color:'var(--text)' }}>{l.name}</span>
                <div style={{ height:'5px', background:'var(--surface-2)', borderRadius:'99px', overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${l.pct}%`, background:l.color, borderRadius:'99px', transition:'width 0.6s ease-out' }} />
                </div>
                <span style={{ fontFamily:FONT_MONO, fontSize:'10px', color:'var(--muted)', textAlign:'right' }}>{l.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <hr style={DIVIDER} />

      {docGroups.length > 0 && (
        <div>
          <div style={SECTION_LABEL}>Documents</div>
          <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
            {docGroups.map((group, gi) => (
              <div key={gi} style={{ marginBottom: group.group ? '8px' : 0 }}>
                {group.group && (
                  <div style={{ fontFamily:FONT_SERIF, fontStyle:'italic', fontSize:'12px', color:'var(--muted)', marginBottom:'4px', paddingLeft:'4px' }}>{group.group}</div>
                )}
                {group.items.map(doc => {
                  const icon = getDocIcon(doc.name)
                  return (
                    <div key={doc.path} onClick={() => onFileOpen(doc)}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-sub)'; e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--accent) 20%, transparent)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent' }}
                      style={{ display:'flex', alignItems:'center', gap:'8px', padding:'6px 8px', borderRadius:'5px', cursor:'pointer', border:'1px solid transparent', transition:'background 75ms' }}>
                      <span style={{ fontSize:'14px', width:'20px', textAlign:'center', flexShrink:0, color:'var(--muted)' }}>{icon}</span>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:'13px', fontWeight:500, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{doc.name}</div>
                        {doc.desc && <div style={{ fontSize:'11px', color:'var(--muted)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{doc.desc}</div>}
                      </div>
                      {doc.lineCount > 0 && (
                        <span style={{ fontFamily:FONT_MONO, fontSize:'10px', color:'var(--muted)', flexShrink:0 }}>{doc.lineCount} lines</span>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {recentChanges.length > 0 && (
        <>
          <hr style={DIVIDER} />
          <div>
            <div style={SECTION_LABEL}>Recently Changed</div>
            <div style={{ display:'flex', flexDirection:'column', gap:'2px' }}>
              {recentChanges.map((item, i) => {
                const ext = item.name.split('.').pop()?.toLowerCase() || ''
                const lang = EXT_TO_LANG[ext] || 'Other'
                const dotColor = LANG_COLORS[lang] || LANG_COLORS.Other
                return (
                <div key={item.path + i} onClick={() => onFileOpen(item)}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  style={{ display:'flex', alignItems:'center', gap:'8px', padding:'5px 8px', borderRadius:'5px', cursor:'pointer', transition:'background 75ms' }}>
                  <span style={{ width:'6px', height:'6px', borderRadius:'50%', background:dotColor, flexShrink:0 }} />
                  <span style={{ fontSize:'13px', color:'var(--text)', flex:1 }}>{item.name}</span>
                  <span style={{ fontFamily:FONT_MONO, fontSize:'10px', color:'var(--muted)' }}>{formatAge(item.time)}</span>
                  {item.lineCount > 0 && <span style={{ fontFamily:FONT_MONO, fontSize:'10px', color:'var(--muted)', minWidth:'52px', textAlign:'right' }}>{item.lineCount} lines</span>}
                </div>)
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── File Explorer (nested tree) ───────────────────────────────────────────────
// Exact indent values from prototype: 12, 24, 40, 56…
const INDENT = [12, 24, 40, 56, 72]
const getIndent = (depth) => INDENT[depth] ?? (12 + depth * 16)

const FileExplorer = ({ onFileSelect, isFocused, onFocus, innerRef, onAtRootChange, refreshKey, activeFilePath, changedFiles }) => {
  const [rootItems, setRootItems]           = useState([])
  const [expandedDirs, setExpandedDirs]     = useState(new Set())
  const [childrenCache, setChildrenCache]   = useState({})
  const [selectedIndex, setSelectedIndex]   = useState(0)
  const [naming, setNaming]                 = useState({ active:false, type:'', value:'', oldPath:'', parentPath:'' })
  const [hoveredPath, setHoveredPath]       = useState(null)
  const rootPathRef = useRef('')
  const inputRef    = useRef(null)

  // Flat list of currently visible items (with depth info)
  const visibleItems = useMemo(() => {
    const result = []
    const walk = (items, depth) => {
      for (const item of items) {
        result.push({ ...item, depth })
        if (item.isDirectory && expandedDirs.has(item.path)) {
          walk(childrenCache[item.path] || [], depth + 1)
        }
      }
    }
    walk(rootItems, 0)
    return result
  }, [rootItems, expandedDirs, childrenCache])

  // Clamp selection when tree collapses
  useEffect(() => {
    if (selectedIndex >= visibleItems.length && visibleItems.length > 0) {
      setSelectedIndex(visibleItems.length - 1)
    }
  }, [visibleItems.length, selectedIndex])

  // Fetch root
  const fetchRoot = useCallback(async () => {
    try {
      const data = await api.listFiles('')
      if (data.currentPath) rootPathRef.current = data.currentPath
      setRootItems(data.items || [])
      onAtRootChange(true)
    } catch (err) { console.error('Failed to fetch root:', err) }
  }, [onAtRootChange])

  useEffect(() => { fetchRoot() }, [fetchRoot])

  // Refresh on file changes
  useEffect(() => {
    if (refreshKey === 0) return
    const refresh = async () => {
      try {
        const data = await api.listFiles('')
        setRootItems(data.items || [])
        // Re-fetch open dirs
        const updates = {}
        await Promise.all(
          [...expandedDirs].map(async (dirPath) => {
            try {
              const sub = await api.listFiles(dirPath)
              updates[dirPath] = sub.items || []
            } catch (_) {}
          })
        )
        if (Object.keys(updates).length > 0) {
          setChildrenCache(prev => ({ ...prev, ...updates }))
        }
      } catch (_) {}
    }
    refresh()
  }, [refreshKey]) // eslint-disable-line

  // Toggle dir expand/collapse
  const toggleDir = useCallback(async (dirPath) => {
    if (expandedDirs.has(dirPath)) {
      setExpandedDirs(prev => { const n = new Set(prev); n.delete(dirPath); return n })
    } else {
      if (!childrenCache[dirPath]) {
        try {
          const data = await api.listFiles(dirPath)
          setChildrenCache(prev => ({ ...prev, [dirPath]: data.items || [] }))
        } catch (_) {}
      }
      setExpandedDirs(prev => new Set([...prev, dirPath]))
    }
  }, [expandedDirs, childrenCache])

  // Naming
  useEffect(() => {
    if (naming.active && inputRef.current) {
      inputRef.current.focus()
      if (naming.type === 'rename') {
        const dot = naming.value.lastIndexOf('.')
        inputRef.current.setSelectionRange(0, dot > 0 ? dot : naming.value.length)
      }
    }
  }, [naming.active, naming.type, naming.value])

  const handleNamingSubmit = async (e) => {
    e.preventDefault()
    if (!naming.value) { setNaming({ active:false }); return }
    try {
      if (naming.type === 'file' || naming.type === 'dir') {
        await api.createItem(naming.parentPath + '/' + naming.value, naming.type === 'dir')
        // Refresh parent in cache
        if (naming.parentPath !== rootPathRef.current) {
          const data = await api.listFiles(naming.parentPath)
          setChildrenCache(prev => ({ ...prev, [naming.parentPath]: data.items || [] }))
        } else {
          fetchRoot()
        }
      } else if (naming.type === 'rename') {
        const parentPath = naming.oldPath.substring(0, naming.oldPath.lastIndexOf('/'))
        await api.renameItem(naming.oldPath, parentPath + '/' + naming.value)
        if (parentPath !== rootPathRef.current) {
          const data = await api.listFiles(parentPath)
          setChildrenCache(prev => ({ ...prev, [parentPath]: data.items || [] }))
        } else {
          fetchRoot()
        }
      }
      setNaming({ active:false })
    } catch (err) { console.error('Action failed:', err) }
  }

  const handleDelete = useCallback(async () => {
    const item = visibleItems[selectedIndex]
    if (!item) return
    if (!window.confirm(`Delete ${item.name}?`)) return
    try {
      await api.deleteItem(item.path)
      onFileSelect(null)
      const parentPath = item.path.substring(0, item.path.lastIndexOf('/'))
      if (parentPath !== rootPathRef.current) {
        const data = await api.listFiles(parentPath)
        setChildrenCache(prev => ({ ...prev, [parentPath]: data.items || [] }))
      } else {
        fetchRoot()
      }
    } catch (err) { console.error('Delete failed:', err) }
  }, [visibleItems, selectedIndex, onFileSelect, fetchRoot])

  const copyPath = useCallback(() => {
    const item = visibleItems[selectedIndex]
    if (!item) return
    const rel = item.path.replace(rootPathRef.current + '/', '').replace(rootPathRef.current, '.')
    navigator.clipboard.writeText(rel)
  }, [visibleItems, selectedIndex])

  // Keyboard handling
  useEffect(() => {
    if (!isFocused || naming.active) return
    const handle = (e) => {
      const key = resolveKey(e.key).toLowerCase()
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(p => Math.min(visibleItems.length - 1, p + 1)) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(p => Math.max(0, p - 1)) }
      else if (e.key === 'Enter') {
        e.preventDefault()
        const item = visibleItems[selectedIndex]
        if (item) { if (item.isDirectory) toggleDir(item.path); else onFileSelect(item) }
      }
      else if (e.key === 'Backspace') {
        // Collapse parent directory
        e.preventDefault()
        const item = visibleItems[selectedIndex]
        if (!item) return
        const parentPath = item.path.substring(0, item.path.lastIndexOf('/'))
        if (parentPath && parentPath !== rootPathRef.current && expandedDirs.has(parentPath)) {
          const pIdx = visibleItems.findIndex(v => v.path === parentPath)
          if (pIdx >= 0) setSelectedIndex(pIdx)
          setExpandedDirs(prev => { const n = new Set(prev); n.delete(parentPath); return n })
        }
      }
      else if (key === 'a') {
        e.preventDefault()
        const item = visibleItems[selectedIndex]
        let parentPath = rootPathRef.current
        if (item) {
          if (item.isDirectory) {
            parentPath = item.path
            if (!expandedDirs.has(item.path)) toggleDir(item.path)
          } else {
            parentPath = item.path.substring(0, item.path.lastIndexOf('/'))
          }
        }
        setNaming({ active:true, type: e.shiftKey ? 'dir' : 'file', value:'', oldPath:'', parentPath })
      }
      else if (key === 'r') {
        e.preventDefault()
        const item = visibleItems[selectedIndex]
        if (item) setNaming({ active:true, type:'rename', value:item.name, oldPath:item.path, parentPath:'' })
      }
      else if (e.key === 'Delete' || (e.metaKey && e.key === 'Backspace')) { e.preventDefault(); handleDelete() }
      else if (key === 'c') { e.preventDefault(); copyPath() }
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [isFocused, naming.active, visibleItems, selectedIndex, toggleDir, onFileSelect, expandedDirs, handleDelete, copyPath])

  const renderInput = (depth) => (
    <form onSubmit={handleNamingSubmit} style={{ padding:`4px 16px 4px ${getIndent(depth)}px` }}>
      <input
        ref={inputRef}
        value={naming.value}
        onChange={e => setNaming(prev => ({ ...prev, value:e.target.value }))}
        onBlur={() => setNaming({ active:false })}
        onKeyDown={e => { if (e.key === 'Escape') setNaming({ active:false }) }}
        style={{ width:'100%', background:'var(--surface)', border:'1px solid var(--accent)', color:'var(--text)', fontSize:'13px', padding:'1px 6px', borderRadius:'4px', outline:'none', fontFamily:FONT_UI }}
      />
    </form>
  )

  return (
    <div ref={innerRef} tabIndex={0} onFocus={onFocus} style={{ display:'flex', flexDirection:'column', height:'100%', outline:'none', background:'var(--bg)' }}>
      {/* Header */}
      <div style={{ padding:'10px 16px 6px', fontSize:'10px', fontWeight:500, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.08em', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <span>Explorer</span>
        <div style={{ display:'flex', gap:'2px' }}>
          {[['New file (A)','+','file'], ['New folder (Shift+A)','⊕','dir']].map(([title, icon, type]) => (
            <button key={type} title={title}
              onClick={() => setNaming({ active:true, type, value:'', oldPath:'', parentPath: rootPathRef.current })}
              onMouseEnter={e => { e.currentTarget.style.color='var(--text)'; e.currentTarget.style.background='var(--surface-2)' }}
              onMouseLeave={e => { e.currentTarget.style.color='var(--muted)'; e.currentTarget.style.background='none' }}
              style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', padding:'2px 4px', borderRadius:'3px', fontSize:'12px', transition:'color 150ms, background 150ms' }}>
              {icon}
            </button>
          ))}
        </div>
      </div>

      {/* Tree */}
      <div style={{ flex:1, overflowY:'auto', overflowX:'hidden', paddingBottom:'16px' }}>
        {/* New item input at top if creating in root and nothing selected */}
        {naming.active && (naming.type === 'file' || naming.type === 'dir') && naming.parentPath === rootPathRef.current && renderInput(0)}

        {visibleItems.map((item, idx) => {
          const isActive   = item.path === activeFilePath
          const isSelected = idx === selectedIndex && isFocused
          const isHovered  = hoveredPath === item.path
          const isChanged  = changedFiles?.has(item.path)
          const isExpanded = item.isDirectory && expandedDirs.has(item.path)
          const highlight  = isSelected || isHovered
          const padL       = getIndent(item.depth)
          const icon       = getIcon(item.name)

          return (
            <div key={item.path}>
              {naming.active && naming.type === 'rename' && idx === selectedIndex ? (
                renderInput(item.depth)
              ) : (
                <div
                  onClick={() => { setSelectedIndex(idx); if (item.isDirectory) toggleDir(item.path); else onFileSelect(item) }}
                  onMouseEnter={() => setHoveredPath(item.path)}
                  onMouseLeave={() => setHoveredPath(null)}
                  style={{
                    display:'flex', alignItems:'center', gap:'10px',
                    padding: `3px 16px 3px ${highlight ? padL - 2 : padL}px`,
                    cursor:'pointer', userSelect:'none', position:'relative',
                    whiteSpace:'nowrap', overflow:'hidden',
                    background: highlight ? 'var(--surface-2)' : 'transparent',
                    borderLeft: highlight ? '2px solid color-mix(in srgb, var(--accent) 60%, var(--border))' : 'none',
                    transition:'background 75ms',
                  }}
                >
                  {isActive && (
                    <span style={{ position:'absolute', left:'5px', top:'50%', transform:'translateY(-50%)', width:'5px', height:'5px', borderRadius:'50%', background:'var(--accent)' }} />
                  )}

                  {item.isDirectory ? (
                    <span style={{ fontSize:'9px', color:'var(--muted)', width:'10px', flexShrink:0, display:'inline-block', textAlign:'center', transition:'transform 150ms', transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}>▾</span>
                  ) : (
                    <span style={{ fontSize:'11px', color:'var(--muted)', width:'14px', flexShrink:0, textAlign:'center', fontStyle:'normal' }}>{icon.ch}</span>
                  )}

                  <span style={{
                    overflow:'hidden', textOverflow:'ellipsis', flex:1,
                    fontFamily: item.isDirectory ? FONT_SERIF : FONT_UI,
                    fontStyle: item.isDirectory ? 'italic' : 'normal',
                    fontSize: item.isDirectory ? '14px' : '13px',
                    fontWeight: 400, lineHeight: item.isDirectory ? '1.4' : '1.5',
                    color: isActive ? 'var(--accent)' : 'var(--text)',
                  }}>
                    {item.name}{item.isDirectory ? '/' : ''}
                  </span>

                  {isChanged && (
                    <span style={{ display:'inline-flex', alignItems:'center', gap:'4px', background:'var(--accent-sub)', color:'var(--accent)', fontSize:'10px', padding:'1px 6px', borderRadius:'4px', flexShrink:0, animation:'badge-pulse 2s ease-in-out infinite', border:'1px solid color-mix(in srgb, var(--accent) 25%, transparent)' }}>
                      <span style={{ width:'4px', height:'4px', borderRadius:'50%', background:'var(--accent)' }} />
                    </span>
                  )}
                </div>
              )}

              {naming.active && (naming.type === 'file' || naming.type === 'dir') && naming.parentPath === item.path && idx === selectedIndex && renderInput(item.depth + 1)}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── File Viewer ───────────────────────────────────────────────────────────────
const EXT_TO_DISPLAY = { js:'js', jsx:'jsx', ts:'ts', tsx:'tsx', rs:'rs', py:'py', md:'md', css:'css', html:'html', json:'json', toml:'toml', sh:'sh' }

const FileViewer = ({
  selectedFile, content, isEditing, editContent, isDirty, isMd, isDark,
  onEditContentChange, onEnterEdit, onExitEdit, onSave,
  isFocused, onFocus, onClose, onToggleFullscreen, innerRef,
}) => {
  const [mdTab, setMdTab] = useState('edit')
  const textareaRef       = useRef(null)
  const lineNumbersRef    = useRef(null)
  const ext = selectedFile?.name.split('.').pop()?.toLowerCase() ?? ''
  const langBadge = EXT_TO_DISPLAY[ext] || ext || '—'

  useEffect(() => { setMdTab('edit') }, [selectedFile])
  useEffect(() => { if (isEditing && textareaRef.current) textareaRef.current.focus() }, [isEditing])

  useEffect(() => {
    if (!isFocused || isEditing) return
    const handle = (e) => {
      if (e.key === 'Enter') { e.preventDefault(); onToggleFullscreen() }
      if (resolveKey(e.key) === 'e') { e.preventDefault(); onEnterEdit() }
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [isFocused, isEditing, onToggleFullscreen, onEnterEdit])

  useEffect(() => {
    if (!isEditing || !isMd) return
    const handle = (e) => {
      if (e.ctrlKey && resolveKey(e.key) === 'p') { e.preventDefault(); setMdTab(p => p === 'edit' ? 'preview' : 'edit') }
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [isEditing, isMd])

  const handleTextareaKeyDown = useCallback((e) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      const s = e.target.selectionStart, end = e.target.selectionEnd
      onEditContentChange(editContent.slice(0, s) + '  ' + editContent.slice(end))
      requestAnimationFrame(() => { if (textareaRef.current) { textareaRef.current.selectionStart = s + 2; textareaRef.current.selectionEnd = s + 2 } })
    } else if (e.ctrlKey && resolveKey(e.key) === 's') { e.preventDefault(); onSave() }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onExitEdit() }
  }, [editContent, onEditContentChange, onSave, onExitEdit])

  const showEditPane    = isEditing && (!isMd || mdTab === 'edit')
  const showPreviewPane = isEditing && isMd && mdTab === 'preview'
  const lineCount       = (isEditing ? editContent : content).split('\n').length
  const syntaxStyle     = isDark ? vscDarkPlus : oneLight

  return (
    <div ref={innerRef} tabIndex={0} onFocus={onFocus} style={{ display:'flex', flexDirection:'column', height:'100%', outline:'none', background:'var(--surface)' }}>
      {/* Header */}
      <div style={{ height:'34px', minHeight:'34px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', padding:'0 16px', gap:'16px', flexShrink:0 }}>
        <span style={{ fontSize:'13px', fontWeight:500, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {selectedFile?.name}{isDirty ? ' ●' : ''}
        </span>
        <span style={{ fontSize:'10px', color:'var(--muted)', background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:'3px', padding:'1px 6px', fontFamily:FONT_MONO, flexShrink:0 }}>{langBadge}</span>

        {isEditing && isMd && (
          <div style={{ display:'flex' }}>
            {['edit','preview'].map(tab => (
              <button key={tab} onClick={() => setMdTab(tab)} style={{ background:'none', border:'none', padding:'4px 12px', fontSize:'12px', cursor:'pointer', color: mdTab === tab ? 'var(--accent)' : 'var(--muted)', borderBottom: mdTab === tab ? '2px solid var(--accent)' : '2px solid transparent', fontFamily:FONT_UI }}>
                {tab === 'edit' ? 'Edit' : 'Preview'}
              </button>
            ))}
          </div>
        )}

        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:'8px' }}>
          {isEditing ? (
            <>
              <button onClick={onSave} disabled={!isDirty} style={{ background: isDirty ? 'var(--accent-sub)' : 'transparent', border:`1px solid ${isDirty ? 'var(--accent)' : 'var(--border)'}`, color: isDirty ? 'var(--accent)' : 'var(--muted)', cursor: isDirty ? 'pointer' : 'default', fontSize:'11px', padding:'2px 8px', borderRadius:'4px', fontFamily:FONT_UI }}>Save</button>
              <button onClick={onExitEdit} style={{ background:'none', border:'1px solid var(--border)', color:'var(--muted)', cursor:'pointer', fontSize:'11px', padding:'2px 8px', borderRadius:'4px', fontFamily:FONT_UI }}>View</button>
            </>
          ) : (
            <button onClick={onEnterEdit}
              onMouseEnter={e => { e.currentTarget.style.background='var(--surface-2)'; e.currentTarget.style.borderColor='var(--accent)'; e.currentTarget.style.color='var(--text)' }}
              onMouseLeave={e => { e.currentTarget.style.background='none'; e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.color='var(--muted)' }}
              style={{ background:'none', border:'1px solid var(--border)', color:'var(--muted)', cursor:'pointer', fontSize:'11px', padding:'2px 8px', borderRadius:'4px', fontFamily:FONT_UI, transition:'all 150ms' }}>E Edit</button>
          )}
          <span style={{ fontFamily:FONT_MONO, fontSize:'11px', color:'var(--muted)', minWidth:'52px', textAlign:'right' }}>{lineCount} lines</span>
          <button onClick={onClose} style={{ background:'transparent', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:'16px', lineHeight:1, padding:'0 2px' }}>&times;</button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex:1, overflow: showEditPane ? 'hidden' : 'auto', padding: showEditPane ? '0' : isMd ? '24px 32px' : '16px 0', display: showEditPane ? 'flex' : 'block', flexDirection:'column' }}>
        {selectedFile && (
          showEditPane ? (
            <div style={{ display:'flex', flex:1, overflow:'hidden' }}>
              <div ref={lineNumbersRef} style={{ padding:'16px 16px', background:'var(--surface)', color:'var(--border)', fontSize:'12px', lineHeight:'1.75', fontFamily:FONT_MONO, textAlign:'right', userSelect:'none', overflowY:'hidden', flexShrink:0, borderRight:'1px solid var(--border)', minWidth:'44px', whiteSpace:'pre' }}>
                {editContent.split('\n').map((_, i) => <div key={i}>{i + 1}</div>)}
              </div>
              <textarea ref={textareaRef} value={editContent} onChange={e => onEditContentChange(e.target.value)} onKeyDown={handleTextareaKeyDown}
                onScroll={e => { if (lineNumbersRef.current) lineNumbersRef.current.scrollTop = e.target.scrollTop }}
                spellCheck={false}
                style={{ flex:1, background:'var(--surface)', color:'var(--text)', border:'none', outline:'none', resize:'none', padding:'16px', fontFamily:FONT_MONO, fontSize:'12.5px', lineHeight:'1.75', letterSpacing:'0.01em' }} />
            </div>
          ) : showPreviewPane ? (
            <MarkdownView content={editContent} isDark={isDark} />
          ) : isMd ? (
            <MarkdownView content={content} isDark={isDark} />
          ) : (
            <SyntaxHighlighter language={ext || 'text'} style={syntaxStyle} showLineNumbers lineNumberStyle={{ color:'var(--border)', fontSize:'12px', minWidth:'2.5em', fontFamily:FONT_MONO }}
              customStyle={{ margin:0, padding:'16px 0', background:'transparent', fontSize:'12.5px', fontFamily:FONT_MONO, letterSpacing:'0.01em', lineHeight:'1.75' }}>
              {content}
            </SyntaxHighlighter>
          )
        )}
      </div>
    </div>
  )
}

// ── Project list helpers ──────────────────────────────────────────────────────
const PROJECTS_KEY = 'vibe-projects'
const loadProjects = () => { try { return JSON.parse(localStorage.getItem(PROJECTS_KEY)) || [] } catch { return [] } }
const saveProjects = (list) => localStorage.setItem(PROJECTS_KEY, JSON.stringify(list))
const addProject = (path) => {
  const name = path.split('/').pop()
  const list = loadProjects().filter(p => p.path !== path)
  list.unshift({ path, name })
  if (list.length > 10) list.length = 10
  saveProjects(list)
  return list
}

// ── App ───────────────────────────────────────────────────────────────────────
function App() {
  const explorerRef = useRef(null)
  const viewerRef   = useRef(null)

  const selectedFileRef    = useRef(null)
  const viewerFullscreenRef = useRef(false)
  const isEditingRef       = useRef(false)
  const editContentRef     = useRef('')
  const fileContentRef     = useRef('')
  const requireCleanRef    = useRef(null)
  const handleEscapeKeyRef = useRef(null)

  const [rootReady, setRootReady]               = useState(false)
  const [selectedFile, setSelectedFile]         = useState(null)
  const [fileContent, setFileContent]           = useState('')
  const [isEditing, setIsEditing]               = useState(false)
  const [editContent, setEditContent]           = useState('')
  const [pendingAction, setPendingAction]       = useState(null)
  const [activeFocus, setActiveFocus]           = useState('explorer')
  const [sidebarVisible, setSidebarVisible]     = useState(true)
  const [viewerFullscreen, setViewerFullscreen] = useState(false)
  const [explorerAtRoot, setExplorerAtRoot]     = useState(true)
  const [refreshKey, setRefreshKey]             = useState(0)
  const [theme, setTheme]                       = useState(() => localStorage.getItem('vibe-theme') || 'light')
  const [rootPath, setRootPath]                 = useState('')
  const [changedFiles, setChangedFiles]         = useState(new Set())
  const [recentChanges, setRecentChanges]       = useState([])
  const [dashboardData, setDashboardData]       = useState(null)
  const [projects, setProjects]                 = useState(() => loadProjects())

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme === 'dark' ? 'dark' : '')
    localStorage.setItem('vibe-theme', theme)
  }, [theme])

  const isDark = theme === 'dark'

  selectedFileRef.current     = selectedFile
  viewerFullscreenRef.current = viewerFullscreen
  isEditingRef.current        = isEditing
  editContentRef.current      = editContent
  fileContentRef.current      = fileContent

  const isDirty = isEditing && editContent !== fileContent

  useEffect(() => {
    if (!selectedFile || selectedFile.isDirectory) { setFileContent(''); return }
    setIsEditing(false); setEditContent('')
    api.readFile(selectedFile.path).then(d => setFileContent(d.content || '')).catch(() => setFileContent('Error loading file content.'))
  }, [selectedFile])

  const loadDashboard = useCallback(async () => {
    try {
      const rootData = await api.listFiles('')
      const rootItems = rootData.items || []
      const allFiles = []
      rootItems.forEach(item => { if (!item.isDirectory) allFiles.push(item) })
      const subDirScans = []
      await Promise.all(rootItems.filter(f => f.isDirectory).map(async (dir) => {
        try {
          const sub = await api.listFiles(dir.path)
          ;(sub.items || []).forEach(item => {
            if (!item.isDirectory) allFiles.push({ ...item, parentDir: dir.name })
            else if (DOC_FOLDERS.has(dir.name.toLowerCase())) subDirScans.push({ dirPath: item.path, parentDir: dir.name + '/' + item.name })
          })
        } catch (_) {}
      }))
      // Scan one more level inside doc folders (e.g. docs/subfolder/*.md)
      await Promise.all(subDirScans.map(async ({ dirPath, parentDir }) => {
        try { const sub = await api.listFiles(dirPath); (sub.items || []).forEach(item => { if (!item.isDirectory) allFiles.push({ ...item, parentDir }) }) } catch (_) {}
      }))
      const extCounts = {}, docs = []
      allFiles.forEach(file => {
        if (file.name.startsWith('.') || file.parentDir?.startsWith('.')) return
        const ext = file.name.split('.').pop()?.toLowerCase() || ''
        extCounts[ext] = (extCounts[ext] || 0) + 1
        if (DOC_EXTENSIONS.has(ext)) docs.push(file)
        else if (DOC_FOLDERS.has(file.parentDir?.toLowerCase())) docs.push(file)
      })
      // Get line counts + description for docs
      const docsWithLines = await Promise.all(docs.map(async (doc) => {
        try {
          const d = await api.readFile(doc.path)
          const content = d.content || ''
          const lines = content.split('\n').length
          // Extract description: first non-title, non-empty line or first ## heading
          let desc = ''
          for (const line of content.split('\n')) {
            const trimmed = line.trim()
            if (!trimmed || trimmed.startsWith('# ')) continue
            if (trimmed.startsWith('## ')) { desc = trimmed.replace(/^#+\s*/, ''); break }
            if (trimmed.startsWith('- **') || trimmed.startsWith('**')) { desc = trimmed.replace(/\*\*/g, '').replace(/^-\s*/, ''); break }
            if (trimmed.length > 5 && !trimmed.startsWith('#') && !trimmed.startsWith('<!--') && !trimmed.startsWith('---')) { desc = trimmed; break }
          }
          if (desc.length > 60) desc = desc.slice(0, 57) + '...'
          return { ...doc, lineCount: lines, desc }
        } catch (_) { return { ...doc, lineCount: 0, desc: '' } }
      }))
      // Group docs by folder
      const docGroups = [], folderMap = {}
      for (const d of docsWithLines) {
        if (!d.parentDir) { (folderMap[''] ??= []).push(d) }
        else { (folderMap[d.parentDir] ??= []).push(d) }
      }
      if (folderMap['']?.length) docGroups.push({ group: null, items: folderMap[''] })
      Object.keys(folderMap).filter(k => k).sort().forEach(f => docGroups.push({ group: f + '/', items: folderMap[f] }))

      const langCounts = {}
      Object.entries(extCounts).forEach(([ext, count]) => { const lang = EXT_TO_LANG[ext]; if (lang) langCounts[lang] = (langCounts[lang] || 0) + count })
      const totalLang = Object.values(langCounts).reduce((a, b) => a + b, 0) || 1
      const langStats = Object.entries(langCounts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, count]) => ({ name, pct: Math.round(count / totalLang * 100), color: LANG_COLORS[name] || LANG_COLORS.Other }))
      setDashboardData({ projectName: rootData.currentPath?.split('/').pop() || 'project', projectPath: rootData.currentPath || '', totalFiles: allFiles.length, langStats, docGroups })
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
      case 'close': setSelectedFile(null); setFileContent(''); setViewerFullscreen(false); handleFocusChange('explorer'); break
      case 'changeFile': setSelectedFile(action.file); setChangedFiles(prev => { const n = new Set(prev); n.delete(action.file.path); return n }); handleFocusChange('viewer'); break
      case 'exitEdit': break
      default: console.warn('Unknown action:', action.type)
    }
  }, [handleFocusChange])

  const requireClean = useCallback((action) => {
    if (isEditingRef.current && editContentRef.current !== fileContentRef.current) setPendingAction(action); else executeAction(action)
  }, [executeAction])
  requireCleanRef.current = requireClean

  const toggleViewerFullscreen = useCallback(() => setViewerFullscreen(p => !p), [])
  const handleFileSelect       = useCallback((file) => requireClean({ type:'changeFile', file }), [requireClean])
  const toggleSidebar          = useCallback(() => setSidebarVisible(p => !p), [])
  const enterEditMode          = useCallback(() => { setEditContent(fileContentRef.current); setIsEditing(true) }, [])
  const exitEditMode           = useCallback(() => requireClean({ type:'exitEdit' }), [requireClean])
  const closeViewer            = useCallback(() => requireClean({ type:'close' }), [requireClean])
  const focusExplorer          = useCallback(() => setActiveFocus('explorer'), [])
  const focusViewer            = useCallback(() => setActiveFocus('viewer'), [])
  const handleUnsavedSave      = useCallback(async () => { const a = pendingAction; await saveFile(); executeAction(a) }, [saveFile, pendingAction, executeAction])
  const handleUnsavedDiscard   = useCallback(() => executeAction(pendingAction), [pendingAction, executeAction])

  const handleEscapeKey = () => {
    if (isEditingRef.current) { requireCleanRef.current({ type:'exitEdit' }); return }
    if (viewerFullscreenRef.current) { setViewerFullscreen(false); return }
    if (selectedFileRef.current) { requireCleanRef.current({ type:'close' }); return }
    handleFocusChange('explorer')
  }
  handleEscapeKeyRef.current = handleEscapeKey

  const switchProject = useCallback(async (path) => {
    await api.setRoot(path)
    setSelectedFile(null); setFileContent(''); setIsEditing(false); setEditContent('')
    setViewerFullscreen(false); setChangedFiles(new Set()); setRecentChanges([])
    setDashboardData(null)
    setRootPath(path)
    const list = addProject(path)
    setProjects(list)
    setRefreshKey(k => k + 1)
    setRootReady(true)
    loadDashboard()
  }, [loadDashboard])

  useEffect(() => {
    api.getRoot().then(r => {
      if (r) { const list = addProject(r); setProjects(list) }
      setRootReady(!!r); setRootPath(r || '')
    }).catch(() => setRootReady(false))
  }, [])
  useEffect(() => { if (rootReady) loadDashboard() }, [rootReady, loadDashboard])

  useEffect(() => {
    const ref = { current: null }; let unmounted = false
    api.onFileChanged((payload) => {
      setRefreshKey(k => k + 1)
      const paths = payload.paths || []
      if (paths.length > 0) {
        setChangedFiles(prev => { const n = new Set(prev); paths.forEach(p => n.add(p)); return n })
        const now = Date.now()
        const newEntries = paths.map(p => ({ path:p, name:p.split('/').pop(), time:now, lineCount:0 }))
        setRecentChanges(prev => [...newEntries, ...prev.filter(e => !paths.includes(e.path))].slice(0, 5))
        // Fetch line counts async (batched update)
        Promise.all(newEntries.map(entry =>
          api.readFile(entry.path).then(d => ({ path: entry.path, time: entry.time, lineCount: (d.content || '').split('\n').length })).catch(() => null)
        )).then(results => {
          const counts = Object.fromEntries(results.filter(Boolean).map(r => [r.path + r.time, r.lineCount]))
          if (Object.keys(counts).length > 0) setRecentChanges(prev => prev.map(e => counts[e.path + e.time] ? { ...e, lineCount: counts[e.path + e.time] } : e))
        })
      }
      if (selectedFileRef.current && payload.paths?.includes(selectedFileRef.current.path)) {
        if (!isEditingRef.current) api.readFile(selectedFileRef.current.path).then(d => setFileContent(d.content || '')).catch(() => {})
      }
    }).then(fn => { if (unmounted) fn(); else ref.current = fn })
    return () => { unmounted = true; ref.current?.() }
  }, [])

  useEffect(() => {
    const handle = (e) => {
      const key = resolveKey(e.key)
      if (e.ctrlKey && key === 'b') { e.preventDefault(); toggleSidebar() }
      else if (e.ctrlKey && e.shiftKey && key.toLowerCase() === 'l') { e.preventDefault(); setTheme(t => t === 'dark' ? 'light' : 'dark') }
      else if ((e.metaKey || e.ctrlKey) && key >= '1' && key <= '9') {
        const idx = parseInt(key) - 1
        if (idx < projects.length && projects[idx].path !== rootPath) { e.preventDefault(); switchProject(projects[idx].path) }
      }
      else if (e.key === 'Escape') { e.preventDefault(); handleEscapeKeyRef.current() }
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [toggleSidebar, projects, rootPath, switchProject])

  const isMd = selectedFile?.name.split('.').pop() === 'md'

  const footerShortcuts = useMemo(() => {
    if (activeFocus === 'viewer') {
      if (isEditing) return isMd ? SHORTCUTS_VIEWER_EDIT_MD : SHORTCUTS_VIEWER_EDIT
      if (viewerFullscreen) return SHORTCUTS_VIEWER_FULLSCREEN
      return SHORTCUTS_VIEWER_VIEW
    }
    return SHORTCUTS_EXPLORER
  }, [activeFocus, isEditing, isMd, viewerFullscreen])

  const handlePickFolder = async () => {
    const path = await api.pickFolder()
    if (path) await switchProject(path)
  }

  if (!rootReady) {
    return (
      <div style={{ width:'100%', height:'100vh', background:'var(--bg)', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:'20px' }}>
        <h1 style={{ fontFamily:FONT_SERIF, fontStyle:'italic', color:'var(--text)', fontSize:'32px', fontWeight:400, margin:0 }}>vibe</h1>
        <p style={{ color:'var(--muted)', fontSize:'14px', margin:0 }}>프로젝트 폴더를 선택하세요</p>
        <button onClick={handlePickFolder} style={{ background:'var(--accent-sub)', border:'1px solid var(--accent)', color:'var(--accent)', cursor:'pointer', padding:'10px 24px', borderRadius:'6px', fontSize:'14px', fontFamily:FONT_UI }}>폴더 열기…</button>
        {projects.length > 0 && (
          <div style={{ marginTop:'24px', width:'280px' }}>
            <div style={{ fontSize:'10px', textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--muted)', marginBottom:'8px' }}>Recent Projects</div>
            {projects.map((p, i) => (
              <div key={p.path} onClick={() => switchProject(p.path)}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                style={{ display:'flex', alignItems:'center', gap:'8px', padding:'6px 8px', borderRadius:'5px', cursor:'pointer', transition:'background 75ms' }}>
                <kbd style={{ fontFamily:FONT_MONO, fontSize:'10px', color:'var(--muted)', minWidth:'16px' }}>⌘{i+1}</kbd>
                <span style={{ fontFamily:FONT_SERIF, fontStyle:'italic', fontSize:'14px', color:'var(--text)' }}>{p.name}</span>
                <span style={{ fontSize:'10px', color:'var(--muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1, textAlign:'right' }}>{p.path.replace(/^\/Users\/[^/]+/, '~')}</span>
              </div>
            ))}
          </div>
        )}
        <p style={{ color:'var(--border)', fontSize:'12px', marginTop:'12px' }}>또는 CLI에서: <code style={{ color:'var(--muted)', fontFamily:FONT_MONO }}>vibe /path/to/project</code></p>
      </div>
    )
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', width:'100%', height:'100vh', background:'var(--bg)', overflow:'hidden' }}>

      {pendingAction && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.35)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
          <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'8px', padding:'24px 32px', textAlign:'center', minWidth:'280px', boxShadow:'0 8px 32px rgba(0,0,0,0.15)' }}>
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
        <div style={{ width: sidebarVisible ? '240px' : '0px', opacity: sidebarVisible ? 1 : 0, visibility: sidebarVisible ? 'visible' : 'hidden', display:'flex', flexDirection:'column', flexShrink:0, borderRight: sidebarVisible ? '1px solid var(--border)' : 'none', background:'var(--bg)', overflow:'hidden', transition:'width 0.25s ease-in-out, opacity 0.2s ease-in-out' }}>
          <FileExplorer key={rootPath} innerRef={explorerRef} onFocus={focusExplorer} onFileSelect={handleFileSelect} isFocused={activeFocus === 'explorer'} onAtRootChange={setExplorerAtRoot} refreshKey={refreshKey} activeFilePath={selectedFile?.path} changedFiles={changedFiles} />
        </div>

        <div style={{ display:'flex', flex:1, overflow:'hidden', background:'var(--surface)' }}>
          {selectedFile ? (
            <div style={{ flex: viewerFullscreen ? '0 0 100%' : 1, minWidth: viewerFullscreen ? '100%' : '40%', overflow:'hidden' }}>
              <FileViewer innerRef={viewerRef} onFocus={focusViewer} onClose={closeViewer} onToggleFullscreen={toggleViewerFullscreen} onEnterEdit={enterEditMode} onExitEdit={exitEditMode} onSave={saveFile} onEditContentChange={setEditContent} selectedFile={selectedFile} content={fileContent} isEditing={isEditing} editContent={editContent} isDirty={isDirty} isMd={isMd} isDark={isDark} isFocused={activeFocus === 'viewer'} />
            </div>
          ) : (
            <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
              <ProjectDashboard data={dashboardData} recentChanges={recentChanges} onFileOpen={handleFileSelect} />
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
            <select value={rootPath} onChange={e => switchProject(e.target.value)}
              style={{ background:'var(--bg)', border:'1px solid var(--border)', color:'var(--muted)', borderRadius:'4px', padding:'1px 4px', fontSize:'10px', fontFamily:FONT_SERIF, fontStyle:'italic', cursor:'pointer', outline:'none', maxWidth:'120px' }}>
              {projects.map((p, i) => <option key={p.path} value={p.path}>⌘{i+1} {p.name}</option>)}
            </select>
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
        </div>
      </div>
    </div>
  )
}

export default App
