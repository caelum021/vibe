import { useState, useEffect, useMemo } from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { oneLight }    from 'react-syntax-highlighter/dist/esm/styles/prism'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import * as api from '../api'
import { FONT_MONO, FONT_SERIF } from '../constants'

function MarkdownImage({ src, alt, fileDirPath }) {
  const [dataUrl, setDataUrl] = useState(null)
  useEffect(() => {
    if (!src) return
    if (src.startsWith('data:') || src.startsWith('http:') || src.startsWith('https:')) {
      setDataUrl(src)
      return
    }
    const absPath = src.startsWith('/') ? src : fileDirPath + '/' + src
    api.readImage(absPath).then(r => setDataUrl(r.dataUrl)).catch(() => setDataUrl(null))
  }, [src, fileDirPath])
  if (!dataUrl) return <span style={{ color:'var(--muted)', fontSize:'12px' }}>[image: {alt || src}]</span>
  return <img src={dataUrl} alt={alt || ''} style={{ maxWidth:'100%', borderRadius:'4px', margin:'8px 0' }} />
}

function makeMarkdownComponents(isDark, fileDirPath) {
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
    ul: ({children}) => <ul style={{ paddingLeft:'20px', marginBottom:'10px', marginTop:'4px' }}>{children}</ul>,
    ol: ({children}) => <ol style={{ paddingLeft:'20px', marginBottom:'10px', marginTop:'4px' }}>{children}</ol>,
    li: ({children}) => <li style={{ marginBottom:'4px', color:'var(--text)', lineHeight:'1.65' }}>{children}</li>,
    blockquote: ({children}) => <blockquote style={{ borderLeft:'3px solid var(--accent)', paddingLeft:'16px', margin:'0 0 8px 0', color:'var(--muted)' }}>{children}</blockquote>,
    hr: () => <hr style={{ border:'none', borderTop:'1px solid var(--border)', margin:'24px 0' }} />,
    strong: ({children}) => <strong style={{ fontWeight:600 }}>{children}</strong>,
    table: ({children}) => <table style={{ borderCollapse:'collapse', width:'100%', marginBottom:'16px', fontSize:'13px' }}>{children}</table>,
    thead: ({children}) => <thead style={{ borderBottom:'2px solid var(--border)' }}>{children}</thead>,
    th: ({children}) => <th style={{ padding:'5px 8px', textAlign:'left', fontWeight:600 }}>{children}</th>,
    td: ({children}) => <td style={{ padding:'5px 8px', borderBottom:'1px solid var(--border)' }}>{children}</td>,
    tr: ({children}) => <tr>{children}</tr>,
    img: ({src, alt}) => <MarkdownImage src={src} alt={alt} fileDirPath={fileDirPath} />,
  }
}

export default function MarkdownView({ content, isDark, fileDirPath }) {
  const components = useMemo(() => makeMarkdownComponents(isDark, fileDirPath), [isDark, fileDirPath])
  return (
    <div style={{ color:'var(--text)', lineHeight:'1.75', fontSize:'14px', maxWidth:'72ch' }}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={components}>{content}</ReactMarkdown>
    </div>
  )
}
