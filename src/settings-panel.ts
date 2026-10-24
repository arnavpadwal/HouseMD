import { icons } from './content';
import type { Accent, Settings, ThemeMode } from './model';

const ACCENTS: Array<{ id: Accent; label: string; swatch: string }> = [
  { id: 'amber', label: 'Amber', swatch: '#dd7555' },
  { id: 'ocean', label: 'Ocean', swatch: '#2563eb' },
  { id: 'forest', label: 'Forest', swatch: '#15803d' },
  { id: 'rose', label: 'Rose', swatch: '#e11d48' },
];

export function openSettingsPanel(initial: Settings, apply: (next: Settings) => void) {
  if (document.querySelector('.settings-backdrop')) return;
  let current: Settings = { ...initial };
  const themeButton = (theme: ThemeMode, label: string) =>
    `<button type="button" class="${current.theme === theme ? 'active' : ''}" data-theme-choice="${theme}">${label}</button>`;
  const markup = `
  <div class="settings-backdrop">
    <section class="settings-box" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <header class="settings-head">
        <div><h2 id="settings-title">Settings</h2><p>Appearance and file behavior.</p></div>
        <button type="button" class="icon-btn" data-settings-close aria-label="Close settings">${icons.close}</button>
      </header>
      <div class="settings-body">
        <section class="settings-group">
          <h3>Appearance</h3>
          <div class="settings-row">
            <span class="settings-label">Theme</span>
            <div class="segmented" role="group" aria-label="Theme">
              ${themeButton('light', 'Light')}${themeButton('dark', 'Dark')}${themeButton('system', 'System')}
            </div>
          </div>
          <div class="settings-row">
            <span class="settings-label">Accent</span>
            <div class="swatches" role="group" aria-label="Accent color">
              ${ACCENTS.map(
                (accent) =>
                  `<button type="button" class="swatch${current.accent === accent.id ? ' active' : ''}" data-accent-choice="${accent.id}" style="--swatch:${accent.swatch}" title="${accent.label}" aria-label="${accent.label}"></button>`,
              ).join('')}
            </div>
          </div>
          <div class="settings-row">
            <label class="settings-label" for="setting-preview-size">Preview text</label>
            <div class="range-control">
              <input id="setting-preview-size" type="range" min="15" max="24" step="1" value="${current.previewFontSize}" />
              <output for="setting-preview-size">${current.previewFontSize}px</output>
            </div>
          </div>
          <div class="settings-row">
            <label class="settings-label" for="setting-editor-size">Editor text</label>
            <div class="range-control">
              <input id="setting-editor-size" type="range" min="13" max="22" step="1" value="${current.editorFontSize}" />
              <output for="setting-editor-size">${current.editorFontSize}px</output>
            </div>
          </div>
        </section>
        <section class="settings-group">
          <h3>Files</h3>
          <label class="settings-check">
            <input id="setting-autosave" type="checkbox" ${current.autosave ? 'checked' : ''} />
            <span><strong>Auto-save changes</strong><small>Write edits to disk after a short pause. Recovery drafts are always kept while a tab is dirty.</small></span>
          </label>
          <label class="settings-check">
            <input id="setting-restore" type="checkbox" ${current.restoreSession ? 'checked' : ''} />
            <span><strong>Restore previous session</strong><small>Reopen tabs, folder, and unsaved recovery drafts on launch.</small></span>
          </label>
        </section>
      </div>
      <footer class="settings-foot">
        <span>Changes apply immediately.</span>
        <button type="button" class="settings-done" data-settings-close>Done</button>
      </footer>
    </section>
  </div>`;
  document.querySelector<HTMLElement>('.window')?.insertAdjacentHTML('beforeend', markup);
  const overlay = document.querySelector<HTMLElement>('.settings-backdrop');
  const controller = new AbortController();

  const close = () => {
    controller.abort();
    overlay?.remove();
    document.querySelector<HTMLElement>('.cm-content')?.focus();
  };

  const update = (patch: Partial<Settings>) => {
    current = { ...current, ...patch };
    apply(current);
    refreshControls();
  };

  const refreshControls = () => {
    overlay?.querySelectorAll<HTMLElement>('[data-theme-choice]').forEach((button) => {
      button.classList.toggle('active', button.dataset.themeChoice === current.theme);
    });
    overlay?.querySelectorAll<HTMLElement>('[data-accent-choice]').forEach((button) => {
      button.classList.toggle('active', button.dataset.accentChoice === current.accent);
    });
    const previewValue = overlay?.querySelector<HTMLOutputElement>('output[for="setting-preview-size"]');
    if (previewValue) previewValue.value = `${current.previewFontSize}px`;
    const editorValue = overlay?.querySelector<HTMLOutputElement>('output[for="setting-editor-size"]');
    if (editorValue) editorValue.value = `${current.editorFontSize}px`;
  };

  overlay?.querySelectorAll<HTMLElement>('[data-settings-close]').forEach((button) => {
    button.addEventListener('click', close);
  });
  overlay?.querySelectorAll<HTMLElement>('[data-theme-choice]').forEach((button) => {
    button.addEventListener('click', () => update({ theme: button.dataset.themeChoice as ThemeMode }));
  });
  overlay?.querySelectorAll<HTMLElement>('[data-accent-choice]').forEach((button) => {
    button.addEventListener('click', () => update({ accent: button.dataset.accentChoice as Accent }));
  });
  overlay?.querySelector<HTMLInputElement>('#setting-preview-size')?.addEventListener('input', (event) => {
    update({ previewFontSize: Number((event.target as HTMLInputElement).value) });
  });
  overlay?.querySelector<HTMLInputElement>('#setting-editor-size')?.addEventListener('input', (event) => {
    update({ editorFontSize: Number((event.target as HTMLInputElement).value) });
  });
  overlay?.querySelector<HTMLInputElement>('#setting-autosave')?.addEventListener('change', (event) => {
    update({ autosave: (event.target as HTMLInputElement).checked });
  });
  overlay?.querySelector<HTMLInputElement>('#setting-restore')?.addEventListener('change', (event) => {
    update({ restoreSession: (event.target as HTMLInputElement).checked });
  });
  overlay?.addEventListener('click', (event) => {
    if (event.target === overlay) close();
  });
  document.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
      }
    },
    { signal: controller.signal },
  );
  overlay?.querySelector<HTMLElement>('[data-settings-close]')?.focus();
}
