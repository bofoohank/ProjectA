const { app, BrowserWindow, ipcMain, dialog, shell, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { spawn } = require('child_process');

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

let win;
let Store;
let watchTimer;
const folderWatchers = new Map();
const AUDIO = new Set(['.wav', '.mp3', '.flac', '.aac', '.m4a', '.ogg', '.wma']);
const VIDEO = new Set(['.mp4', '.mov', '.mkv', '.avi', '.webm', '.m4v', '.gif']);

async function getStore() {
  if (!Store) Store = (await import('electron-store')).default;
  const root = cacheRoot();
  fs.mkdirSync(root, { recursive: true });
  const store = new Store({ name: 'library-index', cwd: root, defaults: { folders: [], items: [], duplicates: [], collections: [], scannedAt: 0, migrationComplete: false } });
  if (!store.get('migrationComplete')) {
    const legacy = new Store({ name: 'projecta-library', defaults: { folders: [], items: [], collections: [] } });
    if (legacy.get('folders').length || legacy.get('items').length) {
      if (!store.get('folders').length && !store.get('items').length) store.set({ folders: legacy.get('folders'), items: legacy.get('items'), collections: legacy.get('collections'), scannedAt: Date.now() });
    }
    store.set('migrationComplete', true);
  }
  return store;
}

function cacheSettingsFile() { return path.join(app.getPath('userData'), 'cache-location.json'); }
function cacheRoot() {
  try { const saved = JSON.parse(fs.readFileSync(cacheSettingsFile(), 'utf8')); if (saved.path && path.isAbsolute(saved.path)) return saved.path; } catch {}
  return path.join(app.getPath('userData'), 'Cache', 'ProjectA');
}
function waveformRoot() { return path.join(cacheRoot(), 'waveforms'); }
function waveformFile(key) { return path.join(waveformRoot(), `${String(key).replace(/[^a-zA-Z0-9_-]/g, '_')}.json`); }
function directorySize(root) {
  let total = 0;
  if (!fs.existsSync(root)) return total;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const target = path.join(root, entry.name);
    try { total += entry.isDirectory() ? directorySize(target) : fs.statSync(target).size; } catch {}
  }
  return total;
}
async function cleanExpiredWaveforms() {
  const store = await getStore();
  const days = Number(store.get('cacheMaxAgeDays', 0));
  if (!days || !fs.existsSync(waveformRoot())) return;
  const cutoff = Date.now() - days * 86400000;
  for (const name of fs.readdirSync(waveformRoot())) {
    const target = path.join(waveformRoot(), name);
    try { if (fs.statSync(target).mtimeMs < cutoff) fs.rmSync(target, { force: true }); } catch {}
  }
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

function categoryFromPath(file) { return path.basename(path.dirname(file)) || 'Khác'; }
function normalizedMediaName(name) { return path.basename(name, path.extname(name)).toLowerCase().replace(/\b(copy|duplicate|ban sao)\b/g, '').replace(/\s*\(\d+\)\s*$/g, '').replace(/[^a-z0-9]+/g, ' ').trim(); }
function waveformSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || !a.length) return 0;
  let dot = 0, aa = 0, bb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; aa += a[i] * a[i]; bb += b[i] * b[i]; }
  return aa && bb ? dot / Math.sqrt(aa * bb) : 0;
}
function collapseDuplicates(items) {
  const visible = [], duplicates = [];
  for (const item of items) {
    if (item.missing) { visible.push(item); continue; }
    const match = visible.find(saved => !saved.missing && (saved.hash === item.hash || (normalizedMediaName(saved.name) === normalizedMediaName(item.name) && Math.abs((saved.duration || 0) - (item.duration || 0)) <= Math.max(.18, (saved.duration || 0) * .015) && waveformSimilarity(saved.waveformSignature, item.waveformSignature) >= .985)));
    if (match) duplicates.push({ ...item, duplicateOf: match.id }); else visible.push(item);
  }
  return { visible, duplicates };
}

