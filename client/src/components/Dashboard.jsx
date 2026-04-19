import { useState, useCallback, useMemo } from 'react'
import { FONT_MONO, FONT_SERIF, SECTION_LABEL, DIVIDER, EXT_TO_LANG, LANG_COLORS, formatAge, getDocIcon, gitBadgeFor, gitStateLabel } from '../constants'

const COLLAPSED_KEY = 'vibe-dashboard-collapsed'
const PINNED_KEY    = 'vibe-dashboard-pinned'
function loadCollapsed() { try { return new Set(JSON.parse(localStorage.getItem(COLLAPSED_KEY))) } catch { return new Set() } }
function saveCollapsed(set) { localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...set])) }
function loadPinned()    { try { return new Set(JSON.parse(localStorage.getItem(PINNED_KEY)))    } catch { return new Set() } }
function savePinned(set) { localStorage.setItem(PINNED_KEY,    JSON.stringify([...set])) }

function StatCard({ value, label }) {
  return (
    <div style={{ background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:'6px', padding:'8px 16px' }}>
      <div style={{ fontFamily:FONT_MONO, fontSize:'20px', fontWeight:500, color:'var(--text)', lineHeight:1.2 }}>{value}</div>
      <div style={{ fontSize:'10px', color:'var(--muted)', marginTop:'2px', textTransform:'uppercase', letterSpacing:'0.06em' }}>{label}</div>
    </div>
  )
}

