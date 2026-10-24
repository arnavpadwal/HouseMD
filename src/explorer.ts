import { readDir } from '@tauri-apps/plugin-fs';
import { icons } from './content';
import { escapeHtml } from './markdown';
import { joinPath } from './paths';

type Entry = Awaited<ReturnType<typeof readDir>>[number];

export interface ExplorerOptions {
  allowDirectory: (path: string) => Promise<void>;
  openFile: (path: string) => void;
  requestOpenFolder: () => void;
  onChange: () => void;
  onError: (title: string, error: unknown) => void;
  isActiveFile: (path: string) => boolean;
}

export interface Explorer {
  readonly root: string;
  setRoot: (root: string) => Promise<void>;
  setRootPath: (root: string) => void;
  refresh: () => Promise<void>;
  isLoaded: () => boolean;
  render: () => string;
  bind: (container: HTMLElement | null) => void;
}

const HIDDEN_NAMES = new Set(['.git', 'node_modules', '.DS_Store']);
const SUPPORTED_FILE = /\.(?:md|markdown|mdown|txt|tex|latex|bib|sty|cls)$/i;

export function createExplorer(options: ExplorerOptions): Explorer {
  let root = '';
  const expanded = new Set<string>();
  const entries = new Map<string, Entry[]>();
  const errors = new Set<string>();

  async function load(directory: string) {
    try {
      const listing = (await readDir(directory))
        .filter(
          (entry) =>
            !HIDDEN_NAMES.has(entry.name) && (entry.isDirectory || (entry.isFile && SUPPORTED_FILE.test(entry.name))),
        )
        .sort(
          (a, b) =>
            Number(b.isDirectory) - Number(a.isDirectory) ||
            a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
        );
      entries.set(directory, listing);
      errors.delete(directory);
    } catch (error) {
      errors.add(directory);
      options.onError('Could not read folder', error);
    }
  }

  async function setRoot(next: string) {
    root = next;
    expanded.clear();
    entries.clear();
    errors.clear();
    if (root) {
      try {
        await options.allowDirectory(root);
      } catch (error) {
        errors.add(root);
        options.onError('Could not access folder', error);
        options.onChange();
        return;
      }
      await load(root);
    }
    options.onChange();
  }

  async function refresh() {
    if (!root) return;
    await load(root);
    options.onChange();
  }

  async function toggle(directory: string) {
    if (expanded.has(directory)) {
      expanded.delete(directory);
    } else {
      expanded.add(directory);
      if (!entries.has(directory)) await load(directory);
    }
    options.onChange();
  }

  function renderDirectory(directory: string, depth: number): string {
    const listing = entries.get(directory);
    if (!listing) {
      if (errors.has(directory)) {
        return `<div class="tree-muted tree-error" style="--indent:${depth * 13}px">Could not read this folder.</div>`;
      }
      return `<div class="tree-muted" style="--indent:${depth * 13}px">Loading…</div>`;
    }
    if (!listing.length) {
      return depth === 0
        ? `<div class="tree-empty"><p>No supported text files here.</p><button type="button" class="tree-action" data-tree-action="open-folder">Choose another folder</button></div>`
        : '';
    }
    return listing
      .map((entry) => {
        const fullPath = joinPath(directory, entry.name);
        if (entry.isDirectory) {
          const isOpen = expanded.has(fullPath);
          return `<button type="button" class="tree-row tree-dir${isOpen ? ' open' : ''}" data-dir-path="${escapeHtml(fullPath)}" style="--indent:${depth * 13}px" title="${escapeHtml(fullPath)}"><span class="tree-chevron">${icons.chevron}</span>${icons.folder}<span class="tree-name">${escapeHtml(entry.name)}</span></button>${isOpen ? renderDirectory(fullPath, depth + 1) : ''}`;
        }
        const active = options.isActiveFile(fullPath);
        return `<button type="button" class="tree-row tree-file${active ? ' active' : ''}" data-file-path="${escapeHtml(fullPath)}" style="--indent:${depth * 13}px" title="${escapeHtml(fullPath)}">${icons.file}<span class="tree-name">${escapeHtml(entry.name)}</span></button>`;
      })
      .join('');
  }

  function render() {
    if (!root) {
      return `<div class="tree-empty"><p>No folder open.</p><button type="button" class="tree-action" data-tree-action="open-folder">Open a folder</button></div>`;
    }
    if (!entries.has(root)) {
      if (errors.has(root)) {
        return `<div class="tree-empty"><p>Could not read this folder.</p><button type="button" class="tree-action" data-tree-action="refresh">Try again</button></div>`;
      }
      return `<div class="tree-muted">Loading…</div>`;
    }
    return renderDirectory(root, 0);
  }

  function bind(container: HTMLElement | null) {
    if (!container || container.dataset.explorerBound === 'true') return;
    container.dataset.explorerBound = 'true';
    container.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      const action = target.closest<HTMLElement>('[data-tree-action]')?.dataset.treeAction;
      if (action === 'open-folder') {
        options.requestOpenFolder();
        return;
      }
      if (action === 'refresh') {
        void refresh();
        return;
      }
      const directory = target.closest<HTMLElement>('[data-dir-path]')?.dataset.dirPath;
      if (directory) {
        void toggle(directory);
        return;
      }
      const file = target.closest<HTMLElement>('[data-file-path]')?.dataset.filePath;
      if (file) options.openFile(file);
    });
  }

  return {
    get root() {
      return root;
    },
    setRoot,
    setRootPath(next: string) {
      root = next;
      expanded.clear();
      entries.clear();
      errors.clear();
    },
    refresh,
    isLoaded: () => entries.has(root),
    render,
    bind,
  };
}
