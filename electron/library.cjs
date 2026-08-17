const path = require('path');

const AUDIO = new Set(['.wav', '.mp3', '.flac', '.aac', '.m4a', '.ogg', '.wma']);
const VIDEO = new Set(['.mp4', '.mov', '.mkv', '.avi', '.webm', '.m4v', '.gif']);

function isMediaFile(file) {
  const ext = path.extname(file).toLowerCase();
  return AUDIO.has(ext) || VIDEO.has(ext);
}

function mediaPathKey(file) {
  // Both supported desktop platforms normally use case-insensitive volumes. Keeping
  // the normalization here makes comparisons independent of slash style.
  return path.normalize(file).toLocaleLowerCase();
}

function categoryFromPath(file) {
  return path.basename(path.dirname(file)) || 'Khác';
}

function normalizedMediaName(name) {
  return path.basename(name, path.extname(name)).toLowerCase()
    .replace(/\b(copy|duplicate|ban sao)\b/g, '')
    .replace(/\s*\(\d+\)\s*$/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

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
    const match = visible.find(saved => !saved.missing && (saved.hash === item.hash || (
      normalizedMediaName(saved.name) === normalizedMediaName(item.name)
      && Math.abs((saved.duration || 0) - (item.duration || 0)) <= Math.max(.18, (saved.duration || 0) * .015)
      && waveformSimilarity(saved.waveformSignature, item.waveformSignature) >= .985
    )));
    if (match) duplicates.push({ ...item, duplicateOf: match.id }); else visible.push(item);
  }
  return { visible, duplicates };
}

function durationFromMetadata(saved, unchanged, meta) {
  if (unchanged && saved.duration !== undefined) return saved.duration;
  const duration = Number(meta?.format?.duration);
  return Number.isFinite(duration) ? duration : (saved.duration || 0);
}

function createScannedItem({ file, stat, saved = {}, hash, metadata, waveformSignature, createId }) {
  const ext = path.extname(file).toLowerCase();
  const unchanged = Boolean(saved.id && saved.size === stat.size && saved.modifiedAt === stat.mtimeMs);
  const stream = metadata?.streams?.find(item => item.codec_type === 'video') || {};
  return {
    id: saved.id || createId(), path: file, name: path.basename(file), ext: ext.slice(1),
    kind: AUDIO.has(ext) ? 'sfx' : 'video', size: stat.size, modifiedAt: stat.mtimeMs,
    addedAt: saved.addedAt || Date.now(), duration: durationFromMetadata(saved, unchanged, metadata),
    width: stream.width || saved.width || 0, height: stream.height || saved.height || 0,
    hash, favorite: saved.favorite || false, tags: saved.tags || [], collections: saved.collections || [],
    category: saved.category || categoryFromPath(file), waveformSignature, missing: false
  };
}

function sanitizeItemPatch(patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new Error('Dữ liệu cập nhật không hợp lệ.');
  const allowed = {};
  if ('favorite' in patch) {
    if (typeof patch.favorite !== 'boolean') throw new Error('favorite phải là boolean.');
    allowed.favorite = patch.favorite;
  }
  for (const field of ['category']) if (field in patch) {
    if (typeof patch[field] !== 'string' || !patch[field].trim() || patch[field].length > 120) throw new Error(`${field} không hợp lệ.`);
    allowed[field] = patch[field].trim();
  }
  for (const field of ['tags', 'collections']) if (field in patch) {
    if (!Array.isArray(patch[field]) || patch[field].length > 100 || patch[field].some(value => typeof value !== 'string' || !value.trim() || value.length > 120)) throw new Error(`${field} không hợp lệ.`);
    allowed[field] = [...new Set(patch[field].map(value => value.trim()))];
  }
  if (!Object.keys(allowed).length) throw new Error('Không có trường nào được phép cập nhật.');
  return allowed;
}

function isPathInside(root, file) {
  const relative = path.relative(path.resolve(root), path.resolve(file));
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

module.exports = { AUDIO, VIDEO, isMediaFile, mediaPathKey, categoryFromPath, collapseDuplicates, createScannedItem, sanitizeItemPatch, isPathInside };
