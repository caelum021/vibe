import { createElement as createHlElement } from 'react-syntax-highlighter'
import { CODE_ROW_STYLE, CODE_ROW_LINENUM_STYLE, CODE_ROW_TOKEN_STYLE } from '../constants'

const CodeRow = ({ index, style, rows, stylesheet, useInlineStyles, searchMatchSet, currentMatchLine }) => {
  const isMatch = searchMatchSet?.has(index)
  const isCurrent = currentMatchLine === index
  const bg = isCurrent ? 'var(--search-current, rgba(255,165,0,0.25))' : isMatch ? 'var(--search-match, rgba(255,213,0,0.12))' : undefined
  return (
    <div style={{ ...style, ...CODE_ROW_STYLE, background: bg }}>
      <span style={CODE_ROW_LINENUM_STYLE}>{index + 1}</span>
      <span style={CODE_ROW_TOKEN_STYLE}>
        {createHlElement({ node: rows[index], stylesheet, useInlineStyles, key: index })}
      </span>
    </div>
  )
}

export default CodeRow