async function waveformSignature(file) {
  try {
    const ffmpegPath = require('ffmpeg-static');
    return await new Promise(resolve => {
      const child = spawn(ffmpegPath, ['-v', 'error', '-i', file, '-map', '0:a:0', '-ac', '1', '-ar', '100', '-f', 's16le', 'pipe:1'], { windowsHide: true });
      const chunks = []; child.stdout.on('data', chunk => chunks.push(chunk));
      child.on('error', () => resolve([])); child.on('close', () => {
        const buffer = Buffer.concat(chunks), count = Math.floor(buffer.length / 2); if (!count) return resolve([]);
        const bins = Array(64).fill(0), totals = Array(64).fill(0);
        for (let i = 0; i < count; i++) { const bin = Math.min(63, Math.floor(i / count * 64)); bins[bin] += Math.abs(buffer.readInt16LE(i * 2)); totals[bin]++; }
        const averaged = bins.map((value, i) => totals[i] ? value / totals[i] : 0), max = Math.max(...averaged, 1);
        resolve(averaged.map(value => Math.round(value / max * 1000) / 1000));
      });
    });
  } catch { return []; }
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
  const old = new Map([...store.get('items'), ...store.get('duplicates', [])].map(x => [x.path.toLowerCase(), x]));
  const files = [...new Set(store.get('folders').flatMap(walk))];
  const items = [];
  for (let index = 0; index < files.length; index++) {
    const file = files[index];
    const ext = path.extname(file).toLowerCase();
    const stat = fs.statSync(file);
    const saved = old.get(file.toLowerCase()) || {};
    const unchanged = saved.id && saved.size === stat.size && saved.modifiedAt === stat.mtimeMs;
    const hash = unchanged && saved.hash ? saved.hash : await fingerprint(file);
    const meta = unchanged && saved.duration !== undefined ? {} : await probe(file);
    const stream = meta.streams?.find(s => s.codec_type === 'video') || {};
    const duration = saved.duration ?? Number(meta.format?.duration || 0);
    const signature = AUDIO.has(ext) ? (unchanged && saved.waveformSignature?.length ? saved.waveformSignature : await waveformSignature(file)) : [];
    const item = {
      id: saved.id || crypto.randomUUID(), path: file, name: path.basename(file), ext: ext.slice(1),
      kind: AUDIO.has(ext) ? 'sfx' : 'video', size: stat.size, modifiedAt: stat.mtimeMs,
      addedAt: saved.addedAt || Date.now(), duration, width: stream.width || saved.width || 0,
      height: stream.height || saved.height || 0, hash, favorite: saved.favorite || false,
      tags: saved.tags || [], collections: saved.collections || [], category: saved.category || categoryFromPath(file), waveformSignature: signature, missing: false
    };
    items.push(item);
    win?.webContents.send('scan:progress', { current: index + 1, total: files.length, name: item.name });
  }
  for (const saved of old.values()) if (!saved.duplicateOf && !files.some(f => f.toLowerCase() === saved.path.toLowerCase())) items.push({ ...saved, missing: true });
  const collapsed = collapseDuplicates(items);
  store.set('items', collapsed.visible);
  store.set('duplicates', collapsed.duplicates);
  store.set('scannedAt', Date.now());
  return { folders: store.get('folders'), collections: store.get('collections'), items: collapsed.visible };
}

function createWindow() {
  win = new BrowserWindow({ width: 1440, height: 900, minWidth: 1050, minHeight: 680, backgroundColor: '#0b0d10', icon: path.join(__dirname, '..', 'build', 'icon.ico'), titleBarStyle: 'hidden', titleBarOverlay: { color: '#0b0d10', symbolColor: '#aeb5c0', height: 42 }, webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false } });
  if (app.isPackaged) win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  else win.loadURL('http://localhost:5173');
  if (process.argv.includes('--smoke-test')) win.webContents.once('did-finish-load', () => app.exit(0));
  if (process.argv.includes('--settings-smoke-test')) win.webContents.once('did-finish-load', async () => { try { const result = await win.webContents.executeJavaScript(`(async()=>{const wait=ms=>new Promise(r=>setTimeout(r,ms));await wait(700);const open=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('Settings'));if(!open)return{ok:false,stage:'open-button'};open.click();await wait(500);const panel=document.querySelector('.settings-panel');if(!panel)return{ok:false,stage:'panel-open'};const close=panel.querySelector('header button');if(!close)return{ok:false,stage:'close-button'};close.click();await wait(700);return{ok:!document.querySelector('.settings-panel')&&!!document.querySelector('.app'),stage:'closed'}})()`); console.log('SETTINGS_SMOKE', JSON.stringify(result)); app.exit(result.ok ? 0 : 1); } catch (error) { console.error('SETTINGS_SMOKE_ERROR', error); app.exit(1); } });
}

