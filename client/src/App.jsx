import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { Prism as SyntaxHighlighter, createElement as createHlElement } from 'react-syntax-highlighter'
import { List as VirtualList } from 'react-window'
import * as api from './api'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { oneLight }    from 'react-syntax-highlighter/dist/esm/styles/prism'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'

// font-size 12.5px × 1.76 ≈ 22. Coupled to textarea + virtualized rows — update together.
const LINE_HEIGHT_PX = 22
const EDIT_PADDING_PX = 16
// Fixed gutter width — covers up to 99,999 lines, well above the 1MB read cap.
const LINE_NUM_WIDTH = '5ch'

// Disambiguate readFile errors so the user sees why a file isn't displayed.
const formatReadError = (err) => {
  const msg = String(err?.message ?? err ?? '')
  if (/too large/i.test(msg)) {
    return '⚠ This file is larger than 1MB and cannot be displayed.\n\nVibe limits in-app file viewing to 1MB to keep the UI responsive.\nOpen it in a dedicated editor instead.'
  }
  if (/binary/i.test(msg)) return '⚠ Binary file — not displayed.'
  return `Error loading file content.\n\n${msg}`
}

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

// ── Virtualized code row (hoisted to avoid per-row style allocation while scrolling) ──
const CODE_ROW_STYLE = {
  width: 'max-content', minWidth: '100%', display: 'flex', whiteSpace: 'pre',
  fontFamily: FONT_MONO, fontSize: '12.5px', lineHeight: `${LINE_HEIGHT_PX}px`, letterSpacing: '0.01em',
}
const CODE_ROW_LINENUM_STYLE = {
  display: 'inline-block', width: LINE_NUM_WIDTH, paddingRight: '12px',
  color: 'var(--border)', userSelect: 'none', flexShrink: 0, textAlign: 'right', boxSizing: 'border-box',
  position: 'sticky', left: 0, background: 'var(--surface)', zIndex: 1,
}
const CODE_ROW_TOKEN_STYLE = { flex: '0 0 auto' }
const CodeRow = ({ index, style, rows, stylesheet, useInlineStyles }) => (
  <div style={{ ...style, ...CODE_ROW_STYLE }}>
    <span style={CODE_ROW_LINENUM_STYLE}>{index + 1}</span>
    <span style={CODE_ROW_TOKEN_STYLE}>
      {createHlElement({ node: rows[index], stylesheet, useInlineStyles, key: index })}
    </span>
  </div>
)

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
const SHORTCUTS_VIEWER_VIEW       = [['E','Edit'], ['Enter','Fullscreen'], ['Esc','Close']]
const SHORTCUTS_VIEWER_VIEW_DIRTY = [['E','Edit'], ['D','Diff'], ['Enter','Fullscreen'], ['Esc','Close']]
const SHORTCUTS_VIEWER_DIFF       = [['V','View'], ['Esc','Close']]
const SHORTCUTS_VIEWER_FULLSCREEN = [['E','Edit'], ['Enter / Esc','Exit fullscreen']]
const SHORTCUTS_VIEWER_EDIT       = [['Tab','Indent'], ['Ctrl+S','Save'], ['Esc','Exit edit']]
const SHORTCUTS_VIEWER_EDIT_MD    = [['Tab','Indent'], ['Ctrl+P','Edit/Preview'], ['Ctrl+S','Save'], ['Esc','Exit edit']]
const SHORTCUTS_EXPLORER          = [['↑↓','Navigate'], ['A','New'], ['R','Rename'], ['Del','Delete'], ['C','Copy'], ['Ctrl+B','Sidebar'], ['Enter','Open/Toggle']]

// ── Git badges ────────────────────────────────────────────────────────────────
// Two-state badge system: "touched" (modified/added/untracked/renamed) vs "deleted".
// Glyph is uniform; color carries meaning. Clean/ignored files get no badge.
const GIT_BADGE_TOUCHED = { glyph: '●', color: 'var(--accent)' }
const GIT_BADGE_DELETED = { glyph: '●', color: 'var(--muted)' }
const gitBadgeFor = (state) => {
  if (!state) return null
  if (state === 'deleted') return GIT_BADGE_DELETED
  return GIT_BADGE_TOUCHED
}

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

// ── Diff view ─────────────────────────────────────────────────────────────────
// Flatten hunks into a row list: [ {kind:'header', text}, {kind:'line', ...}, ... ]
function flattenHunks(hunks) {
  const rows = []
  for (const h of hunks) {
    rows.push({ kind: 'header', text: `@@ -${h.oldStart},${h.oldLines} +${h.newStart},${h.newLines} @@` })
    for (const l of h.lines) rows.push({ kind: 'line', line: l })
  }
  return rows
}

// Build side-by-side pairs from the linear add/del/context sequence.
function pairHunks(hunks) {
  const pairs = []
  for (const h of hunks) {
    pairs.push({ kind: 'header', text: `@@ -${h.oldStart},${h.oldLines} +${h.newStart},${h.newLines} @@` })
    let i = 0
    const lines = h.lines
    while (i < lines.length) {
      const l = lines[i]
      if (l.kind === 'context') {
        pairs.push({ kind: 'pair', left: l, right: l })
        i++
      } else if (l.kind === 'del') {
        // Pair consecutive dels with following adds (GitHub style).
        const dels = []
        while (i < lines.length && lines[i].kind === 'del') { dels.push(lines[i]); i++ }
        const adds = []
        while (i < lines.length && lines[i].kind === 'add') { adds.push(lines[i]); i++ }
        const n = Math.max(dels.length, adds.length)
        for (let k = 0; k < n; k++) pairs.push({ kind: 'pair', left: dels[k] || null, right: adds[k] || null })
      } else if (l.kind === 'add') {
        pairs.push({ kind: 'pair', left: null, right: l })
        i++
      } else {
        i++
      }
    }
  }
  return pairs
}

