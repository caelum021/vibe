import { useState, useEffect, useRef } from 'react'
import { removeProject, reorderProjects, basenameOf, FONT_MONO, FONT_SERIF, FONT_UI } from '../constants'

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
          style={{ position:'absolute', bottom:'calc(100% + 6px)', right:0, background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'6px', padding:'4px 0', minWidth:'200px', boxShadow:'0 6px 20px rgba(26,22,18,0.15)', zIndex:100 }}>
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
    <div style={{ width:'100%', height:'100vh', background:'var(--bg)', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:'24px' }}>
      <h1 className="vibe-logo" style={{ fontSize:'32px', fontWeight:400, margin:0 }}>vibe<span className="vibe-logo-dot">.</span></h1>
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
                style={{ display:'flex', alignItems:'center', gap:'8px', padding:'6px 8px', borderRadius:'6px', cursor: isDragging ? 'grabbing' : 'pointer',
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
        <div style={{ position:'fixed', inset:0, background:'rgba(26,22,18,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}
          onClick={() => setConfirmDelete(null)}>
          <div onClick={e => e.stopPropagation()}
            style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'8px', padding:'24px 32px', textAlign:'center', minWidth:'280px', boxShadow:'0 8px 32px rgba(26,22,18,0.12)' }}>
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

export { ProjectDropdown }
export default NoRootScreen
