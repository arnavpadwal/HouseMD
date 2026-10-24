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
