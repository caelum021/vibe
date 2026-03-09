#!/usr/bin/env node
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import * as pty from 'node-pty';
import os from 'os';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import open from 'open';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const VERSION = '1.0.0';

const args = process.argv.slice(2);
const targetArg = args[0] || '.';
const rootDir = path.resolve(process.cwd(), targetArg);

if (!fs.existsSync(rootDir) || !fs.statSync(rootDir).isDirectory()) {
  console.error(`Error: Path "${rootDir}" does not exist.`);
  process.exit(1);
}

const SECRET_TOKEN = crypto.randomBytes(32).toString('hex');
const PORT = 3001;

const app = express();
app.use(express.json());
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: `http://localhost:${PORT}`, methods: ["GET", "POST"] }
});

io.use((socket, next) => {
  if (socket.handshake.auth?.token === SECRET_TOKEN) return next();
  next(new Error('Unauthorized'));
});

const clientBuildPath = path.resolve(__dirname, '../client/dist');
if (fs.existsSync(clientBuildPath)) {
  app.use(express.static(clientBuildPath));
}

const IGNORED = ['.git', 'node_modules', '.next', 'dist', '.gemini', 'vibe-python', '.claude'];

const validatePath = (userPath, allowRoot = true) => {
  const fullPath = path.resolve(userPath || rootDir);
  if (fullPath === rootDir && !allowRoot) throw new Error('Action not allowed on root directory');
  if (fullPath !== rootDir && !fullPath.startsWith(rootDir + path.sep)) throw new Error('Access Denied');
  return fullPath;
};

app.get('/api/files', async (req, res) => {
  try {
    const targetPath = validatePath(req.query.path);
    const entries = await fs.promises.readdir(targetPath, { withFileTypes: true });
    const items = entries
      .filter(item => !IGNORED.includes(item.name))
      .map(item => ({
        name: item.name,
        path: path.join(targetPath, item.name),
        isDirectory: item.isDirectory()
      }))
      .sort((a, b) => (a.isDirectory === b.isDirectory ? a.name.localeCompare(b.name) : a.isDirectory ? -1 : 1));
    res.json({ currentPath: targetPath, items });
  } catch (err) { res.status(403).json({ error: err.message }); }
});

app.get('/api/file-content', async (req, res) => {
  try {
    const filePath = validatePath(req.query.path);
    const stats = await fs.promises.stat(filePath);
    if (stats.size > 1024 * 1024) return res.json({ content: 'File too large' });
    const buffer = await fs.promises.readFile(filePath);
    if (buffer.slice(0, 100).some(b => b === 0)) return res.json({ content: 'Binary file detected.' });
    res.json({ content: buffer.toString('utf8') });
  } catch (err) { res.status(403).json({ error: err.message }); }
});

app.post('/api/file-write', async (req, res) => {
  try {
    const { path: filePath, content } = req.body;
    if (typeof content !== 'string') return res.status(400).json({ error: 'Invalid content' });
    const validPath = validatePath(filePath, false);
    await fs.promises.writeFile(validPath, content, 'utf8');
    res.json({ success: true });
  } catch (err) { res.status(403).json({ error: err.message }); }
});

app.post('/api/create-item', async (req, res) => {
  try {
    const { path: itemPath, isDirectory } = req.body;
    const validPath = validatePath(itemPath, false);
    if (isDirectory) {
      await fs.promises.mkdir(validPath, { recursive: true });
    } else {
      await fs.promises.writeFile(validPath, '', 'utf8');
    }
    res.json({ success: true });
  } catch (err) { res.status(403).json({ error: err.message }); }
});

app.post('/api/delete-item', async (req, res) => {
  try {
    const { path: itemPath } = req.body;
    const validPath = validatePath(itemPath, false);
    const stats = await fs.promises.stat(validPath);
    if (stats.isDirectory()) {
      await fs.promises.rm(validPath, { recursive: true, force: true });
    } else {
      await fs.promises.unlink(validPath);
    }
    res.json({ success: true });
  } catch (err) { res.status(403).json({ error: err.message }); }
});

app.post('/api/rename-item', async (req, res) => {
  try {
    const { oldPath, newPath } = req.body;
    const validOldPath = validatePath(oldPath, false);
    const validNewPath = validatePath(newPath, false);
    await fs.promises.rename(validOldPath, validNewPath);
    res.json({ success: true });
  } catch (err) { res.status(403).json({ error: err.message }); }
});

const shellPath = process.env.SHELL || (os.platform() === 'win32' ? 'powershell.exe' : 'bash');
let connectionCount = 0;
let exitTimeout = null;

io.on('connection', (socket) => {
  connectionCount++;
  if (exitTimeout) { clearTimeout(exitTimeout); exitTimeout = null; }

  let ptyProcess = null;
  socket.on('start-command', () => {
    if (ptyProcess) return;
    ptyProcess = pty.spawn(shellPath, [], {
      name: 'xterm-256color',
      cols: 100,
      rows: 30,
      cwd: rootDir,
      env: { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor' }
    });
    ptyProcess.onData((data) => socket.emit('terminal-data', data));
    socket.on('terminal-input', (data) => ptyProcess?.write(data));
    socket.on('terminal-resize', ({ cols, rows }) => {
      try {
        if (cols > 0 && rows > 0) ptyProcess?.resize(cols, rows);
      } catch (err) { console.error('Terminal resize failed:', err); }
    });
  });

  socket.on('disconnect', () => {
    connectionCount--;
    ptyProcess?.kill();
    if (connectionCount === 0) {
      exitTimeout = setTimeout(() => {
        console.log('vibe closed. Goodbye!');
        process.exit(0);
      }, 3000);
    }
  });
});

httpServer.listen(PORT, async () => {
  console.log(`\x1b[36m🚀 vibe v${VERSION} is active!\x1b[0m`);
  if (process.env.NODE_ENV !== 'test') {
    try { await open(`http://localhost:${PORT}?token=${SECRET_TOKEN}`); } catch (e) {}
  }
});
