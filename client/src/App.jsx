import { useEffect, useRef, useState, useCallback } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { Unicode11Addon } from 'xterm-addon-unicode11'
import { io } from 'socket.io-client'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'

const FileExplorer = ({ onFileSelect, isFocused, onFocus, innerRef }) => {
  const [files, setFiles] = useState([])
  const [currentPath, setCurrentPath] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)

  const fetchFiles = useCallback(async (path = '') => {
    try {
      const response = await fetch(`/api/files?path=${encodeURIComponent(path)}`)
      const data = await response.json()
      setFiles(data.items || [])
      setCurrentPath(data.currentPath || '')
      setSelectedIndex(0)
    } catch (err) {
      console.error('Failed to fetch files:', err)
    }
  }, [])

  useEffect(() => { fetchFiles() }, [fetchFiles])

  useEffect(() => {
    if (!isFocused) return;
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(files.length - 1, prev + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(0, prev - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const file = files[selectedIndex];
        if (file) {
          if (file.isDirectory) fetchFiles(file.path);
          else onFileSelect(file);
        }
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        fetchFiles(currentPath.split('/').slice(0, -1).join('/') || '/');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFocused, files, selectedIndex, fetchFiles, onFileSelect, currentPath]);

  return (
    <div 
      ref={innerRef} tabIndex={0} onFocus={onFocus}
      style={{ 
        padding: '10px', color: '#ccc', fontSize: '13px', height: '100%', overflowY: 'auto',
        border: isFocused ? '1px solid #00bcd4' : '1px solid transparent',
        boxSizing: 'border-box', transition: 'border 0.2s', outline: 'none'
      }}
    >
      <div style={{ fontWeight: 'bold', marginBottom: '10px', color: '#00bcd4', fontSize: '12px' }}>Project</div>
      {files.map((file, idx) => (
        <div
          key={file.path}
          onClick={() => { setSelectedIndex(idx); if (file.isDirectory) fetchFiles(file.path); else onFileSelect(file); }}
          style={{
            padding: '4px 8px', cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px',
            backgroundColor: idx === selectedIndex && isFocused ? '#333' : 'transparent',
            color: idx === selectedIndex && isFocused ? '#00bcd4' : '#ccc'
          }}
        >
          <span>{file.isDirectory ? '📁' : '📄'}</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{file.name}</span>
        </div>
      ))}
    </div>
  )
}

const FileViewer = ({ selectedFile, isFocused, onFocus, onClose, innerRef }) => {
  const [content, setContent] = useState('')

  useEffect(() => {
    if (selectedFile && !selectedFile.isDirectory) {
      fetch(`/api/file-content?path=${encodeURIComponent(selectedFile.path)}`)
        .then(res => res.json())
        .then(data => setContent(data.content || ''))
        .catch(err => setContent('Error loading file content.'))
    }
  }, [selectedFile])

  return (
    <div 
      ref={innerRef} tabIndex={0} onFocus={onFocus}
      style={{ 
        padding: '15px', color: '#eee', height: '100%', overflowY: 'auto', 
        border: isFocused ? '1px solid #00bcd4' : '1px solid transparent',
        boxSizing: 'border-box', transition: 'border 0.2s', outline: 'none',
        backgroundColor: '#1e1e1e', position: 'relative'
      }}
    >
      <div style={{ fontWeight: 'bold', marginBottom: '15px', color: '#00bcd4', fontSize: '13px', borderBottom: '1px solid #333', paddingBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>{selectedFile ? selectedFile.name : 'Editor'}</span>
        <button 
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          style={{ background: '#333', border: 'none', color: '#666', cursor: 'pointer', fontSize: '16px', lineHeight: '1', padding: '0 5px' }}
        >
          &times;
        </button>
      </div>
      {selectedFile ? (
        <SyntaxHighlighter
          language={selectedFile.name.split('.').pop()}
          style={vscDarkPlus}
          customStyle={{ margin: 0, padding: 0, background: 'transparent', fontSize: '13px' }}
        >
          {content}
        </SyntaxHighlighter>
      ) : null}
    </div>
  )
}

function App() {
  const terminalRef = useRef(null)
  const explorerRef = useRef(null)
  const viewerRef = useRef(null)
  const xtermInstance = useRef(null)
  const fitAddonRef = useRef(null)
  const selectedFileRef = useRef(null)
  
  const [selectedFile, setSelectedFile] = useState(null)
  const [connected, setConnected] = useState(false)
  const [activeFocus, setActiveFocus] = useState('terminal')
  const [sidebarVisible, setSidebarVisible] = useState(true)

  useEffect(() => { selectedFileRef.current = selectedFile }, [selectedFile])

  const handleFocusChange = useCallback((target) => {
    setActiveFocus(target);
    if (target === 'explorer' && explorerRef.current) explorerRef.current.focus();
    else if (target === 'viewer' && viewerRef.current) viewerRef.current.focus();
    else if (target === 'terminal' && xtermInstance.current) xtermInstance.current.focus();
  }, []);

  const closeViewer = useCallback(() => {
    setSelectedFile(null);
    handleFocusChange('explorer');
    setTimeout(() => { if (fitAddonRef.current) fitAddonRef.current.fit(); }, 50);
  }, [handleFocusChange]);

  const handleFileSelect = useCallback((file) => {
    setSelectedFile(file);
    handleFocusChange('viewer');
    setTimeout(() => { if (fitAddonRef.current) fitAddonRef.current.fit(); }, 50);
  }, [handleFocusChange]);

  const toggleSidebar = useCallback(() => {
    setSidebarVisible(prev => !prev);
    setTimeout(() => { if (fitAddonRef.current) fitAddonRef.current.fit(); }, 350);
  }, []);

  useEffect(() => {
    if (!terminalRef.current) return;
    const token = new URLSearchParams(window.location.search).get('token')
    const socket = io({ auth: { token } })
    const terminal = new Terminal({
      cursorBlink: true,
      fontFamily: 'MesloLGS NF, monospace',
      fontSize: 14,
      theme: { background: '#1e1e1e', foreground: '#ffffff', cursor: '#ffffff' },
      allowProposedApi: true
    })
    xtermInstance.current = terminal
    const fitAddon = new FitAddon()
    fitAddonRef.current = fitAddon
    const unicode11Addon = new Unicode11Addon()
    terminal.loadAddon(fitAddon)
    terminal.loadAddon(unicode11Addon)
    terminal.unicode.activeVersion = '11'

    terminal.open(terminalRef.current)
    fitAddon.fit()

    terminal.attachCustomKeyEventHandler((e) => {
      if (e.type === 'keydown') {
        if (e.ctrlKey && e.key === 'b') { toggleSidebar(); return false; }
        if (e.ctrlKey && (e.key === '`' || e.code === 'Backquote')) { handleFocusChange('terminal'); return false; }
        if (e.key === 'Escape') {
            if (selectedFileRef.current) closeViewer();
            else handleFocusChange('explorer');
            return false;
        }
      }
      return true;
    });

    socket.on('connect', () => {
      setConnected(true)
      socket.emit('terminal-resize', { cols: terminal.cols, rows: terminal.rows })
      socket.emit('start-command', 'shell')
    })
    socket.on('terminal-data', (data) => terminal.write(data))
    terminal.onData((data) => socket.emit('terminal-input', data))

    const onResize = () => { fitAddon.fit(); socket.emit('terminal-resize', { cols: terminal.cols, rows: terminal.rows }); };
    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(terminalRef.current);
    terminal.focus()
    return () => { resizeObserver.disconnect(); socket.disconnect(); terminal.dispose(); }
  }, [handleFocusChange, toggleSidebar, closeViewer])

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (e.ctrlKey && e.key === 'b') { e.preventDefault(); toggleSidebar(); }
      else if (e.ctrlKey && (e.key === '`' || e.code === 'Backquote')) { e.preventDefault(); handleFocusChange('terminal'); }
      else if (e.key === 'Escape') {
          e.preventDefault();
          if (selectedFileRef.current) closeViewer();
          else handleFocusChange('explorer');
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [handleFocusChange, toggleSidebar, closeViewer])

  return (
    <div style={{ display: 'flex', width: '100%', height: '100vh', backgroundColor: '#1a1a1a', overflow: 'hidden' }}>
      <div style={{ 
        width: sidebarVisible ? '250px' : '0px', opacity: sidebarVisible ? 1 : 0,
        visibility: sidebarVisible ? 'visible' : 'hidden', display: 'flex', flexDirection: 'column', 
        borderRight: sidebarVisible ? '1px solid #333' : 'none', flexShrink: 0,
        backgroundColor: '#1a1a1a', transition: 'width 0.3s ease-in-out, opacity 0.2s ease-in-out'
      }}>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <FileExplorer 
            innerRef={explorerRef}
            onFocus={() => setActiveFocus('explorer')}
            onFileSelect={handleFileSelect} 
            isFocused={activeFocus === 'explorer'} 
          />
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', backgroundColor: '#1e1e1e' }}>
        {selectedFile && (
          <div style={{ flex: 1, minWidth: '40%', borderRight: '1px solid #333', overflow: 'hidden' }}>
            <FileViewer 
              innerRef={viewerRef}
              onFocus={() => setActiveFocus('viewer')}
              onClose={closeViewer}
              selectedFile={selectedFile} 
              isFocused={activeFocus === 'viewer'} 
            />
          </div>
        )}

        <div 
          onClick={() => handleFocusChange('terminal')}
          style={{ 
            flex: 1, padding: '10px', boxSizing: 'border-box', overflow: 'hidden', position: 'relative',
            border: activeFocus === 'terminal' ? '1px solid #00bcd4' : '1px solid transparent',
            transition: 'border 0.2s'
          }}
        >
          <div style={{ position: 'absolute', top: '5px', right: '15px', display: 'flex', alignItems: 'center', gap: '10px', zIndex: 10 }}>
            <span style={{ color: '#444', fontSize: '9px' }}>Ctrl+B: Sidebar | Esc: Close | Ctrl+`: Terminal</span>
            <span style={{ color: connected ? '#4caf50' : '#f44336', fontSize: '10px' }}>
              {connected ? '● ONLINE' : '○ OFFLINE'}
            </span>
          </div>
          <div ref={terminalRef} style={{ width: '100%', height: '100%' }} />
        </div>
      </div>
    </div>
  )
}

export default App
