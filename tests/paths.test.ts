import assert from 'node:assert/strict';
import test from 'node:test';
import { baseName, dirName, joinPath, normalizePath } from '../src/paths.ts';

test('baseName handles POSIX and Windows separators', () => {
  assert.equal(baseName('/home/me/notes.md'), 'notes.md');
  assert.equal(baseName('C:\\Users\\me\\notes.md'), 'notes.md');
  assert.equal(baseName(''), 'Untitled.md');
});

test('dirName handles POSIX and Windows separators', () => {
  assert.equal(dirName('/home/me/notes.md'), '/home/me');
  assert.equal(dirName('C:\\Users\\me\\notes.md'), 'C:\\Users\\me');
  assert.equal(dirName('notes.md'), '');
});

test('joinPath uses the directory separator', () => {
  assert.equal(joinPath('/home/me', 'notes.md'), '/home/me/notes.md');
  assert.equal(joinPath('/home/me/', 'notes.md'), '/home/me/notes.md');
  assert.equal(joinPath('C:\\Users\\me', 'notes.md'), 'C:\\Users\\me\\notes.md');
});

test('normalizePath collapses dot segments', () => {
  assert.equal(normalizePath('/home/me/../notes/./a.md'), '/home/notes/a.md');
  assert.equal(normalizePath('C:\\Users\\me\\..\\notes.md'), 'C:\\Users\\notes.md');
});