function DocItem({ doc, gitInfo, isPinned, onTogglePin, onFileOpen }) {
  const [hovered, setHovered] = useState(false)
  const icon = getDocIcon(doc.name)
  const gitState = gitInfo?.filesByAbs?.get(doc.path)
  const badge = gitBadgeFor(gitState)
  return (
    <div
      onClick={() => onFileOpen(doc)}
      draggable onDragStart={e => { e.dataTransfer.setData('text/plain', doc.path); e.dataTransfer.effectAllowed = 'copy' }}
      onMouseEnter={e => { setHovered(true); e.currentTarget.style.background = 'var(--accent-sub)'; e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--accent) 20%, transparent)' }}
      onMouseLeave={e => { setHovered(false); e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent' }}
      style={{ display:'flex', alignItems:'center', gap:'8px', padding:'6px 8px', borderRadius:'6px', cursor:'pointer', border:'1px solid transparent', transition:'background 75ms, border-color 75ms' }}>
      <span style={{ fontSize:'14px', width:'20px', textAlign:'center', flexShrink:0, color:'var(--muted)' }}>{icon}</span>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:'13px', fontWeight:500, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{doc.name}</div>
        {doc.desc && <div style={{ fontSize:'11px', color:'var(--muted)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{doc.desc}</div>}
      </div>
      {(hovered || isPinned) && (
        <button
          onClick={e => { e.stopPropagation(); onTogglePin(doc.path) }}
          title={isPinned ? 'Unpin' : 'Pin'}
          style={{ background:'none', border:'none', cursor:'pointer', padding:'0 2px', color: isPinned ? '#E8B84B' : 'var(--muted)', fontSize:'11px', flexShrink:0, lineHeight:1, opacity: isPinned ? 1 : 0.5 }}>
          {isPinned ? '◆' : '◇'}
        </button>
      )}
      {badge && (
        <span title={gitStateLabel(gitState)} style={{ fontFamily:FONT_MONO, fontSize:'12px', color:badge.color, flexShrink:0, width:'12px', textAlign:'center', lineHeight:1 }}>{badge.glyph}</span>
      )}
      {doc.lineCount > 0 && (
        <span style={{ fontFamily:FONT_MONO, fontSize:'10px', color:'var(--muted)', flexShrink:0 }}>{doc.lineCount} lines</span>
      )}
    </div>
  )
}

function relPathFrom(abs, root) {
  if (!abs) return ''
  if (root && abs.startsWith(root + '/')) return abs.slice(root.length + 1)
  return abs
}

function BrokenLinksSection({ items, onFileOpen, rootPath }) {
  if (!items || items.length === 0) return null
  return (
    <>
      <hr style={DIVIDER} />
      <div>
        <div style={SECTION_LABEL}>Broken Links ({items.length})</div>
        <div style={{ display:'flex', flexDirection:'column', gap:'2px', maxHeight:'260px', overflowY:'auto' }}>
          {items.map((b, i) => (
            <div
              key={`${b.source}:${b.line}:${i}`}
              onClick={() => onFileOpen({ path: b.source, name: b.source.split('/').pop(), isDirectory: false })}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              style={{ padding:'6px 8px', borderRadius:'6px', cursor:'pointer', transition:'background 75ms', borderLeft:'2px solid var(--error)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                <span style={{ fontFamily:FONT_MONO, fontSize:'11.5px', color:'var(--accent)' }}>{relPathFrom(b.source, rootPath)}</span>
                <span style={{ fontFamily:FONT_MONO, fontSize:'11px', color:'var(--muted)' }}>:{b.line}</span>
                <span style={{ fontSize:'10px', color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.05em' }}>{b.kind}</span>
              </div>
              <div style={{ fontFamily:FONT_MONO, fontSize:'11.5px', color:'var(--error)', marginTop:'2px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                → {b.rawHref}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

function OrphanDocsSection({ paths, onFileOpen, rootPath }) {
  if (!paths || paths.length === 0) return null
  return (
    <>
      <hr style={DIVIDER} />
      <div>
        <div style={SECTION_LABEL}>Orphan Docs ({paths.length})</div>
        <div style={{ display:'flex', flexDirection:'column', gap:'2px', maxHeight:'220px', overflowY:'auto' }}>
          {paths.map((p) => (
            <div
              key={p}
              onClick={() => onFileOpen({ path: p, name: p.split('/').pop(), isDirectory: false })}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-2)'; e.currentTarget.style.color = 'var(--accent)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted)' }}
              style={{ fontFamily:FONT_MONO, fontSize:'12px', color:'var(--muted)', padding:'5px 8px', borderRadius:'6px', cursor:'pointer', transition:'background 75ms, color 75ms', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {relPathFrom(p, rootPath)}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

export default function ProjectDashboard({ data, recentChanges, brokenLinks, orphanDocs, onFileOpen, onRefresh, refreshing, justRefreshed, gitInfo }) {
  const [collapsed, setCollapsed] = useState(loadCollapsed)
  const [pinned, setPinned] = useState(loadPinned)

  const toggleGroup = useCallback((groupName) => {
    setCollapsed(prev => {
      const next = new Set(prev)
      next.has(groupName) ? next.delete(groupName) : next.add(groupName)
      saveCollapsed(next)
      return next
    })
  }, [])

  const togglePin = useCallback((path) => {
    setPinned(prev => {
      const next = new Set(prev)
      next.has(path) ? next.delete(path) : next.add(path)
      savePinned(next)
      return next
    })
  }, [])

  const docGroups = data?.docGroups
  const allDocs    = useMemo(() => docGroups?.flatMap(g => g.items) ?? [], [docGroups])

  if (!data) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:'var(--muted)', fontSize:'13px' }}>Loading…</div>
  const { projectName, projectPath, totalFiles, totalFolders, langStats } = data
  const totalDocs = allDocs.length

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflowY:'auto', padding:'32px 48px', gap:'32px', userSelect:'text', WebkitUserSelect:'text' }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'16px' }}>
        <div style={{ minWidth:0 }}>
          <div className="vibe-logo" style={{ fontSize:'26px', fontWeight:400 }}>{projectName}</div>
          <div style={{ fontFamily:FONT_MONO, fontSize:'11px', color:'var(--muted)', marginTop:'4px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{projectPath}</div>
          {gitInfo?.isRepo && (
            <div style={{ fontFamily:FONT_MONO, fontSize:'11px', color:'var(--muted)', marginTop:'6px', display:'flex', alignItems:'center', gap:'8px' }}>
              <span style={{ color:'var(--text)' }}>⎇ {gitInfo.branch || '(detached)'}</span>
              {gitInfo.dirtyCount > 0 ? (
                <span style={{ color:'var(--accent)' }}>~ {gitInfo.dirtyCount} changed</span>
              ) : (
                <span>clean</span>
              )}
            </div>
          )}
        </div>
        <button
          onClick={onRefresh}
          disabled={refreshing}
          title="Refresh"
          onMouseEnter={e => { if (!refreshing) e.currentTarget.style.background = 'var(--surface-2)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          style={{ background:'transparent', border:'1px solid var(--border)', color:'var(--muted)', cursor: refreshing ? 'default' : 'pointer', padding:'6px', borderRadius:'6px', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'background 150ms ease-out' }}>
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
            {docGroups.map((group, gi) => {
              const groupKey = group.group || `__root_${gi}`
              const isCollapsed = collapsed.has(groupKey)
              const sortedItems = [...group.items].sort((a, b) => {
                const ap = pinned.has(a.path) ? 0 : 1
                const bp = pinned.has(b.path) ? 0 : 1
                return ap - bp
              })
              if (sortedItems.length === 0 && group.group) return null
              return (
                <div key={gi} style={{ marginBottom: group.group ? '8px' : 0 }}>
                  {group.group && (
                    <div onClick={() => toggleGroup(groupKey)}
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--muted)'}
                      style={{ fontFamily:FONT_SERIF, fontStyle:'italic', fontSize:'12px', color:'var(--muted)', marginBottom:'4px', paddingLeft:'4px', cursor:'pointer', display:'flex', alignItems:'center', gap:'6px', transition:'color 100ms' }}>
                      <span style={{ fontSize:'8px', opacity:0.4, display:'inline-block', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0)', transition:'transform 150ms' }}>▼</span>
                      {group.group}
                      {isCollapsed && <span style={{ fontSize:'10px', fontFamily:FONT_MONO, fontStyle:'normal' }}>({sortedItems.length})</span>}
                    </div>
                  )}
                  {!isCollapsed && sortedItems.map(doc => (
                    <DocItem key={doc.path} doc={doc} gitInfo={gitInfo} isPinned={pinned.has(doc.path)} onTogglePin={togglePin} onFileOpen={onFileOpen} />
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <BrokenLinksSection items={brokenLinks} onFileOpen={onFileOpen} rootPath={data.projectPath} />

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
                    draggable onDragStart={e => { e.dataTransfer.setData('text/plain', item.path); e.dataTransfer.effectAllowed = 'copy' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    style={{ display:'flex', alignItems:'center', gap:'8px', padding:'5px 8px', borderRadius:'6px', cursor:'pointer', transition:'background 75ms' }}>
                    <span style={{ width:'6px', height:'6px', borderRadius:'50%', background:dotColor, flexShrink:0 }} />
                    <span style={{ fontSize:'13px', color:'var(--text)', flex:1 }}>{item.name}</span>
                    {badge && (
                      <span title={gitStateLabel(gitState)} style={{ fontFamily:FONT_MONO, fontSize:'12px', color:badge.color, flexShrink:0, width:'12px', textAlign:'center', lineHeight:1 }}>{badge.glyph}</span>
                    )}
                    <span style={{ fontFamily:FONT_MONO, fontSize:'10px', color:'var(--muted)' }}>{formatAge(item.time)}</span>
                    {item.lineCount > 0 && <span style={{ fontFamily:FONT_MONO, fontSize:'10px', color:'var(--muted)', minWidth:'52px', textAlign:'right' }}>{item.lineCount} lines</span>}
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      <OrphanDocsSection paths={orphanDocs} onFileOpen={onFileOpen} rootPath={data.projectPath} />
    </div>
  )
}
