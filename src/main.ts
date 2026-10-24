import './style.css';
import '@fontsource-variable/source-sans-3/wght.css';
import '@fontsource-variable/source-code-pro/wght.css';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { ask, message, open, save } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { openUrl } from '@tauri-apps/plugin-opener';
import { escapeHtml, renderMarkdown } from './markdown';
import { helpItems, icons, sample, type HelpItem } from './content';

const inTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
const appWindow = inTauri ? getCurrentWindow() : null;

/* ---------- Application state ---------- */

let content = sample;
let savedContent = sample;
let currentPath = '';
let mode: 'read' | 'focus' | 'split' = 'split';
const storedTheme = localStorage.getItem('housemd-theme');
let theme: 'light' | 'dark' =
  storedTheme === 'light' || storedTheme === 'dark'
    ? storedTheme
    : matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
let helpOpen = false;
let helpPosition = '';
let dirty = false;
let splitRatio = Math.max(0.25, Math.min(0.75, Number(localStorage.getItem('housemd-split-ratio')) || 0.5));
let previewTimer: number | undefined;
let diagramTimer: number | undefined;
let titleTimer: number | undefined;
let closePromptOpen = false;
let forceClosing = false;

/* ---------- Path and text helpers ---------- */

function baseName(path: string) {
  return path.split(/[\\/]/).pop() || 'Untitled.md';
}

function dirName(path: string) {
  const index = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  return index > 0 ? path.slice(0, index) : '';
}

