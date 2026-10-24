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
import {
  addRecent,
  clearSession,
  createTab,
  loadRecent,
  loadSession,
  loadSettings,
  saveSession,
  saveSettings,
  tabLabel,
  type Settings,
  type Tab,
  type ThemeMode,
  type ViewMode,
} from './model';
import { baseName, dirName, normalizePath } from './paths';
import { createExplorer } from './explorer';
import { createFindBar } from './findbar';
import { openSettingsPanel } from './settings-panel';

const inTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
const appWindow = inTauri ? getCurrentWindow() : null;
const systemTheme = matchMedia('(prefers-color-scheme: dark)');

/* ---------- Application state ---------- */

let settings: Settings = loadSettings();
let resolvedTheme: 'light' | 'dark' = resolveTheme(settings.theme);
let mode: ViewMode = 'split';
let tabs: Tab[] = [createTab(sample)];
let activeTab: Tab = tabs[0];
let recentFiles = loadRecent();
let helpOpen = false;
let helpPosition = '';
let splitRatio = Math.max(0.25, Math.min(0.75, Number(localStorage.getItem('housemd-split-ratio')) || 0.5));
let previewTimer: number | undefined;
let diagramTimer: number | undefined;
let titleTimer: number | undefined;
let sessionTimer: number | undefined;
let autosaveTimer: number | undefined;
let toastTimer: number | undefined;
let pendingToast = '';
let closePromptOpen = false;
let forceClosing = false;

const findbar = createFindBar({
  getEditor: () => document.querySelector<HTMLTextAreaElement>('#editor'),
  setContent: (value) => {
    activeTab.content = value;
    activeTab.dirty = value !== activeTab.savedContent;
    updateChrome();
    renderTabs();
    refreshPreview();
    scheduleSessionSave();
    scheduleAutosave();
  },
  ensureEditorVisible: () => {
    if (mode === 'read') setMode('split');
  },
});

const explorer = createExplorer({
  allowDirectory,
  openFile: (path) => {
    void openPath(path);
  },
  requestOpenFolder: () => {
    void openFolderDialog();
  },
  onChange: () => {
    renderSidebar();
    scheduleSessionSave();
  },
  onError: (title, error) => {
    void showError(title, error);
  },
  isActiveFile: (path) => Boolean(activeTab.path) && normalizePath(path) === normalizePath(activeTab.path),
});

/* ---------- Path and text helpers ---------- */

function resolveTheme(next: ThemeMode): 'light' | 'dark' {
  if (next === 'system') return systemTheme.matches ? 'dark' : 'light';
  return next;
}

function activeEditor() {
  return document.querySelector<HTMLTextAreaElement>('#editor');
}

function docName(tab = activeTab) {
  return tab.path ? baseName(tab.path) : 'Untitled.md';
}

function statusText() {
  if (activeTab.dirty) return 'Unsaved';
  return activeTab.path ? 'Saved' : 'Draft';
}

function statusDot() {
  return `<i class="live-dot${activeTab.dirty ? ' unsaved' : ''}"></i>`;
}

function statsText() {
  const lines = activeTab.content.split('\n').length;
  return `${lines} ${lines === 1 ? 'line' : 'lines'} · ${activeTab.content.length} ${activeTab.content.length === 1 ? 'character' : 'characters'}`;
}

function isPristine(tab: Tab) {
  return !tab.path && !tab.dirty && (tab.content === sample || tab.content === '');
}

/* ---------- Preview rendering ---------- */

