export function baseName(path: string, fallback = 'Untitled.md') {
  return path.split(/[\\/]/).pop() || fallback;
}

export function dirName(path: string) {
  const index = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  return index > 0 ? path.slice(0, index) : '';
}

export function joinPath(directory: string, name: string) {
  if (!directory) return name;
  const separator = directory.includes('\\') && !directory.includes('/') ? '\\' : '/';
  return directory.endsWith('/') || directory.endsWith('\\')
    ? `${directory}${name}`
    : `${directory}${separator}${name}`;
}

export function normalizePath(path: string) {
  const separator = path.includes('\\') && !path.includes('/') ? '\\' : '/';
  const parts = path.split(/[\\/]+/);
  const output: string[] = [];
  for (const part of parts) {
    if (part === '.' || part === '') {
      if (output.length === 0 && path.startsWith('/')) output.push('');
      continue;
    }
    if (part === '..') {
      if (output.length > 1) output.pop();
      continue;
    }
    output.push(part);
  }
  const result = output.join(separator);
  return result || separator;
}

export type FileKind = 'markdown' | 'latex' | 'text';

export function fileKind(path: string): FileKind {
  const extension = path.split(/[\\/]/).pop()?.split('.').pop()?.toLowerCase() ?? '';
  if (extension === 'tex' || extension === 'latex' || extension === 'sty' || extension === 'cls') return 'latex';
  if (extension === 'md' || extension === 'markdown' || extension === 'mdown') return 'markdown';
  return 'text';
}

export function isLatexDocument(path: string) {
  const extension = path.split(/[\\/]/).pop()?.split('.').pop()?.toLowerCase() ?? '';
  return extension === 'tex' || extension === 'latex';
}

export function isSupportedFile(path: string) {
  return /\.(?:md|markdown|mdown|txt|tex|latex|bib|sty|cls)$/i.test(path);
}