function normalizePath(path: string) {
  const separator = path.includes('\\') ? '\\' : '/';
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

function docName() {
  return currentPath ? baseName(currentPath) : 'Untitled.md';
}

function statusText() {
  if (dirty) return 'Unsaved';
  return currentPath ? 'Saved' : 'Draft';
}

function statusDot() {
  return `<i class="live-dot${dirty ? ' unsaved' : ''}"></i>`;
}

function statsText() {
  const lines = content.split('\n').length;
  return `${lines} ${lines === 1 ? 'line' : 'lines'} · ${content.length} ${content.length === 1 ? 'character' : 'characters'}`;
}

/* ---------- Preview rendering ---------- */

async function drawMermaid() {
  if (!document.querySelector('.mermaid')) return;
  const { default: mermaid } = await import('mermaid');
  mermaid.initialize({
    startOnLoad: false,
    theme: theme === 'light' ? 'default' : 'dark',
    securityLevel: 'strict',
    flowchart: { useMaxWidth: true, htmlLabels: true, wrappingWidth: 260 },
    themeVariables: { fontFamily: "'Source Sans 3 Variable', 'Source Sans 3', sans-serif" },
  });
  await mermaid
    .run({ querySelector: '.mermaid' })
    .catch((error) => console.error('Mermaid diagram could not be rendered', error));
}

function scheduleMermaid(delay = 350) {
  if (diagramTimer) clearTimeout(diagramTimer);
  diagramTimer = window.setTimeout(() => {
    diagramTimer = undefined;
    void drawMermaid();
  }, delay);
}

function resolvePreviewAssets(root: HTMLElement) {
  if (!inTauri || !currentPath) return;
  const base = dirName(currentPath);
  root.querySelectorAll<HTMLImageElement>('img[src]').forEach((image) => {
    const src = image.getAttribute('src') ?? '';
    const isDrivePath = /^[A-Za-z]:[\\/]/.test(src);
    if (!src || (!isDrivePath && /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(src))) return;
    let clean = src.split(/[?#]/)[0];
    try {
      clean = decodeURIComponent(clean);
    } catch {
      /* keep the original value */
    }
    const full = clean.startsWith('/') || /^[A-Za-z]:[\\/]/.test(clean) || !base ? clean : `${base}/${clean}`;
    try {
      image.src = convertFileSrc(normalizePath(full));
    } catch {
      /* leave the image untouched */
    }
  });
}

function refreshPreview() {
  const preview = document.querySelector<HTMLElement>('#preview');
  if (!preview) return;
  const scroll = preview.scrollTop;
  preview.innerHTML = renderMarkdown(content);
  resolvePreviewAssets(preview);
  preview.scrollTop = scroll;
  scheduleMermaid();
}

function schedulePreview() {
  if (previewTimer !== undefined) return;
  previewTimer = window.setTimeout(() => {
    previewTimer = undefined;
    refreshPreview();
  }, 80);
}

/* ---------- Window chrome ---------- */

function syncWindowTitle() {
  if (!appWindow) return;
  if (titleTimer) clearTimeout(titleTimer);
  titleTimer = window.setTimeout(() => {
    const name = docName();
    void appWindow.setTitle(`${dirty ? '• ' : ''}${name} — HouseMD`).catch(() => undefined);
  }, 120);
}

function updateChrome() {
  const title = document.querySelector<HTMLElement>('.title-center');
  if (title) {
    title.title = currentPath || 'Untitled.md';
    title.innerHTML = `${escapeHtml(docName())}${dirty ? '<span class="dirty"> •</span>' : ''}`;
  }
  const status = document.querySelector<HTMLElement>('.bottom-bar > span:first-child');
  if (status) status.innerHTML = `${statusDot()}${statusText()}`;
  const stats = document.querySelector<HTMLElement>('#stats');
  if (stats) stats.textContent = statsText();
  syncWindowTitle();
}

function markDirty(next: boolean) {
  dirty = next;
  updateChrome();
}

/* ---------- Markdown help ---------- */

function placeHelpNearCaret() {
  const editor = document.querySelector<HTMLTextAreaElement>('#editor');
  const shell = document.querySelector<HTMLElement>('.window');
  if (!editor || !shell || mode === 'read' || !editor.offsetParent) {
    helpPosition = '';
    return;
  }
  const style = getComputedStyle(editor),
    box = editor.getBoundingClientRect(),
    frame = shell.getBoundingClientRect();
  const before = editor.value.slice(0, editor.selectionStart),
    line = before.slice(before.lastIndexOf('\n') + 1);
  const canvas = document.createElement('canvas'),
    ctx = canvas.getContext('2d');
  if (ctx) ctx.font = style.font;
  const left =
    box.left - frame.left + parseFloat(style.paddingLeft) + (ctx?.measureText(line).width ?? 0) - editor.scrollLeft;
  const top =
    box.top -
    frame.top +
    parseFloat(style.paddingTop) +
    (before.split('\n').length - 1) * parseFloat(style.lineHeight) -
    editor.scrollTop +
    parseFloat(style.lineHeight);
  helpPosition = `style="--help-left:${Math.max(12, Math.min(left, frame.width - 462))}px;--help-top:${Math.max(74, Math.min(top, frame.height - 430))}px;--help-transform:none"`;
}

function helpMarkup() {
  return `<div class="help-backdrop" data-action="close-help"></div><section class="help-box" ${helpPosition} role="dialog" aria-modal="true" aria-label="Markdown help"><div class="help-top"><div class="help-title">Markdown</div><button class="icon-btn help-close" data-action="close-help" aria-label="Close help">${icons.close}</button></div><label class="help-search">${icons.search}<input id="help-search" placeholder="Search syntax…" autocomplete="off"><kbd>ESC</kbd></label><div class="help-list">${helpItems.map((item, index) => `<button class="help-item" data-help-index="${index}" data-name="${escapeHtml(`${item.name} ${item.description} ${item.syntax}`.toLowerCase())}"><span class="help-item-name">${item.name}</span><span class="help-item-info"><code>${escapeHtml(item.syntax).replaceAll('\n', '<br>')}</code><small>${item.description}</small></span></button>`).join('')}</div></section>`;
}

function openHelp() {
  if (helpOpen) return;
  placeHelpNearCaret();
  helpOpen = true;
  document.querySelector<HTMLElement>('.window')?.insertAdjacentHTML('beforeend', helpMarkup());
  bindHelp();
  document.querySelector<HTMLInputElement>('#help-search')?.focus();
}

function closeHelp(focusEditor = true) {
  if (!helpOpen) return;
  helpOpen = false;
  document.querySelector('.help-backdrop')?.remove();
  document.querySelector('.help-box')?.remove();
  if (focusEditor) document.querySelector<HTMLTextAreaElement>('#editor')?.focus();
}

function bindHelp() {
  document.querySelectorAll<HTMLElement>('[data-action="close-help"]').forEach((button) => {
    button.addEventListener('click', () => closeHelp());
  });
  const search = document.querySelector<HTMLInputElement>('#help-search');
  search?.addEventListener('input', () => {
    const query = search.value.toLowerCase();
    document.querySelectorAll<HTMLElement>('.help-item').forEach((item) => {
      item.hidden = !item.dataset.name!.includes(query);
    });
  });
  document.querySelectorAll<HTMLElement>('[data-help-index]').forEach((button) => {
    button.addEventListener('click', () => {
      const item = helpItems[Number(button.dataset.helpIndex)];
      if (!item) return;
      closeHelp(false);
      insertHelpItem(item);
    });
  });
}

function insertHelpItem(item: HelpItem) {
  const wasReadMode = mode === 'read';
  if (wasReadMode) setMode('split');
  const editor = document.querySelector<HTMLTextAreaElement>('#editor');
  if (!editor) return;
  const start = editor.selectionStart,
    end = editor.selectionEnd;
  const selected = editor.value.slice(start, end);
  let snippet = item.insert;
  let selectionStart = start;
  let selectionEnd = start + snippet.length;
  if (item.wrap) {
    const [before, after, placeholder] = item.wrap;
    const body = selected || placeholder;
    snippet = `${before}${body}${after}`;
    if (selected) {
      selectionStart = start + before.length;
      selectionEnd = selectionStart + body.length;
    } else {
      selectionStart = start + before.length;
      selectionEnd = selectionStart + placeholder.length;
    }
  }
  editor.value = editor.value.slice(0, start) + snippet + editor.value.slice(end);
  editor.setSelectionRange(selectionStart, selectionEnd);
  content = editor.value;
  markDirty(content !== savedContent);
  editor.focus();
  refreshPreview();
}

/* ---------- View mode, theme, and menus ---------- */

function setSplitColumns(workspace: HTMLElement) {
  workspace.style.gridTemplateColumns = `minmax(0, ${splitRatio}fr) 8px minmax(0, ${1 - splitRatio}fr)`;
}

function setMode(next: typeof mode) {
  closeHelp(false);
  mode = next;
  const workspace = document.querySelector<HTMLElement>('.workspace');
  if (workspace) {
    workspace.classList.remove('mode-read', 'mode-focus', 'mode-split');
    workspace.classList.add(`mode-${mode}`);
    if (mode === 'split') setSplitColumns(workspace);
    else workspace.style.gridTemplateColumns = '';
  }
  document
    .querySelectorAll<HTMLElement>('[data-mode]')
    .forEach((button) => button.classList.toggle('active', button.dataset.mode === mode));
  if (mode !== 'read') document.querySelector<HTMLTextAreaElement>('#editor')?.focus();
}

function setTheme(next: typeof theme) {
  theme = next;
  document.documentElement.dataset.theme = theme;
  localStorage.setItem('housemd-theme', theme);
  const button = document.querySelector<HTMLElement>('.theme-toggle');
  if (button) button.innerHTML = theme === 'light' ? icons.moon : icons.sun;
  refreshPreview();
}

function toggleAppMenu() {
  const menu = document.querySelector<HTMLElement>('.app-menu');
  const button = document.querySelector<HTMLElement>('[data-action="menu"]');
  if (!menu || !button) return;
  const nextOpen = menu.hidden;
  menu.hidden = !nextOpen;
  button.setAttribute('aria-expanded', String(nextOpen));
}

function closeAppMenu() {
  const menu = document.querySelector<HTMLElement>('.app-menu');
  if (!menu || menu.hidden) return;
  menu.hidden = true;
  document.querySelector<HTMLElement>('[data-action="menu"]')?.setAttribute('aria-expanded', 'false');
}

/* ---------- Shell rendering and event wiring ---------- */

function renderApp() {
  closeAppMenu();
  helpOpen = false;
  document.documentElement.dataset.theme = theme;
  document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <main class="window">
   <header class="titlebar"><div class="brand"><span class="brandmark">h.</span></div><div class="title-center" title="${escapeHtml(currentPath || 'Untitled.md')}">${escapeHtml(docName())}${dirty ? '<span class="dirty"> •</span>' : ''}</div><div class="top-actions"><div class="mode-switch"><button data-mode="read" class="${mode === 'read' ? 'active' : ''}">Read</button><button data-mode="focus" class="${mode === 'focus' ? 'active' : ''}">Focus</button><button data-mode="split" class="${mode === 'split' ? 'active' : ''}">Split</button></div><button class="icon-btn" data-action="help" title="Markdown help (Ctrl+/)" aria-label="Markdown help">${icons.search}</button><span class="divider"></span><button class="icon-btn" data-action="new" title="New document (Ctrl+N)" aria-label="New document">${icons.file}</button><button class="icon-btn" data-action="open" title="Open (Ctrl+O)" aria-label="Open">${icons.folder}</button><button class="icon-btn" data-action="save" title="Save (Ctrl+S)" aria-label="Save">${icons.save}</button><button class="icon-btn theme-toggle" data-action="theme" title="Toggle appearance" aria-label="Toggle appearance">${theme === 'light' ? icons.moon : icons.sun}</button><button class="export-btn" data-action="pdf" title="Print or save as PDF (Ctrl+P)">${icons.pdf}<span>PDF</span></button><div class="app-menu-wrap"><button class="icon-btn" data-action="menu" title="More actions" aria-label="More actions" aria-haspopup="menu" aria-expanded="false">${icons.menu}</button><div class="app-menu" role="menu" hidden><button role="menuitem" data-action="new">New document<span>Ctrl+N</span></button><button role="menuitem" data-action="save-as">Save as…<span>Ctrl+Shift+S</span></button><button role="menuitem" data-action="help">Markdown guide<span>Ctrl+/</span></button><button role="menuitem" data-action="pdf">Print / PDF<span>Ctrl+P</span></button></div></div></div></header>
   <section class="workspace mode-${mode}"><div class="editor-pane"><textarea id="editor" spellcheck="false" aria-label="Markdown editor">${escapeHtml(content)}</textarea></div><div class="pane-divider" role="separator" aria-orientation="vertical" aria-label="Resize panes" tabindex="0"></div><div class="preview-pane"><article class="rendered" id="preview"></article></div></section>
   <footer class="bottom-bar"><span>${statusDot()}${statusText()}</span><span id="stats">${statsText()}</span></footer>
  </main>`;
  bind();
  if (mode === 'split') setSplitColumns(document.querySelector<HTMLElement>('.workspace')!);
  refreshPreview();
  updateChrome();
  if (mode !== 'read') document.querySelector<HTMLTextAreaElement>('#editor')?.focus();
}

function bind() {
  const editor = document.querySelector<HTMLTextAreaElement>('#editor');
  editor?.addEventListener('input', () => {
    content = editor.value;
    markDirty(content !== savedContent);
    schedulePreview();
  });

  const workspace = document.querySelector<HTMLElement>('.workspace'),
    splitter = document.querySelector<HTMLElement>('.pane-divider');
  if (workspace && splitter) {
    splitter.addEventListener('pointerdown', (event) => {
      if (mode !== 'split') return;
      event.preventDefault();
      splitter.setPointerCapture(event.pointerId);
    });
    splitter.addEventListener('pointermove', (event) => {
      if (!splitter.hasPointerCapture(event.pointerId)) return;
      const box = workspace.getBoundingClientRect();
      splitRatio = Math.max(0.25, Math.min(0.75, (event.clientX - box.left) / (box.width - 8)));
      setSplitColumns(workspace);
    });
    const stop = () => localStorage.setItem('housemd-split-ratio', String(splitRatio));
    splitter.addEventListener('pointerup', stop);
    splitter.addEventListener('pointercancel', stop);
    splitter.addEventListener('dblclick', () => {
      splitRatio = 0.5;
      setSplitColumns(workspace);
      stop();
    });
    splitter.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        splitRatio = Math.max(0.25, Math.min(0.75, splitRatio + (event.key === 'ArrowRight' ? 0.03 : -0.03)));
        setSplitColumns(workspace);
        stop();
      }
    });
  }

  document.querySelectorAll<HTMLElement>('[data-mode]').forEach((button) => {
    button.addEventListener('click', () => setMode(button.dataset.mode as typeof mode));
  });

  document.querySelectorAll<HTMLElement>('[data-action]').forEach((button) => {
    button.addEventListener('click', async () => {
      const action = button.dataset.action;
      if (action !== 'menu') closeAppMenu();
      switch (action) {
        case 'new':
          await newFile();
          break;
        case 'open':
          await openFile();
          break;
        case 'save':
          await saveFile(false);
          break;
        case 'save-as':
          await saveFile(true);
          break;
        case 'pdf':
          window.print();
          break;
        case 'theme':
          setTheme(theme === 'light' ? 'dark' : 'light');
          break;
        case 'help':
          openHelp();
          break;
        case 'close-help':
          closeHelp();
          break;
        case 'menu':
          toggleAppMenu();
          break;
      }
    });
  });

  document.querySelector('#preview')?.addEventListener('click', (event) => {
    void handlePreviewClick(event);
  });
}

/* ---------- Preview links ---------- */

async function handlePreviewClick(event: Event) {
  const anchor = (event.target as HTMLElement).closest('a');
  if (!anchor) return;
  const href = anchor.getAttribute('href') ?? '';
  if (!href) return;
  event.preventDefault();
  if (href.startsWith('#')) {
    document.getElementById(href.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  if (/^(?:https?|mailto):/i.test(href)) {
    if (!inTauri) {
      window.open(href, '_blank', 'noopener,noreferrer');
      return;
    }
    try {
      await openUrl(href);
    } catch (error) {
      await showError('Could not open link', error);
    }
    return;
  }
  const local = href.split(/[?#]/)[0];
  if (!/\.(?:md|markdown|mdown|txt)$/i.test(local) || !currentPath) return;
  if (!(await confirmDiscard())) return;
  let target = local;
  try {
    target = decodeURIComponent(local);
  } catch {
    /* keep the original value */
  }
  const base = dirName(currentPath);
  const full = target.startsWith('/') || !base ? target : `${base}/${target}`;
  await openPath(normalizePath(full));
}

/* ---------- Close confirmation ---------- */

function askCloseConfirmation() {
  if (closePromptOpen) return Promise.resolve(false);
  closePromptOpen = true;
  closeHelp(false);
  closeAppMenu();
  return new Promise<boolean>((resolve) => {
    const shell = document.querySelector<HTMLElement>('.window');
    if (!shell) {
      closePromptOpen = false;
      resolve(false);
      return;
    }
    shell.insertAdjacentHTML(
      'beforeend',
      `<div class="close-backdrop"><section class="close-box" role="alertdialog" aria-modal="true" aria-labelledby="close-title"><h2 id="close-title">Unsaved changes</h2><p>Close HouseMD and discard changes to <strong>${escapeHtml(docName())}</strong>?</p><div class="close-actions"><button type="button" data-close-choice="cancel">Keep editing</button><button type="button" class="danger" data-close-choice="discard">Discard and close</button></div></section></div>`,
    );
    const overlay = shell.querySelector<HTMLElement>('.close-backdrop');
    const controller = new AbortController();
    const finish = (result: boolean) => {
      controller.abort();
      overlay?.remove();
      closePromptOpen = false;
      resolve(result);
    };
    document.addEventListener(
      'keydown',
      (event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          finish(false);
        }
      },
      { signal: controller.signal },
    );
    overlay?.querySelectorAll<HTMLElement>('[data-close-choice]').forEach((button) => {
      button.addEventListener('click', () => finish(button.dataset.closeChoice === 'discard'));
    });
    overlay?.addEventListener('click', (event) => {
      if (event.target === overlay) finish(false);
    });
    overlay?.querySelector<HTMLElement>('[data-close-choice="cancel"]')?.focus();
  });
}

/* ---------- File lifecycle ---------- */

async function confirmDiscard() {
  if (!dirty) return true;
  if (!inTauri) return window.confirm(`Discard unsaved changes to ${docName()}?`);
  try {
    return await ask(`Discard unsaved changes to ${docName()}?`, {
      title: 'HouseMD',
      kind: 'warning',
      okLabel: 'Discard',
      cancelLabel: 'Keep editing',
    });
  } catch {
    return window.confirm(`Discard unsaved changes to ${docName()}?`);
  }
}

async function showError(title: string, error: unknown) {
  const detail = error instanceof Error ? error.message : String(error);
  console.error(title, error);
  if (!inTauri) {
    window.alert(`${title}\n\n${detail}`);
    return;
  }
  try {
    await message(detail, { title, kind: 'error' });
  } catch {
    /* the dialog itself is unavailable */
  }
}

function withMarkdownExtension(path: string) {
  return /\.[^./\\]+$/.test(baseName(path)) ? path : `${path}.md`;
}

async function allowDocumentDir(path: string) {
  const directory = dirName(path);
  if (!inTauri || !directory) return;
  try {
    await invoke('allow_document_dir', { path: directory });
  } catch (error) {
    console.error('Could not extend the document scope', error);
  }
}

async function openPath(path: string) {
  try {
    await allowDocumentDir(path);
    const text = await readTextFile(path);
    currentPath = path;
    content = text;
    savedContent = text;
    dirty = false;
    renderApp();
  } catch (error) {
    await showError('Could not open file', error);
  }
}

async function openFile() {
  if (!inTauri) {
    await showError('Opening is unavailable', 'Run HouseMD inside its desktop shell to open files.');
    return;
  }
  if (!(await confirmDiscard())) return;
  const selected = await open({
    multiple: false,
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'txt'] }],
  });
  if (typeof selected === 'string') await openPath(selected);
}

async function newFile() {
  if (!(await confirmDiscard())) return;
  currentPath = '';
  content = '';
  savedContent = '';
  dirty = false;
  renderApp();
}

async function saveFile(choosePath: boolean) {
  if (!inTauri) {
    await showError('Saving is unavailable', 'Run HouseMD inside its desktop shell to save files.');
    return false;
  }
  let path = choosePath ? '' : currentPath;
  if (!path) {
    const selected = await save({
      filters: [{ name: 'Markdown', extensions: ['md'] }],
      defaultPath: currentPath || 'Untitled.md',
    });
    if (!selected) return false;
    path = withMarkdownExtension(selected);
  }
  const snapshot = content;
  const previousPath = currentPath;
  try {
    await writeTextFile(path, snapshot);
  } catch (error) {
    await showError('Could not save file', error);
    return false;
  }
  currentPath = path;
  savedContent = snapshot;
  dirty = content !== savedContent;
  await allowDocumentDir(path);
  if (path !== previousPath) refreshPreview();
  updateChrome();
  return true;
}

/* ---------- Launch and window integration ---------- */

async function openFileFromLaunch(path: string) {
  if (typeof path !== 'string' || !path) return;
  if (!(await confirmDiscard())) return;
  await openPath(path);
}

async function openLaunchFile() {
  if (!inTauri) return;
  try {
    const file = await invoke<string | null>('launch_file');
    if (file) await openPath(file);
  } catch (error) {
    console.error('Could not read the launch file', error);
  }
}

async function installWindowHooks() {
  const window = appWindow;
  if (!window) return;
  try {
    await listen<string>('open-file', (event) => {
      void openFileFromLaunch(event.payload);
    });
  } catch (error) {
    console.error('Could not install the file-open listener', error);
  }
  try {
    await window.onCloseRequested(async (event) => {
      if (forceClosing || !dirty) return;
      event.preventDefault();
      if (!(await askCloseConfirmation())) return;
      forceClosing = true;
      try {
        await window.destroy();
      } catch (error) {
        forceClosing = false;
        await showError('Could not close HouseMD', error);
      }
    });
  } catch (error) {
    console.error('Could not install the close guard', error);
  }
  try {
    await window.onDragDropEvent(async (event) => {
      if (event.payload.type !== 'drop') return;
      const path = event.payload.paths.find((candidate) => /\.(?:md|markdown|mdown|txt)$/i.test(candidate));
      if (!path || !(await confirmDiscard())) return;
      await openPath(path);
    });
  } catch (error) {
    console.error('Could not install file drop handling', error);
  }
}

/* ---------- Global shortcuts and startup ---------- */

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    const menu = document.querySelector<HTMLElement>('.app-menu');
    if (menu && !menu.hidden) {
      closeAppMenu();
      return;
    }
    if (helpOpen) {
      closeHelp();
      return;
    }
  }
  if (!(event.ctrlKey || event.metaKey)) return;
  const key = event.key.toLowerCase();
  if (key === 's') {
    event.preventDefault();
    void saveFile(event.shiftKey);
  } else if (key === 'o') {
    event.preventDefault();
    void openFile();
  } else if (key === 'n') {
    event.preventDefault();
    void newFile();
  } else if (key === 'p') {
    event.preventDefault();
    window.print();
  } else if (event.key === '/') {
    event.preventDefault();
    closeAppMenu();
    if (helpOpen) closeHelp();
    else openHelp();
  }
});

document.addEventListener('click', (event) => {
  if (!document.querySelector<HTMLElement>('.app-menu-wrap')?.contains(event.target as Node)) closeAppMenu();
});

renderApp();
void installWindowHooks();
void openLaunchFile();
