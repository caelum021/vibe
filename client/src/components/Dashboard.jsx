import { FONT_MONO, FONT_SERIF, SECTION_LABEL, DIVIDER, EXT_TO_LANG, LANG_COLORS, formatAge, getDocIcon, gitBadgeFor } from '../constants'

function StatCard({ value, label }) {
  return (
    <div style={{ background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:'6px', padding:'8px 16px' }}>
      <div style={{ fontFamily:FONT_MONO, fontSize:'20px', fontWeight:500, color:'var(--text)', lineHeight:1.2 }}>{value}</div>
      <div style={{ fontSize:'10px', color:'var(--muted)', marginTop:'2px', textTransform:'uppercase', letterSpacing:'0.06em' }}>{label}</div>
    </div>
  )
}

export default function ProjectDashboard({ data, recentChanges, onFileOpen, onRefresh, refreshing, justRefreshed, gitInfo }) {
  if (!data) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:'var(--muted)', fontSize:'13px' }}>Loading…</div>
  const { projectName, projectPath, totalFiles, totalFolders, langStats, docGroups } = data
  const totalDocs = docGroups.reduce((sum, g) => sum + g.items.length, 0)

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflowY:'auto', padding:'32px 48px', gap:'32px', userSelect:'text', WebkitUserSelect:'text' }}>
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
          onClick={onRefresh}
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
                      draggable onDragStart={e => { e.dataTransfer.setData('text/plain', doc.name); e.dataTransfer.effectAllowed = 'copy' }}
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
                  draggable onDragStart={e => { e.dataTransfer.setData('text/plain', item.name); e.dataTransfer.effectAllowed = 'copy' }}
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
