const { app, BrowserWindow, ipcMain, dialog, shell, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { spawn } = require('child_process');

let win;
let Store;
const AUDIO = new Set(['.wav', '.mp3', '.flac', '.aac', '.m4a', '.ogg', '.wma']);
const VIDEO = new Set(['.mp4', '.mov', '.mkv', '.avi', '.webm', '.m4v', '.gif']);

async function getStore() {
  if (!Store) Store = (await import('electron-store')).default;
  return new Store({ name: 'framevault-library', defaults: { folders: [], items: [], collections: [] } });
}

async function probe(file) {
  try {
    const probePath = require('ffprobe-static').path;
    return await new Promise((resolve) => {
      const child = spawn(probePath, ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', file], { windowsHide: true });
      let out = '';
      child.stdout.on('data', d => out += d);
      child.on('close', () => { try { resolve(JSON.parse(out)); } catch { resolve({}); } });
      child.on('error', () => resolve({}));
    });
  } catch { return {}; }
}

function walk(root) {
  const result = [];
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (AUDIO.has(path.extname(entry.name).toLowerCase()) || VIDEO.has(path.extname(entry.name).toLowerCase())) result.push(full);
    }
  }
  return result;
}

async function fingerprint(file) {
  const stat = fs.statSync(file);
  const handle = fs.openSync(file, 'r');
  const bytes = Buffer.alloc(Math.min(stat.size, 1024 * 1024));
  fs.readSync(handle, bytes, 0, bytes.length, 0);
  fs.closeSync(handle);
  return crypto.createHash('sha1').update(bytes).update(String(stat.size)).digest('hex');
}

async function scanLibrary() {
  const store = await getStore();
  const old = new Map(store.get('items').map(x => [x.path.toLowerCase(), x]));
  const files = [...new Set(store.get('folders').flatMap(walk))];
  const items = [];
  const hashes = new Map();
  for (let index = 0; index < files.length; index++) {
    const file = files[index];
    const ext = path.extname(file).toLowerCase();
    const stat = fs.statSync(file);
    const saved = old.get(file.toLowerCase()) || {};
    const hash = await fingerprint(file);
    const meta = saved.duration !== undefined ? {} : await probe(file);
    const stream = meta.streams?.find(s => s.codec_type === 'video') || {};
    const duration = saved.duration ?? Number(meta.format?.duration || 0);
    const item = {
      id: saved.id || crypto.randomUUID(), path: file, name: path.basename(file), ext: ext.slice(1),
      kind: AUDIO.has(ext) ? 'sfx' : 'video', size: stat.size, modifiedAt: stat.mtimeMs,
      addedAt: saved.addedAt || Date.now(), duration, width: stream.width || saved.width || 0,
      height: stream.height || saved.height || 0, hash, favorite: saved.favorite || false,
      tags: saved.tags || [], collections: saved.collections || [], missing: false
    };
    if (hashes.has(hash)) item.duplicateOf = hashes.get(hash); else hashes.set(hash, item.id);
    items.push(item);
    win?.webContents.send('scan:progress', { current: index + 1, total: files.length, name: item.name });
  }
  for (const saved of old.values()) if (!files.some(f => f.toLowerCase() === saved.path.toLowerCase())) items.push({ ...saved, missing: true });
  store.set('items', items);
  return { folders: store.get('folders'), collections: store.get('collections'), items };
}

function createWindow() {
  win = new BrowserWindow({ width: 1440, height: 900, minWidth: 1050, minHeight: 680, backgroundColor: '#0b0d10', titleBarStyle: 'hidden', titleBarOverlay: { color: '#0b0d10', symbolColor: '#aeb5c0', height: 42 }, webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false } });
  if (app.isPackaged) win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  else win.loadURL('http://localhost:5173');
  if (process.argv.includes('--smoke-test')) win.webContents.once('did-finish-load', () => app.exit(0));
}

app.whenReady().then(() => { createWindow(); app.on('activate', () => BrowserWindow.getAllWindows().length || createWindow()); });
app.on('window-all-closed', () => process.platform !== 'darwin' && app.quit());

ipcMain.handle('library:get-state', async () => { const s = await getStore(); return { folders: s.get('folders'), items: s.get('items'), collections: s.get('collections') }; });
ipcMain.handle('library:choose-folders', async () => {
  const result = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'multiSelections'] });
  if (!result.canceled) { const s = await getStore(); s.set('folders', [...new Set([...s.get('folders'), ...result.filePaths])]); }
  return scanLibrary();
});
ipcMain.handle('library:scan', scanLibrary);
ipcMain.handle('library:update-item', async (_, id, patch) => { const s = await getStore(); const items = s.get('items').map(x => x.id === id ? { ...x, ...patch } : x); s.set('items', items); return items.find(x => x.id === id); });
ipcMain.handle('library:add-collection', async (_, name) => { const s = await getStore(); const collections = [...new Set([...s.get('collections'), name.trim()])].filter(Boolean); s.set('collections', collections); return collections; });
ipcMain.handle('file:reveal', (_, file) => shell.showItemInFolder(file));
ipcMain.on('file:drag', (event, file) => {
  try {
    const resolved = path.resolve(file);
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) throw new Error('Không tìm thấy file nguồn. Hãy quét lại thư viện.');
    const width = 48, height = 48;
    const pixels = Buffer.alloc(width * height * 4);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4, inside = x > 3 && x < 44 && y > 3 && y < 44;
      pixels[i] = inside ? 177 : 0; pixels[i + 1] = inside ? 224 : 0; pixels[i + 2] = inside ? 80 : 0; pixels[i + 3] = inside ? 255 : 0;
    }
    event.sender.startDrag({ file: resolved, icon: nativeImage.createFromBitmap(pixels, { width, height, scaleFactor: 1 }) });
  } catch (error) { event.sender.send('drag:error', error.message || 'Không thể bắt đầu kéo file.'); }
});