function watchFolders(folders) {
  for (const [folder, watcher] of folderWatchers) if (!folders.includes(folder)) { watcher.close(); folderWatchers.delete(folder); }
  for (const folder of folders) {
    if (folderWatchers.has(folder) || !fs.existsSync(folder)) continue;
    try {
      const watcher = fs.watch(folder, { recursive: true }, () => {
        clearTimeout(watchTimer);
        watchTimer = setTimeout(async () => {
          try { const state = await scanLibrary(); win?.webContents.send('library:updated', state); } catch {}
        }, 1200);
      });
      watcher.on('error', () => { watcher.close(); folderWatchers.delete(folder); });
      folderWatchers.set(folder, watcher);
    } catch {}
  }
}

app.whenReady().then(async () => { await cleanExpiredWaveforms(); createWindow(); app.on('activate', () => BrowserWindow.getAllWindows().length || createWindow()); });
app.on('window-all-closed', () => process.platform !== 'darwin' && app.quit());
app.on('before-quit', () => { clearTimeout(watchTimer); for (const watcher of folderWatchers.values()) watcher.close(); folderWatchers.clear(); });

ipcMain.handle('library:get-state', async () => { const s = await getStore(); const collapsed = collapseDuplicates([...s.get('items'), ...s.get('duplicates', [])].map(x => x.category ? x : { ...x, category: categoryFromPath(x.path) })); s.set('items', collapsed.visible); s.set('duplicates', collapsed.duplicates); watchFolders(s.get('folders')); return { folders: s.get('folders'), items: collapsed.visible, collections: s.get('collections') }; });
ipcMain.handle('library:choose-folders', async () => {
  const result = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'multiSelections'] });
  if (result.canceled) { const s = await getStore(); return { folders: s.get('folders'), items: s.get('items'), collections: s.get('collections') }; }
  const s = await getStore();
  const previous = s.get('folders');
  const folders = [...new Set([...previous, ...result.filePaths])];
  s.set('folders', folders);
  watchFolders(folders);
  return folders.length === previous.length ? { folders, items: s.get('items'), collections: s.get('collections') } : scanLibrary();
});
ipcMain.handle('library:scan', scanLibrary);
ipcMain.handle('library:clear', async () => { const s = await getStore(); s.set('folders', []); s.set('items', []); s.set('duplicates', []); s.set('migrationComplete', true); clearTimeout(watchTimer); watchFolders([]); return { folders: [], items: [], collections: s.get('collections') }; });
ipcMain.handle('library:remove-folder', async (_, folder) => {
  const s = await getStore(), target = path.resolve(String(folder || ''));
  const folders = s.get('folders').filter(x => path.resolve(x).toLowerCase() !== target.toLowerCase());
  const inside = file => { const relative = path.relative(target, file); return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative)); };
  s.set('folders', folders);
  s.set('items', s.get('items').filter(item => !inside(item.path)));
  s.set('duplicates', s.get('duplicates', []).filter(item => !inside(item.path)));
  s.set('migrationComplete', true);
  watchFolders(folders);
  return scanLibrary();
});
ipcMain.handle('library:update-item', async (_, id, patch) => { const s = await getStore(); const items = s.get('items').map(x => x.id === id ? { ...x, ...patch } : x); s.set('items', items); return items.find(x => x.id === id); });
ipcMain.handle('library:rename-category', async (_, kind, oldName, newName) => { const s = await getStore(); const name = String(newName || '').trim(); if (!name) throw new Error('Tên danh mục không được để trống.'); const items = s.get('items').map(x => x.kind === kind && x.category === oldName ? { ...x, category: name } : x); s.set('items', items); return items; });
ipcMain.handle('library:add-collection', async (_, name) => { const s = await getStore(); const collections = [...new Set([...s.get('collections'), name.trim()])].filter(Boolean); s.set('collections', collections); return collections; });
ipcMain.handle('library:export', async () => {
  const s = await getStore(), result = await dialog.showOpenDialog(win, { title: 'Chọn nơi lưu gói export ProjectA', properties: ['openDirectory', 'createDirectory'] });
  if (result.canceled || !result.filePaths[0]) return null;
  const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19), root = path.join(result.filePaths[0], `ProjectA-Export-${stamp}`), mediaRoot = path.join(root, 'Media');
  await fs.promises.mkdir(mediaRoot, { recursive: true });
  const items = s.get('items').filter(item => !item.missing && fs.existsSync(item.path));
  const safe = value => String(value || 'Khác').replace(/[<>:"/\\|?*]/g, '_').trim() || 'Khác';
  for (const item of items) {
    const folder = path.join(mediaRoot, item.kind === 'sfx' ? 'SFX' : 'Video', safe(item.category));
    await fs.promises.mkdir(folder, { recursive: true });
    let destination = path.join(folder, item.name), index = 2;
    while (fs.existsSync(destination)) { const ext = path.extname(item.name), base = path.basename(item.name, ext); destination = path.join(folder, `${base} (${index++})${ext}`); }
    await fs.promises.copyFile(item.path, destination);
  }
  const data = { exportedAt: new Date().toISOString(), version: 2, folders: s.get('folders'), collections: s.get('collections'), items: s.get('items') };
  await fs.promises.writeFile(path.join(root, 'projecta-library.json'), JSON.stringify(data, null, 2), 'utf8');
  return root;
});
ipcMain.handle('cache:get-waveform', (_, key) => { try { return JSON.parse(fs.readFileSync(waveformFile(key), 'utf8')); } catch { return null; } });
ipcMain.handle('cache:set-waveform', (_, key, peaks) => { fs.mkdirSync(waveformRoot(), { recursive: true }); fs.writeFileSync(waveformFile(key), JSON.stringify(peaks)); return true; });
ipcMain.handle('app:clear-cache', async () => { fs.rmSync(waveformRoot(), { recursive: true, force: true }); await win.webContents.session.clearCache(); return true; });
ipcMain.handle('app:cache-info', async () => ({ path: cacheRoot(), size: directorySize(cacheRoot()) }));
ipcMain.handle('app:cache-location-choose', async () => {
  const result = await dialog.showOpenDialog(win, { title: 'Chọn thư mục lưu cache ProjectA', defaultPath: cacheRoot(), properties: ['openDirectory', 'createDirectory'] });
  if (result.canceled || !result.filePaths[0]) return null;
  const oldRoot = path.resolve(cacheRoot()), nextRoot = path.resolve(result.filePaths[0]);
  if (oldRoot.toLowerCase() === nextRoot.toLowerCase()) return { path: oldRoot, size: directorySize(oldRoot) };
  if (nextRoot.toLowerCase().startsWith(`${oldRoot.toLowerCase()}${path.sep}`)) throw new Error('Không thể đặt cache bên trong thư mục cache hiện tại.');
  fs.mkdirSync(nextRoot, { recursive: true });
  if (fs.existsSync(oldRoot)) fs.cpSync(oldRoot, nextRoot, { recursive: true, force: true });
  fs.writeFileSync(cacheSettingsFile(), JSON.stringify({ path: nextRoot }, null, 2), 'utf8');
  try { fs.rmSync(oldRoot, { recursive: true, force: true }); } catch {}
  return { path: nextRoot, size: directorySize(nextRoot) };
});
ipcMain.handle('app:cache-policy-get', async () => { const s = await getStore(); return { days: Number(s.get('cacheMaxAgeDays', 0)) }; });
ipcMain.handle('app:cache-policy-set', async (_, days) => { const s = await getStore(); const value = Math.max(0, Number(days) || 0); s.set('cacheMaxAgeDays', value); await cleanExpiredWaveforms(); return { days: value }; });
ipcMain.handle('app:set-theme', (_, dark) => { win.setTitleBarOverlay({ color: dark ? '#0b0d10' : '#ffffff', symbolColor: dark ? '#aeb5c0' : '#202833', height: 42 }); win.setBackgroundColor(dark ? '#0b0d10' : '#f4f6f8'); return true; });
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