const DIFF_ROW_STYLE = {
  display: 'flex', whiteSpace: 'pre', fontFamily: FONT_MONO, fontSize: '12.5px',
  lineHeight: `${LINE_HEIGHT_PX}px`, letterSpacing: '0.01em', minWidth: '100%', width: 'max-content',
}
const DIFF_GUTTER = {
  display: 'inline-block', width: '3.5ch', paddingRight: '6px', textAlign: 'right',
  color: 'var(--muted)', fontSize: '11px', flexShrink: 0, userSelect: 'none',
}
const DIFF_MARK_STYLE = { display: 'inline-block', width: '1.5ch', textAlign: 'center', flexShrink: 0, userSelect: 'none' }

function DiffRowInline({ index, style, rows }) {
  const row = rows[index]
  if (row.kind === 'header') {
    return (
      <div style={{ ...style, ...DIFF_ROW_STYLE, background: 'var(--surface-2)', color: 'var(--muted)', padding: '0 12px' }}>
        {row.text}
      </div>
    )
  }
  const l = row.line
  let bg = 'transparent', mark = ' ', color = 'var(--text)'
  if (l.kind === 'add') { bg = 'color-mix(in srgb, var(--success) 12%, transparent)'; mark = '+'; color = 'var(--success)' }
  else if (l.kind === 'del') { bg = 'color-mix(in srgb, var(--error) 12%, transparent)'; mark = '−'; color = 'var(--error)' }
  return (
    <div style={{ ...style, ...DIFF_ROW_STYLE, background: bg }}>
      <span style={DIFF_GUTTER}>{l.oldNum ?? ''}</span>
      <span style={DIFF_GUTTER}>{l.newNum ?? ''}</span>
      <span style={{ ...DIFF_MARK_STYLE, color }}>{mark}</span>
      <span style={{ flex: '0 0 auto', color: 'var(--text)' }}>{l.content}</span>
    </div>
  )
}

function DiffRowSplit({ index, style, rows }) {
  const row = rows[index]
  if (row.kind === 'header') {
    return (
      <div style={{ ...style, ...DIFF_ROW_STYLE, background: 'var(--surface-2)', color: 'var(--muted)', padding: '0 12px' }}>
        {row.text}
      </div>
    )
  }
  const { left, right } = row
  const cell = (side) => {
    if (!side) return { bg: 'var(--surface-2)', num: '', content: '' }
    if (side.kind === 'add') return { bg: 'color-mix(in srgb, var(--success) 12%, transparent)', num: side.newNum ?? '', content: side.content }
    if (side.kind === 'del') return { bg: 'color-mix(in srgb, var(--error) 12%, transparent)', num: side.oldNum ?? '', content: side.content }
    return { bg: 'transparent', num: (side.oldNum ?? side.newNum) ?? '', content: side.content }
  }
  const L = cell(left), R = cell(right)
  return (
    <div style={{ ...style, display: 'flex', fontFamily: FONT_MONO, fontSize: '12.5px', lineHeight: `${LINE_HEIGHT_PX}px`, letterSpacing: '0.01em', whiteSpace: 'pre' }}>
      <div style={{ flex: 1, display: 'flex', background: L.bg, borderRight: '1px solid var(--border)', overflow: 'hidden' }}>
        <span style={DIFF_GUTTER}>{L.num}</span>
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{L.content}</span>
      </div>
      <div style={{ flex: 1, display: 'flex', background: R.bg, overflow: 'hidden' }}>
        <span style={DIFF_GUTTER}>{R.num}</span>
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{R.content}</span>
      </div>
    </div>
  )
}

function DiffView({ diff, sideBySide }) {
  const rows = useMemo(() => sideBySide ? pairHunks(diff.hunks) : flattenHunks(diff.hunks), [diff, sideBySide])
  if (diff.isBinary) {
    return <div style={{ padding: '24px', color: 'var(--muted)', fontFamily: FONT_MONO, fontSize: '12px' }}>Binary file — diff not available.</div>
  }
  if (rows.length === 0) {
    return <div style={{ padding: '24px', color: 'var(--muted)', fontFamily: FONT_MONO, fontSize: '12px' }}>No changes against HEAD.</div>
  }
  const RowComp = sideBySide ? DiffRowSplit : DiffRowInline
  return (
    <VirtualList
      rowCount={rows.length}
      rowHeight={LINE_HEIGHT_PX}
      rowProps={{ rows }}
      rowComponent={RowComp}
      overscanCount={10}
      style={{ flex: 1, overflowX: 'auto' }}
    />
  )
}

