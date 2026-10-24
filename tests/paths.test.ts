import assert from 'node:assert/strict';
import test from 'node:test';
import {
  baseName,
  dirName,
  fileKind,
  isLatexDocument,
  isSupportedFile,
  joinPath,
  normalizePath,
} from '../src/paths.ts';

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

test('classifies Markdown, LaTeX, and plain text files', () => {
  assert.equal(fileKind('/docs/README.md'), 'markdown');
  assert.equal(fileKind('/docs/paper.tex'), 'latex');
  assert.equal(fileKind('/docs/paper.LATEX'), 'latex');
  assert.equal(fileKind('/docs/refs.bib'), 'text');
  assert.equal(fileKind('/docs/notes.txt'), 'text');
});

test('supports LaTeX workspace extensions', () => {
  assert.equal(isLatexDocument('/docs/paper.tex'), true);
  assert.equal(isLatexDocument('/docs/paper.sty'), false);
  assert.equal(isSupportedFile('/docs/paper.tex'), true);
  assert.equal(isSupportedFile('/docs/refs.bib'), true);
  assert.equal(isSupportedFile('/docs/paper.pdf'), false);
});
