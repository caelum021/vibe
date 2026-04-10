import { useMemo } from 'react'
import { List as VirtualList } from 'react-window'
import { LINE_HEIGHT_PX, FONT_MONO, DIFF_ROW_STYLE, DIFF_GUTTER, DIFF_MARK_STYLE } from '../constants'

function flattenHunks(hunks) {
  const rows = []
  for (const h of hunks) {
    rows.push({ kind: 'header', text: `@@ -${h.oldStart},${h.oldLines} +${h.newStart},${h.newLines} @@` })
    for (const l of h.lines) rows.push({ kind: 'line', line: l })
  }
  return rows
}

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
    <div style={{ ...style, ...DIFF_ROW_STYLE }}>
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

export default function DiffView({ diff, sideBySide }) {
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