const MarkdownView = ({ content, isDark }) => {
  const components = useMemo(() => makeMarkdownComponents(isDark), [isDark])
  return (
    <div style={{ color:'var(--text)', lineHeight:'1.75', fontSize:'14px', maxWidth:'72ch' }}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={components}>{content}</ReactMarkdown>
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

function StatCard({ value, label }) {
  return (
    <div style={{ background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:'6px', padding:'8px 16px' }}>
      <div style={{ fontFamily:FONT_MONO, fontSize:'20px', fontWeight:500, color:'var(--text)', lineHeight:1.2 }}>{value}</div>
      <div style={{ fontSize:'10px', color:'var(--muted)', marginTop:'2px', textTransform:'uppercase', letterSpacing:'0.06em' }}>{label}</div>
    </div>
  )
}

const SECTION_LABEL = { fontSize:'10px', fontWeight:500, textTransform:'uppercase', letterSpacing:'0.1em', color:'var(--muted)', marginBottom:'8px' }
const DIVIDER       = { border:'none', borderTop:'1px solid var(--border)', margin:0 }

const RECENT_CHANGES_LIMIT = 5
const isHiddenFile   = (f) => f.name.startsWith('.') || f.parentDir?.startsWith('.')
const basenameOf     = (p) => p.split('/').pop()
const makeRecentEntry = (path, time) => ({ path, name: basenameOf(path), time, lineCount: 0 })

function ProjectDashboard({ data, recentChanges, onFileOpen, onRefresh, gitInfo }) {
  const [refreshing, setRefreshing] = useState(false)
  const [justRefreshed, setJustRefreshed] = useState(false)
  const handleRefresh = async () => {
    setRefreshing(true)
    setJustRefreshed(false)
    // Enforce minimum visible spin (~650ms) so the action feels real even on instant responses.
    const minSpin = new Promise(r => setTimeout(r, 650))
    try { await Promise.all([onRefresh(), minSpin]) } finally {
      setRefreshing(false)
      setJustRefreshed(true)
      setTimeout(() => setJustRefreshed(false), 900)
    }
  }
  if (!data) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:'var(--muted)', fontSize:'13px' }}>Loading…</div>
  const { projectName, projectPath, totalFiles, totalFolders, langStats, docGroups } = data
  const totalDocs = docGroups.reduce((sum, g) => sum + g.items.length, 0)

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflowY:'auto', padding:'32px 48px', gap:'32px' }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'16px' }}>
        <div style={{ minWidth:0 }}>
          <div style={{ fontFamily:FONT_SERIF, fontStyle:'italic', fontSize:'26px', fontWeight:400, color:'var(--text)', lineHeight:1.2 }}>{projectName}</div>
          <div style={{ fontFamily:FONT_MONO, fontSize:'11px', color:'var(--muted)', marginTop:'4px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{projectPath}</div>
          {gitInfo?.isRepo && (
            <div style={{ fontFamily:FONT_MONO, fontSize:'11px', color:'var(--muted)', marginTop:'6px', display:'flex', alignItems:'center', gap:'8px' }}>
              <span style={{ color:'var(--text)' }}>⎇ {gitInfo.branch || '(detached)'}</span>
              {gitInfo.dirtyCount > 0 ? (
                <span style={{ color:'var(--accent)' }}>● {gitInfo.dirtyCount} file{gitInfo.dirtyCount === 1 ? '' : 's'} changed</span>
              ) : (
                <span>clean</span>
              )}
            </div>
          )}
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          title="Refresh"
          onMouseEnter={e => { if (!refreshing) e.currentTarget.style.background = 'var(--surface-2)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          style={{ background:'transparent', border:'1px solid var(--border)', color:'var(--muted)', cursor: refreshing ? 'default' : 'pointer', padding:'6px', borderRadius:'5px', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'background 150ms ease-out' }}>
          {justRefreshed ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: refreshing ? 'spin 650ms linear infinite' : 'none' }}>
              <path d="M21 12a9 9 0 1 1-3-6.7L21 8"/>
              <path d="M21 3v5h-5"/>
            </svg>
          )}
        </button>
      </div>

      <hr style={DIVIDER} />

      <div>
        <div style={SECTION_LABEL}>Project</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'8px' }}>
          <StatCard value={totalFiles} label="Files" />
          <StatCard value={totalFolders} label="Folders" />
          <StatCard value={langStats.length} label="Languages" />
          <StatCard value={totalDocs} label="Docs" />
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
                  const gitState = gitInfo?.filesByAbs?.get(doc.path)
                  const badge = gitBadgeFor(gitState)
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
                      {badge && (
                        <span title={gitState} style={{ fontFamily:FONT_MONO, fontSize:'12px', color:badge.color, flexShrink:0, width:'12px', textAlign:'center', lineHeight:1 }}>{badge.glyph}</span>
                      )}
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
                const gitState = gitInfo?.filesByAbs?.get(item.path)
                const badge = gitBadgeFor(gitState)
                return (
                <div key={item.path + i} onClick={() => onFileOpen(item)}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  style={{ display:'flex', alignItems:'center', gap:'8px', padding:'5px 8px', borderRadius:'5px', cursor:'pointer', transition:'background 75ms' }}>
                  <span style={{ width:'6px', height:'6px', borderRadius:'50%', background:dotColor, flexShrink:0 }} />
                  <span style={{ fontSize:'13px', color:'var(--text)', flex:1 }}>{item.name}</span>
                  {badge && (
                    <span title={gitState} style={{ fontFamily:FONT_MONO, fontSize:'12px', color:badge.color, flexShrink:0, width:'12px', textAlign:'center', lineHeight:1 }}>{badge.glyph}</span>
                  )}
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

const FileExplorer = ({ onFileSelect, isFocused, onFocus, innerRef, onAtRootChange, refreshKey, activeFilePath, changedFiles, gitFiles, gitInfo }) => {
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

  // Bubble up: set of directory abs paths that contain at least one dirty file.
  // Each dirty file contributes all ancestor directories up to (but not including) root.
  const dirtyDirs = useMemo(() => {
    const set = new Set()
    const root = rootPathRef.current
    if (!gitFiles || gitFiles.size === 0) return set
    for (const absPath of gitFiles.keys()) {
      let cur = absPath
      const lastSlash = cur.lastIndexOf('/')
      if (lastSlash < 0) continue
      cur = cur.slice(0, lastSlash)
      while (cur && cur !== root && !set.has(cur)) {
        set.add(cur)
        const s = cur.lastIndexOf('/')
        if (s < 0) break
        cur = cur.slice(0, s)
      }
    }
    return set
  }, [gitFiles])

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

  // Focus + initial selection on open. naming.value intentionally excluded — re-running
  // setSelectionRange on each keystroke would wipe typed input.
  useEffect(() => {
    if (naming.active && inputRef.current) {
      inputRef.current.focus()
      if (naming.type === 'rename') {
        const dot = naming.value.lastIndexOf('.')
        inputRef.current.setSelectionRange(0, dot > 0 ? dot : naming.value.length)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [naming.active, naming.type])

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
      {/* Header — actions revealed on hover only */}
      <div
        className="explorer-header"
        style={{ padding:'10px 16px 6px', fontSize:'10px', fontWeight:500, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.08em', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}
      >
        <span>Explorer</span>
        <div className="explorer-actions" style={{ display:'flex', gap:'14px' }}>
          {[['New file (A)', 'file', 'new file'], ['New folder (Shift+A)', 'dir', 'new folder']].map(([title, type, label]) => (
            <button key={type} title={title}
              onClick={() => setNaming({ active:true, type, value:'', oldPath:'', parentPath: rootPathRef.current })}
              onMouseEnter={e => { e.currentTarget.style.color='var(--text)' }}
              onMouseLeave={e => { e.currentTarget.style.color='var(--muted)' }}
              style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', padding:0, fontFamily:FONT_SERIF, fontStyle:'italic', fontSize:'13px', letterSpacing:'0', textTransform:'none', lineHeight:1, transition:'color 150ms' }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Git status line — hidden entirely when not a repo */}
      {gitInfo?.isRepo && (
        <div style={{ padding:'0 16px 8px', fontSize:'11px', fontFamily:FONT_MONO, color:'var(--muted)', display:'flex', alignItems:'center', gap:'8px', flexShrink:0, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
          <span style={{ color:'var(--text)' }} title="Current branch">⎇ {gitInfo.branch || '(detached)'}</span>
          {gitInfo.dirtyCount > 0 ? (
            <span style={{ color:'var(--accent)' }}>● {gitInfo.dirtyCount}</span>
          ) : (
            <span style={{ color:'var(--muted)' }}>clean</span>
          )}
        </div>
      )}

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

                  {(() => {
                    // File: direct git state. Directory: bubble up if collapsed and has dirty descendants.
                    let badge = null
                    let title = ''
                    if (item.isDirectory) {
                      if (!isExpanded && dirtyDirs?.has(item.path)) {
                        badge = GIT_BADGE_TOUCHED
                        title = 'contains changes'
                      }
                    } else {
                      const gitState = gitFiles?.get(item.path)
                      badge = gitBadgeFor(gitState)
                      title = gitState || ''
                    }
                    if (!badge) return null
                    return (
                      <span title={title} style={{ fontFamily:FONT_MONO, fontSize:'12px', color:badge.color, flexShrink:0, width:'12px', textAlign:'center', lineHeight:1 }}>
                        {badge.glyph}
                      </span>
                    )
                  })()}

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
  gitDirty, diffMode, onEnterDiff, onExitDiff,
}) => {
  const [mdTab, setMdTab] = useState('edit')
  const [diffData, setDiffData] = useState(null)
  const [diffError, setDiffError] = useState('')
  const [diffSideBySide, setDiffSideBySide] = useState(false)
  const textareaRef       = useRef(null)
  const lineNumbersRef    = useRef(null)
  const ext = selectedFile?.name.split('.').pop()?.toLowerCase() ?? ''
  const langBadge = EXT_TO_DISPLAY[ext] || ext || '—'

  // textarea padding-top offsets the line-number gutter so line "1" aligns with the first text line.
  const handleTextareaScroll = useCallback((e) => {
    if (lineNumbersRef.current) {
      lineNumbersRef.current.style.transform = `translateY(${EDIT_PADDING_PX - e.currentTarget.scrollTop}px)`
    }
  }, [])

  useEffect(() => { setMdTab('edit'); setDiffData(null); setDiffError(''); setDiffSideBySide(false) }, [selectedFile])
  useEffect(() => { if (isEditing && textareaRef.current) textareaRef.current.focus() }, [isEditing])

  // Fetch diff when entering diff mode (or when file re-changes while already in diff).
  useEffect(() => {
    if (!diffMode || !selectedFile) return
    let cancelled = false
    setDiffError('')
    api.gitDiff(selectedFile.path)
      .then(d => { if (!cancelled) setDiffData(d) })
      .catch(err => { if (!cancelled) { setDiffError(String(err?.message ?? err)); setDiffData(null) } })
    return () => { cancelled = true }
  }, [diffMode, selectedFile, content])

  useEffect(() => {
    if (!isFocused || isEditing) return
    const handle = (e) => {
      const k = resolveKey(e.key).toLowerCase()
      if (diffMode) {
        // Shift+D must be checked before plain d (split/inline toggle vs exit).
        if (e.shiftKey && k === 'd') { e.preventDefault(); setDiffSideBySide(p => !p) }
        else if (k === 'v' || k === 'd') { e.preventDefault(); onExitDiff() }
        return
      }
      if (e.key === 'Enter') { e.preventDefault(); onToggleFullscreen() }
      else if (k === 'e') { e.preventDefault(); onEnterEdit() }
      else if (k === 'd' && gitDirty) { e.preventDefault(); onEnterDiff() }
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [isFocused, isEditing, diffMode, gitDirty, onToggleFullscreen, onEnterEdit, onEnterDiff, onExitDiff])

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

  const showDiff        = !!selectedFile && diffMode && !isEditing
  const showEditPane    = isEditing && (!isMd || mdTab === 'edit')
  const showPreviewPane = isEditing && isMd && mdTab === 'preview'
  const isCodeView      = !!selectedFile && !isMd && !showEditPane && !showPreviewPane && !showDiff
  const isFlexLayout    = showEditPane || isCodeView || showDiff
  const activeContent   = isEditing ? editContent : content
  const lineCount       = useMemo(() => activeContent.split('\n').length, [activeContent])
  const lineNumbersText = useMemo(
    () => Array.from({ length: lineCount }, (_, i) => String(i + 1)).join('\n'),
    [lineCount]
  )
  const syntaxStyle     = isDark ? vscDarkPlus : oneLight

  useEffect(() => {
    if (lineNumbersRef.current) lineNumbersRef.current.style.transform = `translateY(${EDIT_PADDING_PX}px)`
  }, [selectedFile, isEditing])

  const codeRenderer = useCallback(({ rows, stylesheet, useInlineStyles }) => (
    <VirtualList
      rowCount={rows.length}
      rowHeight={LINE_HEIGHT_PX}
      rowProps={{ rows, stylesheet, useInlineStyles }}
      rowComponent={CodeRow}
      overscanCount={5}
      style={{ overflowX: 'auto' }}
    />
  ), [])

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
          ) : diffMode ? (
            <>
              <button onClick={() => setDiffSideBySide(p => !p)} title="Shift+D"
                style={{ background: diffSideBySide ? 'var(--accent-sub)' : 'none', border:`1px solid ${diffSideBySide ? 'var(--accent)' : 'var(--border)'}`, color: diffSideBySide ? 'var(--accent)' : 'var(--muted)', cursor:'pointer', fontSize:'11px', padding:'2px 8px', borderRadius:'4px', fontFamily:FONT_UI }}>
                {diffSideBySide ? 'Split' : 'Inline'}
              </button>
              <button onClick={onExitDiff} style={{ background:'none', border:'1px solid var(--border)', color:'var(--muted)', cursor:'pointer', fontSize:'11px', padding:'2px 8px', borderRadius:'4px', fontFamily:FONT_UI }}>V View</button>
            </>
          ) : (
            <>
              {gitDirty && (
                <button onClick={onEnterDiff} title="D Diff"
                  onMouseEnter={e => { e.currentTarget.style.background='var(--surface-2)'; e.currentTarget.style.borderColor='var(--accent)'; e.currentTarget.style.color='var(--text)' }}
                  onMouseLeave={e => { e.currentTarget.style.background='none'; e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.color='var(--muted)' }}
                  style={{ background:'none', border:'1px solid var(--border)', color:'var(--muted)', cursor:'pointer', fontSize:'11px', padding:'2px 8px', borderRadius:'4px', fontFamily:FONT_UI, transition:'all 150ms' }}>D Diff</button>
              )}
              <button onClick={onEnterEdit}
                onMouseEnter={e => { e.currentTarget.style.background='var(--surface-2)'; e.currentTarget.style.borderColor='var(--accent)'; e.currentTarget.style.color='var(--text)' }}
                onMouseLeave={e => { e.currentTarget.style.background='none'; e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.color='var(--muted)' }}
                style={{ background:'none', border:'1px solid var(--border)', color:'var(--muted)', cursor:'pointer', fontSize:'11px', padding:'2px 8px', borderRadius:'4px', fontFamily:FONT_UI, transition:'all 150ms' }}>E Edit</button>
            </>
          )}
          <span style={{ fontFamily:FONT_MONO, fontSize:'11px', color:'var(--muted)', minWidth:'52px', textAlign:'right' }}>{lineCount} lines</span>
          <button onClick={onClose} style={{ background:'transparent', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:'16px', lineHeight:1, padding:'0 2px' }}>&times;</button>
        </div>
      </div>

      {/* Content — code viewer & edit pane fill via flex; markdown flows in scroll container. */}
      <div style={{ flex:1, overflow: isFlexLayout ? 'hidden' : 'auto', padding: isFlexLayout ? '0' : isMd ? '24px 32px' : '0', display: isFlexLayout ? 'flex' : 'block', flexDirection:'column', minHeight:0 }}>
        {selectedFile && (
          showDiff ? (
            diffError ? <div style={{ padding:'24px', color:'var(--error)', fontFamily:FONT_MONO, fontSize:'12px', whiteSpace:'pre-wrap' }}>Diff failed: {diffError}</div>
            : !diffData ? <div style={{ padding:'24px', color:'var(--muted)', fontSize:'12px' }}>Loading diff…</div>
            : <DiffView diff={diffData} sideBySide={diffSideBySide} />
          ) : showEditPane ? (
            <div style={{ display:'flex', flex:1, overflow:'hidden', minHeight:0 }}>
              <pre ref={lineNumbersRef} style={{
                margin: 0,
                padding: `0 12px 0 0`,
                width: LINE_NUM_WIDTH,
                flexShrink: 0,
                overflow: 'hidden',
                borderRight: '1px solid var(--border)',
                background: 'var(--surface)',
                fontFamily: FONT_MONO,
                fontSize: '12.5px',
                lineHeight: `${LINE_HEIGHT_PX}px`,
                color: 'var(--border)',
                textAlign: 'right',
                userSelect: 'none',
                whiteSpace: 'pre',
                transform: `translateY(${EDIT_PADDING_PX}px)`,
                willChange: 'transform',
              }}>{lineNumbersText}</pre>
              <textarea ref={textareaRef} value={editContent} onChange={e => onEditContentChange(e.target.value)} onKeyDown={handleTextareaKeyDown}
                onScroll={handleTextareaScroll}
                spellCheck={false}
                wrap="off"
                style={{ flex:1, background:'var(--surface)', color:'var(--text)', border:'none', outline:'none', resize:'none', padding:`${EDIT_PADDING_PX}px`, fontFamily:FONT_MONO, fontSize:'12.5px', lineHeight:`${LINE_HEIGHT_PX}px`, letterSpacing:'0.01em', whiteSpace:'pre' }} />
            </div>
          ) : showPreviewPane ? (
            <MarkdownView content={editContent} isDark={isDark} />
          ) : isMd ? (
            <MarkdownView content={content} isDark={isDark} />
          ) : (
            <SyntaxHighlighter
              language={ext || 'text'}
              style={syntaxStyle}
              wrapLines
              renderer={codeRenderer}
              PreTag="div"
              CodeTag="div"
              customStyle={{ margin:0, padding:0, background:'transparent', display:'flex', flexDirection:'column', flex:1, minHeight:0 }}
              codeTagProps={{ style: { display:'flex', flexDirection:'column', flex:1, minHeight:0 } }}
            >
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
  const list = loadProjects()
  // Already known → preserve index so Cmd+N stays stable.
  if (list.some(p => p.path === path)) return list
  const name = basenameOf(path)
  list.unshift({ path, name })
  if (list.length > 10) list.length = 10
  saveProjects(list)
  return list
}
const removeProject = (path) => {
  const list = loadProjects().filter(p => p.path !== path)
  saveProjects(list)
  return list
}
// `slot` is the target insertion point in the pre-removal array (0..length).
// After removing `fromIdx`, slots > fromIdx shift left by 1.
const reorderProjects = (fromIdx, slot) => {
  const list = loadProjects()
  if (fromIdx < 0 || fromIdx >= list.length || slot < 0 || slot > list.length) return list
  if (slot === fromIdx || slot === fromIdx + 1) return list // same position
  const [item] = list.splice(fromIdx, 1)
  const insertAt = slot > fromIdx ? slot - 1 : slot
  list.splice(insertAt, 0, item)
  saveProjects(list)
  return list
}

// ── Footer project dropdown (custom; native <select> can't render Instrument Serif) ──
function ProjectDropdown({ projects, currentPath, onSelect }) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef(null)
  const menuRef = useRef(null)
  useEffect(() => {
    if (!open) return
    const onDocClick = (e) => {
      if (menuRef.current?.contains(e.target) || btnRef.current?.contains(e.target)) return
      setOpen(false)
    }
    const onKey = (e) => { if (e.key === 'Escape') { setOpen(false); e.stopPropagation() } }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open])
  const current = projects.find(p => p.path === currentPath)
  if (!current) return null
  return (
    <div style={{ position:'relative' }}>
      <button ref={btnRef} onClick={() => setOpen(o => !o)}
        style={{ background:'var(--bg)', border:'1px solid var(--border)', color:'var(--muted)', borderRadius:'4px', padding:'1px 8px', fontSize:'11px', fontFamily:FONT_SERIF, fontStyle:'italic', cursor:'pointer', outline:'none', maxWidth:'140px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
        {current.name} ▾
      </button>
      {open && (
        <div ref={menuRef}
          style={{ position:'absolute', bottom:'calc(100% + 6px)', right:0, background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'6px', padding:'4px 0', minWidth:'200px', boxShadow:'0 6px 20px rgba(0,0,0,0.18)', zIndex:100 }}>
          {projects.map((p, i) => {
            const active = p.path === currentPath
            return (
              <div key={p.path}
                onClick={() => { onSelect(p.path); setOpen(false) }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--surface-2)' }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
                style={{ display:'flex', alignItems:'center', gap:'10px', padding:'6px 12px', cursor:'pointer',
                         fontFamily:FONT_SERIF, fontStyle:'normal', fontSize:'13px',
                         color: active ? 'var(--accent)' : 'var(--text)',
                         background: active ? 'var(--accent-sub)' : 'transparent' }}>
                <kbd style={{ fontFamily:FONT_MONO, fontSize:'10px', color:'var(--muted)', minWidth:'18px', fontStyle:'normal' }}>⌘{i+1}</kbd>
                <span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── No-root screen (project picker + Recent Projects with pointer-based reorder/delete) ──
function NoRootScreen({ projects, onOpen, onPick, onProjectsChange }) {
  const [hoverIdx, setHoverIdx] = useState(null)
  const dragRef = useRef(null)
  const listenersRef = useRef(null) // for cleanup on unmount
  const listRef = useRef(null)
  const [drag, setDrag] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  // Clean up window listeners if component unmounts mid-drag
  useEffect(() => () => {
    if (listenersRef.current) {
      window.removeEventListener('pointermove', listenersRef.current.onMove)
      window.removeEventListener('pointerup', listenersRef.current.onUp)
      listenersRef.current = null
    }
  }, [])

  const handleDelete = (e, path) => {
    e.stopPropagation()
    setConfirmDelete(path)
  }
  const doDelete = () => {
    if (confirmDelete) onProjectsChange(removeProject(confirmDelete))
    setConfirmDelete(null)
  }

  const handlePointerDown = (e, i) => {
    if (e.button !== 0) return
    if (e.target.tagName === 'BUTTON') return
    const startY = e.clientY
    let activated = false

    const onMove = (me) => {
      if (!activated) {
        if (Math.abs(me.clientY - startY) < 5) return
        activated = true
        dragRef.current = { idx: i, slot: i }
        setDrag({ idx: i, slot: i })
      }
      if (!dragRef.current || !listRef.current) return
      const rows = listRef.current.children
      let slot = rows.length
      for (let r = 0; r < rows.length; r++) {
        const rect = rows[r].getBoundingClientRect()
        if (me.clientY < rect.top + rect.height / 2) { slot = r; break }
      }
      if (dragRef.current.slot !== slot) {
        dragRef.current.slot = slot
        setDrag({ idx: dragRef.current.idx, slot })
      }
    }

    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      listenersRef.current = null
      if (dragRef.current) {
        const { idx, slot } = dragRef.current
        dragRef.current = null
        setDrag(null)
        onProjectsChange(reorderProjects(idx, slot))
      }
    }

    listenersRef.current = { onMove, onUp }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return (
    <div style={{ width:'100%', height:'100vh', background:'var(--bg)', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:'20px' }}>
      <h1 style={{ fontFamily:FONT_SERIF, fontStyle:'italic', color:'var(--text)', fontSize:'32px', fontWeight:400, margin:0 }}>vibe</h1>
      <p style={{ color:'var(--muted)', fontSize:'14px', margin:0 }}>프로젝트 폴더를 선택하세요</p>
      <button onClick={onPick} style={{ background:'var(--accent-sub)', border:'1px solid var(--accent)', color:'var(--accent)', cursor:'pointer', padding:'10px 24px', borderRadius:'6px', fontSize:'14px', fontFamily:FONT_UI }}>폴더 열기…</button>
      {projects.length > 0 && (
        <div style={{ marginTop:'24px', width:'320px' }}>
          <div style={{ fontSize:'10px', textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--muted)', marginBottom:'8px', display:'flex', justifyContent:'space-between' }}>
            <span>Recent Projects</span>
            <span style={{ fontSize:'9px', color:'var(--border)', textTransform:'none', letterSpacing:0, fontStyle:'italic', fontFamily:FONT_SERIF }}>drag to reorder</span>
          </div>
          <div ref={listRef}>
          {projects.map((p, i) => {
            const isDragging = drag && drag.idx === i
            const showAbove = drag && drag.slot === i     && drag.slot !== drag.idx && drag.slot !== drag.idx + 1
            const showBelow = drag && drag.slot === i + 1 && drag.slot !== drag.idx && drag.slot !== drag.idx + 1
            return (
              <div key={p.path}
                onPointerDown={e => handlePointerDown(e, i)}
                onDragStart={e => e.preventDefault()}
                onClick={() => { if (!dragRef.current) onOpen(p.path) }}
                onMouseEnter={() => setHoverIdx(i)}
                onMouseLeave={() => setHoverIdx(null)}
                style={{ display:'flex', alignItems:'center', gap:'8px', padding:'6px 8px', borderRadius:'5px', cursor: isDragging ? 'grabbing' : 'pointer',
                         background: hoverIdx === i && !drag ? 'var(--surface-2)' : 'transparent',
                         opacity: isDragging ? 0.4 : 1,
                         borderTop:    showAbove ? '2px solid var(--accent)' : '2px solid transparent',
                         borderBottom: showBelow ? '2px solid var(--accent)' : '2px solid transparent',
                         transition:'background 75ms, opacity 75ms', userSelect:'none', WebkitUserSelect:'none' }}>
                <span style={{ fontSize:'10px', color:'var(--border)', fontFamily:FONT_MONO, cursor:'grab', userSelect:'none' }}>⋮⋮</span>
                <kbd style={{ fontFamily:FONT_MONO, fontSize:'10px', color:'var(--muted)', minWidth:'16px' }}>⌘{i+1}</kbd>
                <span style={{ fontFamily:FONT_SERIF, fontStyle:'italic', fontSize:'14px', color:'var(--text)' }}>{p.name}</span>
                <span style={{ fontSize:'10px', color:'var(--muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1, textAlign:'right' }}>{p.path.replace(/^\/Users\/[^/]+/, '~')}</span>
                {hoverIdx === i && !drag && (
                  <button onClick={e => handleDelete(e, p.path)} title="Remove"
                    style={{ background:'transparent', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:'14px', padding:'0 4px', lineHeight:1, flexShrink:0 }}>×</button>
                )}
              </div>
            )
          })}
          </div>
        </div>
      )}
      <p style={{ color:'var(--border)', fontSize:'12px', marginTop:'12px' }}>또는 CLI에서: <code style={{ color:'var(--muted)', fontFamily:FONT_MONO }}>vibe /path/to/project</code></p>

      {confirmDelete && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.35)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}
          onClick={() => setConfirmDelete(null)}>
          <div onClick={e => e.stopPropagation()}
            style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'8px', padding:'24px 32px', textAlign:'center', minWidth:'280px', boxShadow:'0 8px 32px rgba(0,0,0,0.15)' }}>
            <p style={{ margin:'0 0 6px', color:'var(--text)', fontSize:'14px' }}>
              <span style={{ fontFamily:FONT_SERIF, fontStyle:'italic' }}>{basenameOf(confirmDelete)}</span>
            </p>
            <p style={{ margin:'0 0 20px', color:'var(--muted)', fontSize:'12px' }}>최근 프로젝트에서 제거할까요?</p>
            <div style={{ display:'flex', gap:'8px', justifyContent:'center' }}>
              <button onClick={doDelete}
                style={{ background:'var(--error)', border:'none', color:'#fff', cursor:'pointer', padding:'6px 16px', borderRadius:'4px', fontSize:'13px', fontFamily:FONT_UI }}>제거</button>
              <button onClick={() => setConfirmDelete(null)}
                style={{ background:'transparent', border:'1px solid var(--border)', color:'var(--muted)', cursor:'pointer', padding:'6px 16px', borderRadius:'4px', fontSize:'13px', fontFamily:FONT_UI }}>취소</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
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
  const rootPathRef        = useRef('')
  const requireCleanRef    = useRef(null)
  const handleEscapeKeyRef = useRef(null)

  const [rootReady, setRootReady]               = useState(false)
  const [selectedFile, setSelectedFile]         = useState(null)
  const [fileContent, setFileContent]           = useState('')
  const [isEditing, setIsEditing]               = useState(false)
  const [diffMode, setDiffMode]                 = useState(false)
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
  const [gitInfo, setGitInfo]                   = useState({ isRepo: false, branch: null, filesByAbs: new Map(), dirtyCount: 0 })
  const gitRefetchTimerRef                      = useRef(null)

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
  rootPathRef.current         = rootPath

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
        // (dirtyDirs useMemo, Explorer tree, Dashboard badges) on every watcher tick.
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
  }, [])

  const loadDashboard = useCallback(async () => {
    try {
      const listWithMtime = (path) => api.listFiles(path, { includeMtime: true })
      const rootData = await listWithMtime('')
      const rootItems = rootData.items || []
      const allFiles = []
      let totalFolders = 0
      rootItems.forEach(item => { if (!item.isDirectory) allFiles.push(item); else totalFolders++ })
      const subDirScans = []
      await Promise.all(rootItems.filter(f => f.isDirectory).map(async (dir) => {
        try {
          const sub = await listWithMtime(dir.path)
          ;(sub.items || []).forEach(item => {
            if (!item.isDirectory) allFiles.push({ ...item, parentDir: dir.name })
            else { totalFolders++; if (DOC_FOLDERS.has(dir.name.toLowerCase())) subDirScans.push({ dirPath: item.path, parentDir: dir.name + '/' + item.name }) }
          })
        } catch (_) {}
      }))
      // Scan one more level inside doc folders (e.g. docs/subfolder/*.md)
      await Promise.all(subDirScans.map(async ({ dirPath, parentDir }) => {
        try { const sub = await listWithMtime(dirPath); (sub.items || []).forEach(item => { if (!item.isDirectory) allFiles.push({ ...item, parentDir }) }) } catch (_) {}
      }))
      const extCounts = {}, docs = []
      allFiles.forEach(file => {
        if (isHiddenFile(file)) return
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
      const recentFiles = allFiles
        .filter(f => f.modifiedMs && !isHiddenFile(f))
        .sort((a, b) => b.modifiedMs - a.modifiedMs)
        .slice(0, RECENT_CHANGES_LIMIT)
        .map(f => makeRecentEntry(f.path, f.modifiedMs))
      setRecentChanges(recentFiles)
      setDashboardData({ projectName: rootData.currentPath?.split('/').pop() || 'project', projectPath: rootData.currentPath || '', totalFiles: allFiles.length, totalFolders, langStats, docGroups })
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
    setGitInfo({ isRepo: false, branch: null, filesByAbs: new Map(), dirtyCount: 0 })
    setRootPath(path)
    const list = addProject(path)
    setProjects(list)
    setRefreshKey(k => k + 1)
    setRootReady(true)
    // loadDashboard + loadGitStatus fire via the rootReady/rootPath effect below.
  }, [])

  useEffect(() => {
    api.getRoot().then(r => {
      if (r) { const list = addProject(r); setProjects(list) }
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
        const newEntries = paths.map(p => makeRecentEntry(p, now))
        setRecentChanges(prev => [...newEntries, ...prev.filter(e => !paths.includes(e.path))].slice(0, RECENT_CHANGES_LIMIT))
        // Fetch line counts async (batched update)
        Promise.all(newEntries.map(entry =>
          api.readFile(entry.path).then(d => ({ path: entry.path, time: entry.time, lineCount: (d.content || '').split('\n').length })).catch(() => null)
        )).then(results => {
          const counts = Object.fromEntries(results.filter(Boolean).map(r => [r.path + r.time, r.lineCount]))
          if (Object.keys(counts).length > 0) setRecentChanges(prev => prev.map(e => counts[e.path + e.time] ? { ...e, lineCount: counts[e.path + e.time] } : e))
        })
      }
      if (selectedFileRef.current && paths.includes(selectedFileRef.current.path)) {
        if (!isEditingRef.current) api.readFile(selectedFileRef.current.path).then(d => setFileContent(d.content || '')).catch(err => setFileContent(formatReadError(err)))
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
  const gitDirty = !!(selectedFile && gitInfo.filesByAbs.has(selectedFile.path))

  const footerShortcuts = useMemo(() => {
    if (activeFocus === 'viewer') {
      if (isEditing) return isMd ? SHORTCUTS_VIEWER_EDIT_MD : SHORTCUTS_VIEWER_EDIT
      if (diffMode) return SHORTCUTS_VIEWER_DIFF
      if (viewerFullscreen) return SHORTCUTS_VIEWER_FULLSCREEN
      return gitDirty ? SHORTCUTS_VIEWER_VIEW_DIRTY : SHORTCUTS_VIEWER_VIEW
    }
    return SHORTCUTS_EXPLORER
  }, [activeFocus, isEditing, isMd, viewerFullscreen, diffMode, gitDirty])

  const handlePickFolder = async () => {
    const path = await api.pickFolder()
    if (path) await switchProject(path)
  }

  if (!rootReady) {
    return <NoRootScreen projects={projects} onOpen={switchProject} onPick={handlePickFolder} onProjectsChange={setProjects} />
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
          <FileExplorer key={rootPath} innerRef={explorerRef} onFocus={focusExplorer} onFileSelect={handleFileSelect} isFocused={activeFocus === 'explorer'} onAtRootChange={setExplorerAtRoot} refreshKey={refreshKey} activeFilePath={selectedFile?.path} changedFiles={changedFiles} gitFiles={gitInfo.filesByAbs} gitInfo={gitInfo} />
        </div>

        <div style={{ display:'flex', flex:1, overflow:'hidden', background:'var(--surface)' }}>
          {selectedFile ? (
            <div style={{ flex: viewerFullscreen ? '0 0 100%' : 1, minWidth: viewerFullscreen ? '100%' : '40%', overflow:'hidden' }}>
              <FileViewer innerRef={viewerRef} onFocus={focusViewer} onClose={closeViewer} onToggleFullscreen={toggleViewerFullscreen} onEnterEdit={enterEditMode} onExitEdit={exitEditMode} onSave={saveFile} onEditContentChange={setEditContent} selectedFile={selectedFile} content={fileContent} isEditing={isEditing} editContent={editContent} isDirty={isDirty} isMd={isMd} isDark={isDark} isFocused={activeFocus === 'viewer'} gitDirty={gitDirty} diffMode={diffMode} onEnterDiff={enterDiffMode} onExitDiff={exitDiffMode} />
            </div>
          ) : (
            <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
              <ProjectDashboard data={dashboardData} recentChanges={recentChanges} onFileOpen={handleFileSelect} onRefresh={() => Promise.all([loadDashboard(), loadGitStatus(rootPath)])} gitInfo={gitInfo} />
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
        </div>
      </div>
    </div>
  )
}

export default App
