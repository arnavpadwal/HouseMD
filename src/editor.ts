import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import {
  bracketMatching,
  foldGutter,
  foldKeymap,
  HighlightStyle,
  indentOnInput,
  indentUnit,
  LanguageSupport,
  StreamLanguage,
  syntaxHighlighting,
} from '@codemirror/language';
import { languages } from '@codemirror/language-data';
import { stex } from '@codemirror/legacy-modes/mode/stex';
import {
  findNext,
  findPrevious,
  gotoLine,
  highlightSelectionMatches,
  openSearchPanel,
  search,
  searchKeymap,
  selectNextOccurrence,
} from '@codemirror/search';
import { Annotation, Compartment, EditorSelection, EditorState, Prec, Transaction } from '@codemirror/state';
import {
  crosshairCursor,
  drawSelection,
  dropCursor,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  rectangularSelection,
} from '@codemirror/view';
import { tags } from '@lezer/highlight';
import { fileKind } from './paths';

const external = Annotation.define<boolean>();
const languageCompartment = new Compartment();

const latexLanguage = new LanguageSupport(StreamLanguage.define(stex));
const markdownLanguageSupport = markdown({ base: markdownLanguage, codeLanguages: languages });

const editorTheme = EditorView.theme({
  '&': {
    height: '100%',
    backgroundColor: 'var(--bg)',
    color: 'var(--ink)',
    fontSize: 'var(--editor-font-size)',
  },
  '.cm-scroller': {
    fontFamily: 'var(--mono-font)',
    lineHeight: '1.75',
    overflow: 'auto',
  },
  '.cm-content': {
    padding: '18px 0 28px',
    caretColor: 'var(--accent)',
    fontWeight: '500',
  },
  '.cm-line': {
    padding: '0 18px 0 8px',
  },
  '.cm-gutters': {
    backgroundColor: 'var(--bg)',
    color: 'var(--muted)',
    border: 'none',
    paddingLeft: '8px',
  },
  '.cm-gutterElement': {
    minWidth: '2.2em',
    padding: '0 8px 0 4px',
  },
  '.cm-activeLine': {
    backgroundColor: 'var(--soft)',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'var(--soft)',
    color: 'var(--ink)',
  },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': {
    backgroundColor: 'var(--accent-soft)',
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: 'var(--accent)',
  },
  '.cm-selectionMatch': {
    backgroundColor: 'var(--accent-soft)',
  },
  '.cm-searchMatch': {
    backgroundColor: 'var(--accent-soft)',
    outline: '1px solid var(--accent)',
  },
  '.cm-searchMatch.cm-searchMatch-selected': {
    backgroundColor: 'var(--accent)',
    color: '#1f1208',
  },
  '.cm-panels': {
    backgroundColor: 'var(--paper)',
    color: 'var(--ink)',
  },
  '.cm-panels.cm-panels-top': {
    borderBottom: '1px solid var(--line)',
  },
  '.cm-panel.cm-search': {
    padding: '7px 10px',
    fontFamily: 'var(--ui-font)',
    fontSize: '12px',
  },
  '.cm-panel.cm-search input': {
    padding: '3px 6px',
    border: '1px solid var(--line)',
    borderRadius: '4px',
    outline: 'none',
    backgroundColor: 'var(--bg)',
    color: 'var(--ink)',
    fontFamily: 'var(--ui-font)',
    fontSize: '11px',
  },
  '.cm-panel.cm-search input:focus': {
    borderColor: 'var(--accent)',
  },
  '.cm-panel.cm-search button': {
    padding: '2px 7px',
    border: '1px solid var(--line)',
    borderRadius: '4px',
    backgroundColor: 'var(--soft)',
    backgroundImage: 'none',
    color: 'var(--ink)',
    fontFamily: 'var(--ui-font)',
    fontSize: '11px',
    cursor: 'pointer',
  },
  '.cm-panel.cm-search button:hover': {
    borderColor: 'var(--accent)',
    backgroundImage: 'none',
  },
  '.cm-panel.cm-search label': {
    color: 'var(--muted)',
    fontSize: '11px',
  },
  '.cm-panel.cm-search [name=close]': {
    border: '0',
    background: 'transparent',
    color: 'var(--muted)',
    fontSize: '16px',
  },
  '.cm-foldPlaceholder': {
    border: '1px solid var(--line)',
    backgroundColor: 'var(--soft)',
    color: 'var(--muted)',
  },
});

