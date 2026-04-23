import { CODE_ROW_STYLE, CODE_ROW_LINENUM_STYLE, CODE_ROW_TOKEN_STYLE } from '../constants'

const PlainCodeRow = ({ index, style, lines, searchMatchSet, currentMatchLine }) => {
  const isMatch = searchMatchSet?.has(index)
  const isCurrent = currentMatchLine === index
  const bg = isCurrent ? 'var(--search-current)' : isMatch ? 'var(--search-match)' : undefined
  return (
    <div style={{ ...style, ...CODE_ROW_STYLE, background: bg }}>
      <span style={CODE_ROW_LINENUM_STYLE}>{index + 1}</span>
      <span style={{ ...CODE_ROW_TOKEN_STYLE, color: 'var(--text)' }}>{lines[index] || ' '}</span>
    </div>
  )
}

export default PlainCodeRow