async function drawMermaid() {
  if (!document.querySelector('.mermaid')) return;
  const { default: mermaid } = await import('mermaid');
  mermaid.initialize({
    startOnLoad: false,
    theme: resolvedTheme === 'light' ? 'default' : 'dark',
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
  if (!inTauri || !activeTab.path) return;
  const base = dirName(activeTab.path);
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

function refreshPreview(preserveScroll = true) {
  const preview = document.querySelector<HTMLElement>('#preview');
  if (!preview) return;
  const scroll = preserveScroll ? preview.scrollTop : activeTab.previewScroll;
  preview.innerHTML = renderMarkdown(activeTab.content);
  resolvePreviewAssets(preview);
  preview.scrollTop = scroll;
  activeTab.previewScroll = preview.scrollTop;
  scheduleMermaid();
}

function schedulePreview() {
  if (previewTimer !== undefined) return;
  previewTimer = window.setTimeout(() => {
    previewTimer = undefined;
    refreshPreview();
  }, 80);
}

/* ---------- Window chrome and tabs ---------- */

function syncWindowTitle() {
  if (!appWindow) return;
  if (titleTimer) clearTimeout(titleTimer);
  titleTimer = window.setTimeout(() => {
    void appWindow.setTitle(`${activeTab.dirty ? '• ' : ''}${docName()} — HouseMD`).catch(() => undefined);
  }, 120);
}

function updateChrome() {
  const title = document.querySelector<HTMLElement>('.title-center');
  if (title) {
    title.title = activeTab.path || 'Untitled.md';
    title.innerHTML = `${escapeHtml(docName())}${activeTab.dirty ? '<span class="dirty"> •</span>' : ''}`;
  }
  const status = document.querySelector<HTMLElement>('.bottom-bar > span:first-child');
  if (status) status.innerHTML = `${statusDot()}${statusText()}`;
  const stats = document.querySelector<HTMLElement>('#stats');
  if (stats) stats.textContent = statsText();
  syncWindowTitle();
  applySidebarVisibility();
}

function tabsMarkup() {
  return tabs
    .map((tab, index) => {
      const label = tabLabel(tab, index, tabs.length);
      return `<div class="tab${tab.id === activeTab.id ? ' active' : ''}" data-tab-id="${tab.id}" title="${escapeHtml(tab.path || label)}"><button type="button" class="tab-select" data-tab-id="${tab.id}"><span class="tab-name">${escapeHtml(label)}</span>${tab.dirty ? '<i class="tab-dot"></i>' : ''}</button><button type="button" class="tab-close" data-close-tab="${tab.id}" aria-label="Close ${escapeHtml(label)}">×</button></div>`;
    })
    .join('');
}

function renderTabs() {
  const container = document.querySelector<HTMLElement>('#tabs');
  if (container) container.innerHTML = tabsMarkup();
}

function recentMarkup() {
  return recentFiles
    .slice(0, 6)
    .map(
      (path) =>
        `<button type="button" role="menuitem" data-recent-path="${escapeHtml(path)}" title="${escapeHtml(path)}"><span class="menu-file">${escapeHtml(baseName(path))}</span><span class="menu-path">${escapeHtml(dirName(path))}</span></button>`,
    )
    .join('');
}

function renderRecentMenu() {
  const container = document.querySelector<HTMLElement>('#recent-files');
  if (container) container.innerHTML = recentMarkup();
  const section = document.querySelector<HTMLElement>('#recent-section');
  if (section) section.hidden = recentFiles.length === 0;
}

function renderSidebar() {
  const tree = document.querySelector<HTMLElement>('#file-tree');
  if (tree) tree.innerHTML = explorer.render();
  const label = document.querySelector<HTMLElement>('#folder-name');
  if (label) {
    label.textContent = explorer.root ? baseName(explorer.root, 'Folder') : 'Files';
    label.title = explorer.root;
  }
}

function applySidebarVisibility() {
  const sidebar = document.querySelector<HTMLElement>('#sidebar');
  if (sidebar) sidebar.hidden = !settings.sidebarOpen;
  const button = document.querySelector<HTMLElement>('[data-action="sidebar"]');
  if (button) button.classList.toggle('active', settings.sidebarOpen);
}

function showToast(text: string) {
  const toast = document.querySelector<HTMLElement>('#toast');
  if (!toast) {
    pendingToast = text;
    return;
  }
  toast.textContent = text;
  toast.hidden = false;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.hidden = true;
  }, 6000);
}

/* ---------- Appearance and settings ---------- */

function applyAppearance() {
  document.documentElement.dataset.theme = resolvedTheme;
  document.documentElement.dataset.accent = settings.accent;
  document.documentElement.style.setProperty('--preview-font-size', `${settings.previewFontSize}px`);
  document.documentElement.style.setProperty('--editor-font-size', `${settings.editorFontSize}px`);
  const button = document.querySelector<HTMLElement>('.theme-toggle');
  if (button) {
    button.innerHTML = resolvedTheme === 'light' ? icons.moon : icons.sun;
    button.title = settings.theme === 'system' ? 'Theme: system' : `Theme: ${resolvedTheme}`;
  }
}

function applySettings(next: Settings, refresh = true) {
  const themeChanged = next.theme !== settings.theme || next.accent !== settings.accent;
  settings = next;
  resolvedTheme = resolveTheme(settings.theme);
  applyAppearance();
  saveSettings(settings);
  if (!settings.restoreSession) clearSession();
  else scheduleSessionSave();
  if (settings.autosave) scheduleAutosave();
  if (refresh && themeChanged) refreshPreview();
}

function toggleTheme() {
  const next: ThemeMode = resolvedTheme === 'light' ? 'dark' : 'light';
  applySettings({ ...settings, theme: next });
}

systemTheme.addEventListener('change', () => {
  if (settings.theme !== 'system') return;
  resolvedTheme = resolveTheme('system');
  applyAppearance();
  refreshPreview();
});

/* ---------- Markdown help ---------- */

function placeHelpNearCaret() {
  const editor = activeEditor();
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
  findbar.close();
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
  if (focusEditor) activeEditor()?.focus();
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
  if (mode === 'read') setMode('split');
  const editor = activeEditor();
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
  activeTab.content = editor.value;
  activeTab.dirty = activeTab.content !== activeTab.savedContent;
  updateChrome();
  renderTabs();
  editor.focus();
  refreshPreview();
  scheduleSessionSave();
  scheduleAutosave();
}

/* ---------- View mode, menu ---------- */

function setSplitColumns(workspace: HTMLElement) {
  workspace.style.gridTemplateColumns = `minmax(0, ${splitRatio}fr) 8px minmax(0, ${1 - splitRatio}fr)`;
}

function setMode(next: ViewMode) {
  findbar.close();
  closeHelp(false);
  closeAppMenu();
  mode = next;
  const workspace = document.querySelector<HTMLElement>('.workspace');
  if (workspace) {
    workspace.classList.remove('mode-read', 'mode-focus', 'mode-split');
    workspace.classList.add(`mode-${mode}`);
    if (mode === 'split') setSplitColumns(workspace);
    else workspace.style.gridTemplateColumns = '';
  }
  document.querySelectorAll<HTMLElement>('[data-mode]').forEach((button) => {
    const active = button.dataset.mode === mode;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  if (mode !== 'read') activeEditor()?.focus();
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

function toggleSidebar() {
  settings = { ...settings, sidebarOpen: !settings.sidebarOpen };
  saveSettings(settings);
  applySidebarVisibility();
  if (settings.sidebarOpen && explorer.root && !explorer.isLoaded()) void explorer.refresh();
  scheduleSessionSave();
}

/* ---------- Shell rendering and event wiring ---------- */

function renderApp() {
  findbar.close();
  closeAppMenu();
  helpOpen = false;
  applyAppearance();
  document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <main class="window">
   <header class="titlebar">
    <div class="brand"><span class="brandmark">h.</span></div>
    <div class="title-center" title="${escapeHtml(activeTab.path || 'Untitled.md')}">${escapeHtml(docName())}${activeTab.dirty ? '<span class="dirty"> •</span>' : ''}</div>
    <div class="top-actions">
     <div class="mode-switch"><button data-mode="read" aria-pressed="${mode === 'read'}" class="${mode === 'read' ? 'active' : ''}">Read</button><button data-mode="focus" aria-pressed="${mode === 'focus'}" class="${mode === 'focus' ? 'active' : ''}">Focus</button><button data-mode="split" aria-pressed="${mode === 'split'}" class="${mode === 'split' ? 'active' : ''}">Split</button></div>
     <button class="icon-btn ${settings.sidebarOpen ? 'active' : ''}" data-action="sidebar" title="Files sidebar (Ctrl+B)" aria-label="Toggle files sidebar">${icons.sidebar}</button>
     <button class="icon-btn" data-action="help" title="Markdown help (Ctrl+/)" aria-label="Markdown help">${icons.search}</button>
     <span class="divider"></span>
     <button class="icon-btn" data-action="new" title="New tab (Ctrl+N)" aria-label="New tab">${icons.plus}</button>
     <button class="icon-btn" data-action="open" title="Open (Ctrl+O)" aria-label="Open">${icons.folder}</button>
     <button class="icon-btn" data-action="save" title="Save (Ctrl+S)" aria-label="Save">${icons.save}</button>
     <button class="icon-btn theme-toggle" data-action="theme" title="Toggle appearance" aria-label="Toggle appearance">${resolvedTheme === 'light' ? icons.moon : icons.sun}</button>
     <button class="export-btn" data-action="pdf" title="Print or save as PDF (Ctrl+P)">${icons.pdf}<span>PDF</span></button>
     <div class="app-menu-wrap"><button class="icon-btn" data-action="menu" title="More actions" aria-label="More actions" aria-haspopup="menu" aria-expanded="false">${icons.menu}</button><div class="app-menu" role="menu" hidden><button role="menuitem" data-action="new">New tab<span>Ctrl+N</span></button><button role="menuitem" data-action="save-as">Save as…<span>Ctrl+Shift+S</span></button><button role="menuitem" data-action="close-tab">Close tab<span>Ctrl+W</span></button><button role="menuitem" data-action="open-folder">Open folder…</button><div id="recent-section" ${recentFiles.length ? '' : 'hidden'}><div class="menu-label">Recent</div><div id="recent-files">${recentMarkup()}</div></div><div class="menu-sep"></div><button role="menuitem" data-action="settings">Settings<span>Ctrl+,</span></button><button role="menuitem" data-action="help">Markdown guide<span>Ctrl+/</span></button><button role="menuitem" data-action="pdf">Print / PDF<span>Ctrl+P</span></button></div></div>
    </div>
   </header>
   <nav class="tabbar" aria-label="Open documents"><div class="tabs" id="tabs">${tabsMarkup()}</div><button class="tab-new" data-action="new" title="New tab (Ctrl+N)" aria-label="New tab">${icons.plus}</button></nav>
   <div class="body">
    <aside class="sidebar" id="sidebar" ${settings.sidebarOpen ? '' : 'hidden'}>
      <div class="sidebar-head"><span id="folder-name" title="${escapeHtml(explorer.root)}">${escapeHtml(explorer.root ? baseName(explorer.root, 'Folder') : 'Files')}</span><div class="sidebar-actions"><button class="icon-btn" data-action="open-folder" title="Open folder" aria-label="Open folder">${icons.folder}</button><button class="icon-btn" data-action="refresh-folder" title="Refresh folder" aria-label="Refresh folder">${icons.refresh}</button><button class="icon-btn" data-action="toggle-sidebar" title="Hide sidebar (Ctrl+B)" aria-label="Hide sidebar">${icons.close}</button></div></div>
      <div class="file-tree" id="file-tree">${explorer.render()}</div>
    </aside>
    <section class="workspace mode-${mode}"><div class="editor-pane"><textarea id="editor" spellcheck="false" aria-label="Markdown editor">${escapeHtml(activeTab.content)}</textarea></div><div class="pane-divider" role="separator" aria-orientation="vertical" aria-label="Resize panes" tabindex="0"></div><div class="preview-pane"><article class="rendered" id="preview"></article></div></section>
   </div>
   <footer class="bottom-bar"><span>${statusDot()}${statusText()}</span><span id="stats">${statsText()}</span></footer>
   <div class="toast" id="toast" hidden role="status" aria-live="polite"></div>
  </main>`;
  bind();
  if (mode === 'split') setSplitColumns(document.querySelector<HTMLElement>('.workspace')!);
  refreshPreview(false);
  const preview = document.querySelector<HTMLElement>('#preview');
  if (preview) preview.scrollTop = activeTab.previewScroll;
  updateChrome();
  applySidebarVisibility();
  if (mode !== 'read') activeEditor()?.focus();
  if (pendingToast) {
    const toast = pendingToast;
    pendingToast = '';
    showToast(toast);
  }
}

function bind() {
  const editor = activeEditor();
  editor?.addEventListener('input', () => {
    activeTab.content = editor.value;
    activeTab.dirty = activeTab.content !== activeTab.savedContent;
    updateChrome();
    renderTabs();
    schedulePreview();
    scheduleSessionSave();
    scheduleAutosave();
  });
  editor?.addEventListener('scroll', () => {
    activeTab.editorScroll = editor.scrollTop;
  });
  editor?.addEventListener('select', () => {
    activeTab.selectionStart = editor.selectionStart;
    activeTab.selectionEnd = editor.selectionEnd;
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

  const tabsElement = document.querySelector<HTMLElement>('#tabs');
  tabsElement?.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const close = target.closest<HTMLElement>('[data-close-tab]')?.dataset.closeTab;
    if (close) {
      void closeTab(close);
      return;
    }
    const select = target.closest<HTMLElement>('[data-tab-id]')?.dataset.tabId;
    if (select) activateTab(select);
  });
  tabsElement?.addEventListener('auxclick', (event) => {
    if (event.button !== 1) return;
    const close = (event.target as HTMLElement).closest<HTMLElement>('[data-close-tab]')?.dataset.closeTab;
    if (close) void closeTab(close);
  });

  document.querySelectorAll<HTMLElement>('[data-mode]').forEach((button) => {
    button.addEventListener('click', () => setMode(button.dataset.mode as ViewMode));
  });

  document.querySelectorAll<HTMLElement>('[data-action]').forEach((button) => {
    button.addEventListener('click', async () => {
      const action = button.dataset.action;
      if (action !== 'menu') closeAppMenu();
      switch (action) {
        case 'new':
          newFile();
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
        case 'close-tab':
          await closeTab(activeTab.id);
          break;
        case 'pdf':
          window.print();
          break;
        case 'theme':
          toggleTheme();
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
        case 'settings':
          openSettingsPanel(settings, (next) => applySettings(next));
          break;
        case 'sidebar':
        case 'toggle-sidebar':
          toggleSidebar();
          break;
        case 'open-folder':
          await openFolderDialog();
          break;
        case 'refresh-folder':
          await explorer.refresh();
          break;
      }
    });
  });

  document.querySelector<HTMLElement>('.app-menu')?.addEventListener('click', (event) => {
    const path = (event.target as HTMLElement).closest<HTMLElement>('[data-recent-path]')?.dataset.recentPath;
    if (!path) return;
    closeAppMenu();
    void openPath(path);
  });

  document.querySelector('#preview')?.addEventListener('click', (event) => {
    void handlePreviewClick(event);
  });
  document.querySelector('#preview')?.addEventListener('scroll', () => {
    const preview = document.querySelector<HTMLElement>('#preview');
    if (preview) activeTab.previewScroll = preview.scrollTop;
  });

  explorer.bind(document.querySelector<HTMLElement>('#file-tree'));
}

/* ---------- Tabs and session ---------- */

function captureActiveTabView() {
  const editor = activeEditor();
  if (editor) {
    activeTab.editorScroll = editor.scrollTop;
    activeTab.selectionStart = editor.selectionStart;
    activeTab.selectionEnd = editor.selectionEnd;
  }
  const preview = document.querySelector<HTMLElement>('#preview');
  if (preview) activeTab.previewScroll = preview.scrollTop;
}

function loadActiveTab(focus = true) {
  const editor = activeEditor();
  if (editor) {
    editor.value = activeTab.content;
    editor.scrollTop = activeTab.editorScroll;
    editor.setSelectionRange(activeTab.selectionStart, activeTab.selectionEnd);
  }
  refreshPreview(false);
  const preview = document.querySelector<HTMLElement>('#preview');
  if (preview) preview.scrollTop = activeTab.previewScroll;
  updateChrome();
  renderTabs();
  renderSidebar();
  if (focus && mode !== 'read') editor?.focus();
}

function activateTab(id: string) {
  if (activeTab.id === id) return;
  const next = tabs.find((tab) => tab.id === id);
  if (!next) return;
  captureActiveTabView();
  if (settings.autosave) void autosaveTab(activeTab);
  activeTab = next;
  findbar.close();
  loadActiveTab();
  scheduleSessionSave();
}

function addTab(tab: Tab, replacePristine = true) {
  const onlyTab = tabs.length === 1 ? tabs[0] : null;
  const canReplace = onlyTab && isPristine(onlyTab) && (replacePristine || onlyTab.content === sample);
  if (canReplace) tabs[0] = tab;
  else tabs.push(tab);
  activeTab = tab;
  renderApp();
  scheduleSessionSave();
}

async function closeTab(id: string) {
  const tab = tabs.find((candidate) => candidate.id === id);
  if (!tab) return;
  if (tab.dirty && !(await confirmDiscardTab(tab))) return;
  const index = tabs.indexOf(tab);
  tabs = tabs.filter((candidate) => candidate !== tab);
  if (tabs.length === 0) {
    activeTab = createTab('');
    tabs = [activeTab];
  } else if (activeTab.id === tab.id) {
    activeTab = tabs[Math.min(index, tabs.length - 1)];
  }
  renderApp();
  persistSession();
}

async function confirmDiscardTab(tab: Tab) {
  const label = tabLabel(tab, tabs.indexOf(tab), tabs.length);
  if (!inTauri) return window.confirm(`Discard unsaved changes to ${label}?`);
  try {
    return await ask(`Discard unsaved changes to ${label}?`, {
      title: 'HouseMD',
      kind: 'warning',
      okLabel: 'Discard',
      cancelLabel: 'Keep editing',
    });
  } catch {
    return window.confirm(`Discard unsaved changes to ${label}?`);
  }
}

/* ---------- Preview links and close confirmation ---------- */

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
  if (!/\.(?:md|markdown|mdown|txt)$/i.test(local) || !activeTab.path) return;
  let target = local;
  try {
    target = decodeURIComponent(local);
  } catch {
    /* keep the original value */
  }
  const base = dirName(activeTab.path);
  const full = target.startsWith('/') || !base ? target : `${base}/${target}`;
  await openPath(normalizePath(full));
}

function askCloseConfirmation(dirtyTabs: Tab[]) {
  if (closePromptOpen) return Promise.resolve(false);
  closePromptOpen = true;
  closeHelp(false);
  closeAppMenu();
  findbar.close();
  const names = dirtyTabs.map((tab) => tabLabel(tab, tabs.indexOf(tab), tabs.length));
  const detail =
    names.length === 1
      ? `“${escapeHtml(names[0])}” has unsaved changes.`
      : `${names.length} documents have unsaved changes.`;
  return new Promise<boolean>((resolve) => {
    const shell = document.querySelector<HTMLElement>('.window');
    if (!shell) {
      closePromptOpen = false;
      resolve(false);
      return;
    }
    shell.insertAdjacentHTML(
      'beforeend',
      `<div class="close-backdrop"><section class="close-box" role="alertdialog" aria-modal="true" aria-labelledby="close-title"><h2 id="close-title">Unsaved changes</h2><p>${detail} Close HouseMD and discard them?</p><div class="close-actions"><button type="button" data-close-choice="cancel">Keep editing</button><button type="button" class="danger" data-close-choice="discard">Discard and close</button></div></section></div>`,
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

async function allowDirectory(path: string) {
  if (!inTauri || !path) return;
  await invoke('allow_document_dir', { path });
}

async function allowDocumentDir(path: string) {
  const directory = dirName(path);
  if (!directory) return;
  try {
    await allowDirectory(directory);
  } catch (error) {
    console.error('Could not extend the document scope', error);
  }
}

async function rememberRecent(path: string) {
  recentFiles = addRecent(path);
  renderRecentMenu();
}

async function openPath(path: string) {
  const normalized = normalizePath(path);
  const existing = tabs.find((tab) => tab.path && normalizePath(tab.path) === normalized);
  if (existing) {
    activateTab(existing.id);
    await rememberRecent(normalized);
    return;
  }
  try {
    await allowDocumentDir(normalized);
    const text = await readTextFile(normalized);
    const tab = createTab(text, normalized, text);
    addTab(tab);
    await rememberRecent(normalized);
  } catch (error) {
    await showError(`Could not open ${baseName(normalized)}`, error);
  }
}

async function openFile() {
  if (!inTauri) {
    await showError('Opening is unavailable', 'Run HouseMD inside its desktop shell to open files.');
    return;
  }
  const selected = await open({
    multiple: false,
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'txt'] }],
  });
  if (typeof selected === 'string') await openPath(selected);
}

function newFile() {
  addTab(createTab(''), false);
}

async function saveFile(choosePath: boolean) {
  const tab = activeTab;
  if (!inTauri) {
    await showError('Saving is unavailable', 'Run HouseMD inside its desktop shell to save files.');
    return false;
  }
  let path = choosePath ? '' : tab.path;
  if (!path) {
    const selected = await save({
      filters: [{ name: 'Markdown', extensions: ['md'] }],
      defaultPath: tab.path || 'Untitled.md',
    });
    if (!selected) return false;
    path = withMarkdownExtension(selected);
  }
  const snapshot = tab.content;
  const previousPath = tab.path;
  try {
    await writeTextFile(path, snapshot);
  } catch (error) {
    await showError('Could not save file', error);
    return false;
  }
  tab.path = path;
  tab.savedContent = snapshot;
  tab.dirty = tab.content !== tab.savedContent;
  await allowDocumentDir(path);
  await rememberRecent(path);
  if (path !== previousPath) refreshPreview();
  updateChrome();
  renderTabs();
  renderSidebar();
  persistSession();
  return true;
}

async function autosaveTab(tab: Tab) {
  if (!settings.autosave || !tab.path || !tab.dirty) return;
  const snapshot = tab.content;
  try {
    await writeTextFile(tab.path, snapshot);
    tab.savedContent = snapshot;
    tab.dirty = tab.content !== snapshot;
    if (tab.id === activeTab.id) {
      updateChrome();
      renderTabs();
    }
    persistSession();
  } catch (error) {
    console.error('Auto-save failed', error);
  }
}

function scheduleAutosave() {
  if (!settings.autosave) return;
  if (autosaveTimer) clearTimeout(autosaveTimer);
  autosaveTimer = window.setTimeout(() => {
    autosaveTimer = undefined;
    void autosaveTab(activeTab);
  }, 900);
}

async function openFolderDialog() {
  if (!inTauri) {
    await showError('Opening is unavailable', 'Run HouseMD inside its desktop shell to open folders.');
    return;
  }
  const selected = await open({ directory: true, multiple: false });
  if (typeof selected !== 'string') return;
  settings = { ...settings, sidebarOpen: true };
  saveSettings(settings);
  applySidebarVisibility();
  await explorer.setRoot(normalizePath(selected));
  persistSession();
}

/* ---------- Session persistence ---------- */

function persistSession() {
  if (!settings.restoreSession) {
    clearSession();
    return;
  }
  saveSession({
    tabs: tabs.map((tab) => ({
      path: tab.path,
      content: tab.content,
      savedContent: tab.savedContent,
      dirty: tab.dirty,
    })),
    activeIndex: Math.max(0, tabs.indexOf(activeTab)),
    folder: explorer.root,
  });
}

function scheduleSessionSave() {
  if (sessionTimer) clearTimeout(sessionTimer);
  sessionTimer = window.setTimeout(() => {
    sessionTimer = undefined;
    persistSession();
  }, 350);
}

async function restoreTabs() {
  if (!settings.restoreSession) {
    clearSession();
    return null;
  }
  const session = loadSession();
  if (!session) return null;
  const restored: Tab[] = [];
  for (const stored of session.tabs) {
    let content = stored.content;
    let savedContent = stored.savedContent;
    let dirty = stored.dirty;
    if (stored.path && !dirty) {
      try {
        await allowDocumentDir(stored.path);
        const disk = await readTextFile(stored.path);
        content = disk;
        savedContent = disk;
        dirty = false;
      } catch {
        dirty = true;
      }
    }
    const tab = createTab(content, stored.path, savedContent);
    tab.dirty = dirty || tab.content !== tab.savedContent;
    restored.push(tab);
  }
  if (!restored.length) return null;
  return {
    tabs: restored,
    activeIndex: Math.max(0, Math.min(restored.length - 1, session.activeIndex)),
    folder: session.folder,
  };
}

/* ---------- Launch and window integration ---------- */

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
      void openPath(event.payload);
    });
  } catch (error) {
    console.error('Could not install the file-open listener', error);
  }
  try {
    await window.onCloseRequested(async (event) => {
      const dirtyTabs = tabs.filter((tab) => tab.dirty);
      if (forceClosing || dirtyTabs.length === 0) return;
      event.preventDefault();
      if (!(await askCloseConfirmation(dirtyTabs))) return;
      clearSession();
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
      if (path) await openPath(path);
    });
  } catch (error) {
    console.error('Could not install file drop handling', error);
  }
}

/* ---------- Global shortcuts and startup ---------- */

document.addEventListener('keydown', (event) => {
  if (document.querySelector('.settings-backdrop') || document.querySelector('.close-backdrop')) return;
  if (event.key === 'Escape') {
    if (findbar.isOpen()) {
      findbar.close();
      return;
    }
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
    newFile();
  } else if (key === 'w') {
    event.preventDefault();
    void closeTab(activeTab.id);
  } else if (key === 'p') {
    event.preventDefault();
    window.print();
  } else if (key === 'f') {
    event.preventDefault();
    findbar.open(false);
  } else if (key === 'h') {
    event.preventDefault();
    findbar.open(true);
  } else if (key === 'b') {
    event.preventDefault();
    toggleSidebar();
  } else if (event.key === ',') {
    event.preventDefault();
    openSettingsPanel(settings, (next) => applySettings(next));
  } else if (event.key === 'Tab') {
    event.preventDefault();
    const index = tabs.indexOf(activeTab);
    const next = tabs[(index + (event.shiftKey ? -1 : 1) + tabs.length) % tabs.length];
    if (next) activateTab(next.id);
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

async function initialize() {
  resolvedTheme = resolveTheme(settings.theme);
  applyAppearance();
  const restored = await restoreTabs();
  if (restored) {
    tabs = restored.tabs;
    activeTab = tabs[restored.activeIndex] ?? tabs[0];
    if (restored.folder) explorer.setRootPath(restored.folder);
    const dirtyCount = tabs.filter((tab) => tab.dirty).length;
    if (dirtyCount)
      pendingToast = `Restored ${dirtyCount} unsaved ${dirtyCount === 1 ? 'tab' : 'tabs'} from your last session.`;
  } else {
    activeTab = createTab(sample);
    tabs = [activeTab];
  }
  renderApp();
  await installWindowHooks();
  if (restored?.folder && settings.sidebarOpen) void explorer.setRoot(restored.folder);
  persistSession();
  await openLaunchFile();
}

void initialize().catch(async (error) => {
  console.error('Could not start HouseMD', error);
  await showError('Could not start HouseMD', error);
});