const highlightStyle = HighlightStyle.define([
  { tag: [tags.keyword, tags.modifier], color: 'var(--syntax-keyword)', fontWeight: '600' },
  { tag: [tags.string], color: 'var(--syntax-string)' },
  { tag: [tags.number, tags.bool, tags.null], color: 'var(--syntax-number)' },
  { tag: [tags.comment, tags.lineComment, tags.blockComment], color: 'var(--syntax-comment)', fontStyle: 'italic' },
  { tag: [tags.typeName, tags.className, tags.namespace], color: 'var(--syntax-builtin)' },
  { tag: [tags.function(tags.variableName), tags.labelName], color: 'var(--syntax-title)' },
  { tag: [tags.propertyName, tags.attributeName], color: 'var(--syntax-attr)' },
  {
    tag: [tags.heading1, tags.heading2, tags.heading3, tags.heading4, tags.heading5, tags.heading6],
    color: 'var(--heading)',
    fontWeight: '700',
  },
  { tag: tags.strong, color: 'var(--strong)', fontWeight: '700' },
  { tag: tags.emphasis, color: 'var(--emphasis)', fontStyle: 'italic' },
  { tag: [tags.link, tags.url], color: 'var(--link)', textDecoration: 'underline' },
  { tag: tags.monospace, color: 'var(--code-text)' },
  { tag: tags.quote, color: 'var(--muted)', fontStyle: 'italic' },
  { tag: tags.contentSeparator, color: 'var(--line)' },
  { tag: tags.meta, color: 'var(--syntax-meta)' },
  { tag: tags.invalid, color: '#dc2626' },
]);

export interface EditorControllerOptions {
  onChange: (value: string) => void;
  onSelectionChange: (from: number, to: number) => void;
  onScroll: (top: number) => void;
}

export interface EditorController {
  showTab: (
    id: string,
    value: string,
    path: string,
    selection: { from: number; to: number },
    scrollTop: number,
  ) => void;
  forgetTab: (id: string) => void;
  getValue: () => string;
  getSelection: () => { from: number; to: number };
  setSelection: (from: number, to: number) => void;
  getScrollTop: () => number;
  focus: () => void;
  setLanguage: (path: string) => void;
  insert: (text: string) => void;
  replaceRange: (from: number, to: number, text: string, selectFrom?: number, selectTo?: number) => void;
  cursorCoords: () => { left: number; top: number; bottom: number } | null;
  openSearch: () => void;
  openReplace: () => void;
  openGoto: () => void;
  selectAllOccurrences: () => boolean;
  getLanguageName: () => string;
  destroy: () => void;
  view: EditorView;
}

function languageFor(path: string) {
  const kind = path ? fileKind(path) : 'markdown';
  if (kind === 'latex') return latexLanguage;
  if (kind === 'markdown') return markdownLanguageSupport;
  return [];
}

function languageName(path: string) {
  const kind = path ? fileKind(path) : 'markdown';
  if (kind === 'latex') return 'LaTeX';
  if (kind === 'markdown') return 'Markdown';
  return 'Text';
}

function focusReplace(view: EditorView) {
  const input = view.dom.querySelector<HTMLInputElement>('.cm-search input[name="replace"]');
  input?.focus();
  input?.select();
}

function selectAllOccurrences(view: EditorView): boolean {
  const state = view.state;
  const selection = state.selection.main;
  let from = selection.from;
  let to = selection.to;
  if (from === to) {
    const line = state.doc.lineAt(from);
    const before = state.sliceDoc(line.from, from);
    const after = state.sliceDoc(from, line.to);
    const beforeMatch = before.match(/[\w$\\-]+$/)?.[0] ?? '';
    const afterMatch = after.match(/^[\w$\\-]+/)?.[0] ?? '';
    from -= beforeMatch.length;
    to += afterMatch.length;
  }
  const needle = state.sliceDoc(from, to);
  if (!needle) return false;
  const text = state.doc.toString();
  const ranges: ReturnType<typeof EditorSelection.range>[] = [];
  let index = text.indexOf(needle);
  while (index !== -1) {
    ranges.push(EditorSelection.range(index, index + needle.length));
    index = text.indexOf(needle, index + Math.max(1, needle.length));
  }
  if (!ranges.length) return false;
  view.dispatch({
    selection: EditorSelection.create(ranges, 0),
    scrollIntoView: true,
  });
  return true;
}

