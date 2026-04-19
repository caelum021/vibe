import { useState, useEffect, useCallback } from 'react'
import * as api from '../api'
import { FONT_MONO, SECTION_LABEL, basenameOf } from '../constants'

const COLLAPSED_KEY = 'vibe-backlinks-collapsed'
const loadCollapsed = () => { try { return localStorage.getItem(COLLAPSED_KEY) !== 'false' } catch { return true } }
const saveCollapsed = (v) => { try { localStorage.setItem(COLLAPSED_KEY, String(v)) } catch {} }

function relPath(abs, rootPath) {
  if (!abs) return ''
  if (rootPath && abs.startsWith(rootPath + '/')) return abs.slice(rootPath.length + 1)
  return abs
}

export default function BacklinksPanel({ path, rootPath, onLinkOpen }) {
  const [backlinks, setBacklinks] = useState([])
  const [collapsed, setCollapsed] = useState(loadCollapsed)

  const fetchBacklinks = useCallback((p) => {
    if (!p) return Promise.resolve([])
    return api.getBacklinks(p).catch(() => [])
  }, [])

  useEffect(() => {
    if (!path) { setBacklinks([]); return }
    let cancelled = false
    const load = () => fetchBacklinks(path).then(list => { if (!cancelled) setBacklinks(list || []) })
    load()

    const unlistenPromises = [
      api.onLinkIndexReady(load),
      api.onFileChanged(load),
    ]
    return () => {
      cancelled = true
      unlistenPromises.forEach(p => p.then(fn => fn && fn()).catch(() => {}))
    }
  }, [path, fetchBacklinks])

  const toggle = useCallback(() => setCollapsed(prev => { const next = !prev; saveCollapsed(next); return next }), [])

  const handleItemClick = useCallback((source) => {
    if (!onLinkOpen) return
    onLinkOpen({ path: source, name: basenameOf(source), isDirectory: false })
  }, [onLinkOpen])

  if (!path || backlinks.length === 0) return null

  return (
    <div style={{ marginTop:'32px', paddingTop:'12px', borderTop:'1px solid var(--border)', maxWidth:'72ch' }}>
      <div
        role="button"
        tabIndex={0}
        onClick={toggle}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle() } }}
        style={{ ...SECTION_LABEL, marginBottom: collapsed ? 0 : '10px', cursor:'pointer', display:'flex', alignItems:'center', gap:'6px', padding:'4px 0', userSelect:'none' }}
      >
        <span style={{ display:'inline-block', fontSize:'9px', transform: collapsed ? 'rotate(-90deg)' : 'rotate(0)', transition:'transform 150ms', opacity:0.7 }}>▼</span>
        <span>Backlinks ({backlinks.length})</span>
      </div>
      {!collapsed && (
        <div style={{ display:'flex', flexDirection:'column' }}>
          {backlinks.map((b, i) => (
            <div
              key={`${b.source}:${b.line}:${i}`}
              onClick={() => handleItemClick(b.source)}
              style={{
                padding:'8px 12px',
                borderLeft:'2px solid transparent',
                cursor:'pointer',
                transition:'background 100ms, border-color 100ms',
                borderRadius:'2px',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-2)'; e.currentTarget.style.borderLeftColor = 'var(--accent)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderLeftColor = 'transparent' }}
            >
              <div style={{ fontFamily:FONT_MONO, fontSize:'11.5px', color:'var(--accent)' }}>
                {relPath(b.source, rootPath)}
                <span style={{ color:'var(--muted)' }}>:{b.line}</span>
              </div>
              {b.snippet && (
                <div style={{ fontSize:'12px', color:'var(--muted)', lineHeight:1.6, marginTop:'2px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {b.snippet}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
