import { describe, expect, it } from 'vitest';
import library from '../electron/library.cjs';

const { collapseDuplicates, createScannedItem, isPathInside, sanitizeItemPatch } = library;

describe('library scan', () => {
  it('refreshes duration when an indexed file changes', () => {
    const item = createScannedItem({ file: '/media/clip.mp4', stat: { size: 20, mtimeMs: 2 }, saved: { id: 'old', size: 10, modifiedAt: 1, duration: 5 }, hash: 'next', metadata: { format: { duration: '12.5' }, streams: [] }, waveformSignature: [], createId: () => 'new' });
    expect(item.duration).toBe(12.5);
  });

  it('keeps cached duration only for unchanged files', () => {
    const item = createScannedItem({ file: '/media/clip.mp4', stat: { size: 10, mtimeMs: 1 }, saved: { id: 'old', size: 10, modifiedAt: 1, duration: 5 }, hash: 'old', metadata: { format: { duration: '12.5' }, streams: [] }, waveformSignature: [], createId: () => 'new' });
    expect(item.duration).toBe(5);
  });
});

describe('deduplication', () => {
  it('hides an exact hash duplicate', () => {
    const result = collapseDuplicates([{ id: 'one', name: 'hit.wav', hash: 'same', duration: 1, waveformSignature: [] }, { id: 'two', name: 'copy.wav', hash: 'same', duration: 1, waveformSignature: [] }]);
    expect(result.visible).toHaveLength(1);
    expect(result.duplicates).toMatchObject([{ id: 'two', duplicateOf: 'one' }]);
  });
});

describe('IPC input helpers', () => {
  it('only permits editable item fields', () => expect(sanitizeItemPatch({ favorite: true, path: '/other/file' })).toEqual({ favorite: true }));
  it('rejects invalid patch data', () => expect(() => sanitizeItemPatch({ favorite: 'yes' })).toThrow());
  it('handles platform-native relative paths without string prefix checks', () => {
    expect(isPathInside('/library', '/library/sfx/hit.wav')).toBe(true);
    expect(isPathInside('/library', '/library-other/hit.wav')).toBe(false);
  });
});
