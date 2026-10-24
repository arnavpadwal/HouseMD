export interface FindBarOptions {
  getEditor: () => HTMLTextAreaElement | null;
  setContent: (content: string) => void;
  ensureEditorVisible: () => void;
}

export interface FindBar {
  open: (replace: boolean) => void;
  close: () => void;
  isOpen: () => boolean;
}

const markup = `
<div class="findbar" hidden role="search" aria-label="Find and replace">
  <div class="find-row">
    <input class="find-query" type="search" placeholder="Find" autocomplete="off" spellcheck="false" aria-label="Find" />
    <span class="find-count" aria-live="polite">0 / 0</span>
    <button type="button" data-find="prev" title="Previous match (Shift+Enter)" aria-label="Previous match">↑</button>
    <button type="button" data-find="next" title="Next match (Enter)" aria-label="Next match">↓</button>
    <button type="button" data-find="case" class="toggle" title="Match case" aria-label="Match case">Aa</button>
    <button type="button" data-find="close" title="Close (Esc)" aria-label="Close find">×</button>
  </div>
  <div class="replace-row" hidden>
    <input class="find-replace" type="text" placeholder="Replace with" autocomplete="off" spellcheck="false" aria-label="Replace with" />
    <button type="button" data-find="replace">Replace</button>
    <button type="button" data-find="replace-all">All</button>
  </div>
</div>`;

export function createFindBar(options: FindBarOptions): FindBar {
  let open = false;
  let caseSensitive = false;
  let lastQuery = '';

  function editor() {
    return options.getEditor();
  }

  function bar() {
    return document.querySelector<HTMLElement>('.findbar');
  }

  function queryInput() {
    return document.querySelector<HTMLInputElement>('.find-query');
  }

  function replaceInput() {
    return document.querySelector<HTMLInputElement>('.find-replace');
  }

  function countElement() {
    return document.querySelector<HTMLElement>('.find-count');
  }

  function matches() {
    const input = editor();
    const query = queryInput()?.value ?? '';
    if (!input || !query) return [];
    const haystack = caseSensitive ? input.value : input.value.toLowerCase();
    const needle = caseSensitive ? query : query.toLowerCase();
    const positions: number[] = [];
    let index = haystack.indexOf(needle);
    while (index !== -1) {
      positions.push(index);
      index = haystack.indexOf(needle, index + Math.max(1, needle.length));
    }
    return positions;
  }

  function updateCount(message?: string) {
    const count = countElement();
    const input = editor();
    if (!count || !input) return;
    if (message) {
      count.textContent = message;
      return;
    }
    const query = queryInput()?.value ?? '';
    if (!query) {
      count.textContent = '0 / 0';
      return;
    }
    const positions = matches();
    const current = positions.indexOf(input.selectionStart);
    count.textContent = positions.length ? `${current >= 0 ? current + 1 : '–'} / ${positions.length}` : '0 / 0';
  }

  function scrollTo(position: number) {
    const input = editor();
    if (!input) return;
    const line = input.value.slice(0, position).split('\n').length - 1;
    const lineHeight = parseFloat(getComputedStyle(input).lineHeight) || 24;
    const top = line * lineHeight;
    if (top < input.scrollTop || top + lineHeight > input.scrollTop + input.clientHeight) {
      input.scrollTop = Math.max(0, top - input.clientHeight / 2);
    }
  }

  function selectMatch(position: number) {
    const input = editor();
    const query = queryInput()?.value ?? '';
    if (!input) return;
    input.setSelectionRange(position, position + query.length);
    scrollTo(position);
    updateCount();
  }

  function selectFirst() {
    const positions = matches();
    if (!positions.length) {
      updateCount();
      return;
    }
    selectMatch(positions[0]);
  }

  function findNext(direction: 1 | -1) {
    const input = editor();
    if (!input) return;
    const positions = matches();
    if (!positions.length) {
      updateCount();
      return;
    }
    let position: number;
    if (direction === 1) {
      position = positions.find((candidate) => candidate >= input.selectionEnd) ?? positions[0];
    } else {
      const before = positions.filter((candidate) => candidate < input.selectionStart);
      position = before.length ? before[before.length - 1] : positions[positions.length - 1];
    }
    selectMatch(position);
  }

  function replaceCurrent() {
    const input = editor();
    const query = queryInput()?.value ?? '';
    const replacement = replaceInput()?.value ?? '';
    if (!input || !query) return;
    const selected = input.value.slice(input.selectionStart, input.selectionEnd);
    const selectedMatches = caseSensitive ? selected === query : selected.toLowerCase() === query.toLowerCase();
    if (!selectedMatches) {
      findNext(1);
      return;
    }
    input.setRangeText(replacement, input.selectionStart, input.selectionEnd, 'end');
    options.setContent(input.value);
    findNext(1);
  }

  function replaceAll() {
    const input = editor();
    const query = queryInput()?.value ?? '';
    const replacement = replaceInput()?.value ?? '';
    if (!input || !query) return;
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, caseSensitive ? 'g' : 'gi');
    const found = input.value.match(regex)?.length ?? 0;
    if (!found) {
      updateCount('0 replaced');
      return;
    }
    input.value = input.value.replace(regex, () => replacement);
    input.setSelectionRange(0, 0);
    options.setContent(input.value);
    updateCount(`${found} replaced`);
  }

  function bind(box: HTMLElement) {
    const query = box.querySelector<HTMLInputElement>('.find-query');
    const replace = box.querySelector<HTMLInputElement>('.find-replace');
    query?.addEventListener('input', () => {
      lastQuery = query.value;
      selectFirst();
    });
    query?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        findNext(event.shiftKey ? -1 : 1);
      }
    });
    replace?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        replaceCurrent();
      }
    });
    box.querySelectorAll<HTMLElement>('[data-find]').forEach((button) => {
      button.addEventListener('click', () => {
        switch (button.dataset.find) {
          case 'prev':
            findNext(-1);
            break;
          case 'next':
            findNext(1);
            break;
          case 'case':
            caseSensitive = !caseSensitive;
            button.classList.toggle('active', caseSensitive);
            selectFirst();
            break;
          case 'replace':
            replaceCurrent();
            break;
          case 'replace-all':
            replaceAll();
            break;
          case 'close':
            close();
            break;
        }
      });
    });
  }

  function mount() {
    const pane = document.querySelector<HTMLElement>('.editor-pane');
    if (!pane) return null;
    let box = pane.querySelector<HTMLElement>('.findbar');
    if (!box) {
      pane.insertAdjacentHTML('afterbegin', markup);
      box = pane.querySelector<HTMLElement>('.findbar');
      if (box) bind(box);
    }
    return box;
  }

  function openBar(replace: boolean) {
    options.ensureEditorVisible();
    const box = mount();
    if (!box) return;
    open = true;
    box.hidden = false;
    const replaceRow = box.querySelector<HTMLElement>('.replace-row');
    if (replaceRow) replaceRow.hidden = !replace;
    const query = queryInput();
    const input = editor();
    if (query && input) {
      const selected = input.value.slice(input.selectionStart, input.selectionEnd);
      if (selected && !selected.includes('\n')) {
        query.value = selected;
        lastQuery = selected;
      } else if (!query.value) {
        query.value = lastQuery;
      }
      query.focus();
      query.select();
      if (query.value) selectFirst();
      else updateCount();
    }
    if (replace) replaceInput()?.focus();
  }

  function close() {
    const box = bar();
    box?.remove();
    if (open) editor()?.focus();
    open = false;
  }

  return {
    open: openBar,
    close,
    isOpen: () => open,
  };
}
