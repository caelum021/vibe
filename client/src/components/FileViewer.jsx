import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { List as VirtualList } from 'react-window'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { oneLight }    from 'react-syntax-highlighter/dist/esm/styles/prism'
import * as api from '../api'
import CodeRow from './CodeRow'
import DiffView from './DiffView'
import MarkdownView from './MarkdownView'
import { resolveKey, LINE_HEIGHT_PX, EDIT_PADDING_PX, LINE_NUM_WIDTH, FONT_MONO, FONT_UI, EXT_TO_DISPLAY } from '../constants'

const FileViewer = ({
  selectedFile, content, isEditing, editContent, isDirty, isMd, isDark,
  onEditContentChange, onEnterEdit, onExitEdit, onSave,
  isFocused, onFocus, onClose, innerRef,
  gitDirty, diffMode, onEnterDiff, onExitDiff,
  externallyChanged, onReload,
}) => {
  const [mdTab, setMdTab] = useState('edit')
  const [diffData, setDiffData] = useState(null)
  const [diffError, setDiffError] = useState('')
  const [diffSideBySide, setDiffSideBySide] = useState(false)
  const textareaRef       = useRef(null)
  const lineNumbersRef    = useRef(null)
  const ext = selectedFile?.name.split('.').pop()?.toLowerCase() ?? ''
  const langBadge = EXT_TO_DISPLAY[ext] || ext || '—'

  const handleTextareaScroll = useCallback((e) => {
    if (lineNumbersRef.current) lineNumbersRef.current.scrollTop = e.currentTarget.scrollTop
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

  // Diff-only shortcuts stay inside FileViewer (no timing issue — viewer already focused)
  useEffect(() => {
    if (!isFocused || isEditing || !diffMode) return
    const handle = (e) => {
      const k = resolveKey(e.key)
      if (e.shiftKey && k === 'd') { e.preventDefault(); setDiffSideBySide(p => !p) }
      else if (k === 'v' || k === 'd') { e.preventDefault(); onExitDiff() }
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [isFocused, isEditing, diffMode, onExitDiff])
  // Enter/E/D shortcuts are handled in the global keydown handler (App level) to avoid focus-transition timing issues

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

  const fileDirPath     = selectedFile?.path?.substring(0, selectedFile?.path?.lastIndexOf('/'))
  const showDiff        = !!selectedFile && diffMode && !isEditing
  const showEditPane    = isEditing && (!isMd || mdTab === 'edit')
  const showPreviewPane = isEditing && isMd && mdTab === 'preview'
  const isCodeView      = !!selectedFile && !isMd && !showEditPane && !showPreviewPane && !showDiff
  const isFlexLayout    = showEditPane || isCodeView || showDiff
  const activeContent   = isEditing ? editContent : content
  const lineCount       = useMemo(() => {
    let n = 1
    for (let i = 0; i < activeContent.length; i++) if (activeContent[i] === '\n') n++
    return n
  }, [activeContent])
  const lineNumbersText = useMemo(
    () => Array.from({ length: lineCount }, (_, i) => String(i + 1)).join('\n'),
    [lineCount]
  )
  const syntaxStyle     = isDark ? vscDarkPlus : oneLight

  useEffect(() => {
    if (lineNumbersRef.current) lineNumbersRef.current.scrollTop = 0
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
        <span style={{ fontSize:'13px', fontWeight:500, color: isDirty ? 'var(--accent)' : 'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', transition:'color 150ms' }}>
          {selectedFile?.name}{isDirty ? ' *' : ''}
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

        {externallyChanged && (
          <span onClick={onReload} title="Press L to reload" style={{ fontSize:'10px', color:'var(--warning, #b8860b)', background:'var(--warning-sub, #fdf6e3)', padding:'1px 6px', borderRadius:'3px', cursor:'pointer', flexShrink:0, fontFamily:FONT_UI }}>
            changed externally
          </span>
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
      <div data-scroll-container style={{ flex:1, overflow: isFlexLayout ? 'hidden' : 'auto', padding: isFlexLayout ? '0' : isMd ? '24px 32px' : '0', display: isFlexLayout ? 'flex' : 'block', flexDirection:'column', minHeight:0 }}>
        {selectedFile && (
          showDiff ? (
            diffError ? <div style={{ padding:'24px', color:'var(--error)', fontFamily:FONT_MONO, fontSize:'12px', whiteSpace:'pre-wrap' }}>Diff failed: {diffError}</div>
            : !diffData ? <div style={{ padding:'24px', color:'var(--muted)', fontSize:'12px' }}>Loading diff…</div>
            : <DiffView diff={diffData} sideBySide={diffSideBySide} />
          ) : showEditPane ? (
            <div style={{ display:'flex', flex:1, overflow:'hidden', minHeight:0 }}>
              <pre ref={lineNumbersRef} style={{
                margin: 0,
                padding: `${EDIT_PADDING_PX}px 12px 0 0`,
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
              }}>{lineNumbersText}</pre>
              <textarea ref={textareaRef} value={editContent} onChange={e => onEditContentChange(e.target.value)} onKeyDown={handleTextareaKeyDown}
                onScroll={handleTextareaScroll}
                spellCheck={false}
                wrap="off"
                style={{ flex:1, background:'var(--surface)', color:'var(--text)', border:'none', outline:'none', resize:'none', padding:`${EDIT_PADDING_PX}px`, fontFamily:FONT_MONO, fontSize:'12.5px', lineHeight:`${LINE_HEIGHT_PX}px`, letterSpacing:'0.01em', whiteSpace:'pre' }} />
            </div>
          ) : showPreviewPane ? (
            <MarkdownView content={editContent} isDark={isDark} fileDirPath={fileDirPath} />
          ) : isMd ? (
            <MarkdownView content={content} isDark={isDark} fileDirPath={fileDirPath} />
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

export default FileViewer
