import { createElement as createHlElement } from 'react-syntax-highlighter'
import { CODE_ROW_STYLE, CODE_ROW_LINENUM_STYLE, CODE_ROW_TOKEN_STYLE } from '../constants'

const CodeRow = ({ index, style, rows, stylesheet, useInlineStyles }) => (
  <div style={{ ...style, ...CODE_ROW_STYLE }}>
    <span style={CODE_ROW_LINENUM_STYLE}>{index + 1}</span>
    <span style={CODE_ROW_TOKEN_STYLE}>
      {createHlElement({ node: rows[index], stylesheet, useInlineStyles, key: index })}
    </span>
  </div>
)

export default CodeRow