function makeExtensions(path: string) {
  return [
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightSpecialChars(),
    history(),
    foldGutter(),
    drawSelection(),
    dropCursor(),
    EditorState.allowMultipleSelections.of(true),
    EditorState.tabSize.of(2),
    indentUnit.of('  '),
    indentOnInput(),
    syntaxHighlighting(highlightStyle),
    bracketMatching(),
    closeBrackets(),
    rectangularSelection(),
    crosshairCursor(),
    highlightActiveLine(),
    highlightSelectionMatches(),
    search({ top: true }),
    keymap.of([
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...historyKeymap,
      ...foldKeymap,
      ...searchKeymap,
      indentWithTab,
    ]),
    Prec.high(
      keymap.of([
        {
          key: 'Mod-h',
          run: (view) => {
            openSearchPanel(view);
            window.setTimeout(() => focusReplace(view), 0);
            return true;
          },
        },
        { key: 'Mod-Shift-l', run: selectAllOccurrences },
        { key: 'Mod-F2', run: selectAllOccurrences },
        { key: 'Mod-g', run: gotoLine },
      ]),
    ),
    EditorView.lineWrapping,
    EditorView.contentAttributes.of({ spellcheck: 'false', 'aria-label': 'Editor' }),
    languageCompartment.of(languageFor(path)),
    editorTheme,
  ];
}

export function createEditor(parent: HTMLElement, options: EditorControllerOptions): EditorController {
  const states = new Map<string, EditorState>();
  let currentId = '';
  let currentPath = '';
  const view = new EditorView({
    state: EditorState.create({ doc: '', extensions: makeExtensions('') }),
    parent,
  });
  const updateListener = EditorView.updateListener.of((update) => {
    if (update.docChanged) {
      const isExternal = update.transactions.some((transaction) => transaction.annotation(external));
      if (!isExternal) options.onChange(update.state.doc.toString());
    }
    if (update.selectionSet) {
      const { from, to } = update.state.selection.main;
      options.onSelectionChange(from, to);
    }
  });
  view.scrollDOM.addEventListener('scroll', () => options.onScroll(view.scrollDOM.scrollTop));

  function createState(value: string, path: string) {
    return EditorState.create({
      doc: value,
      extensions: [...makeExtensions(path), updateListener],
    });
  }

  function showTab(
    id: string,
    value: string,
    path: string,
    selection: { from: number; to: number },
    scrollTop: number,
  ) {
    if (currentId) states.set(currentId, view.state);
    const state = states.get(id) ?? createState(value, path);
    view.setState(state);
    currentId = id;
    currentPath = path;
    const docLength = view.state.doc.length;
    const from = Math.max(0, Math.min(docLength, selection.from));
    const to = Math.max(0, Math.min(docLength, selection.to));
    view.dispatch({
      selection: { anchor: from, head: to },
      annotations: [external.of(true), Transaction.addToHistory.of(false)],
    });
    view.scrollDOM.scrollTop = scrollTop;
  }

  function getValue() {
    return view.state.doc.toString();
  }

  function getSelection() {
    const selection = view.state.selection.main;
    return { from: selection.from, to: selection.to };
  }

  function setSelection(from: number, to: number) {
    const docLength = view.state.doc.length;
    view.dispatch({
      selection: { anchor: Math.max(0, Math.min(docLength, from)), head: Math.max(0, Math.min(docLength, to)) },
      scrollIntoView: false,
    });
  }

  function setLanguage(path: string) {
    currentPath = path;
    view.dispatch({ effects: languageCompartment.reconfigure(languageFor(path)) });
  }

  function insert(text: string) {
    view.dispatch(view.state.replaceSelection(text));
    view.focus();
  }

  function replaceRange(from: number, to: number, text: string, selectFrom?: number, selectTo?: number) {
    view.dispatch({
      changes: { from, to, insert: text },
      selection: { anchor: selectFrom ?? from + text.length, head: selectTo ?? from + text.length },
    });
    view.focus();
  }

  function cursorCoords() {
    const coords = view.coordsAtPos(view.state.selection.main.head);
    return coords ? { left: coords.left, top: coords.top, bottom: coords.bottom } : null;
  }

  function openSearch() {
    view.focus();
    openSearchPanel(view);
  }

  function openReplace() {
    view.focus();
    openSearchPanel(view);
    window.setTimeout(() => focusReplace(view), 0);
  }

  function openGoto() {
    view.focus();
    gotoLine(view);
  }

  function forgetTab(id: string) {
    states.delete(id);
  }

  function destroy() {
    view.destroy();
  }

  return {
    showTab,
    forgetTab,
    getValue,
    getSelection,
    setSelection,
    getScrollTop: () => view.scrollDOM.scrollTop,
    focus: () => view.focus(),
    setLanguage,
    insert,
    replaceRange,
    cursorCoords,
    openSearch,
    openReplace,
    openGoto,
    selectAllOccurrences: () => selectAllOccurrences(view),
    getLanguageName: () => languageName(currentPath),
    destroy,
    view,
  };
}
