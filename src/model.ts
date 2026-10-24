import { baseName } from './paths';

export type ViewMode = 'read' | 'focus' | 'split';
export type ThemeMode = 'light' | 'dark' | 'system';
export type Accent = 'amber' | 'ocean' | 'forest' | 'rose';

export interface Tab {
  id: string;
  path: string;
  content: string;
  savedContent: string;
  dirty: boolean;
  editorScroll: number;
  previewScroll: number;
  selectionStart: number;
  selectionEnd: number;
}

export interface StoredTab {
  path: string;
  content: string;
  savedContent: string;
  dirty: boolean;
}

export interface Session {
  tabs: StoredTab[];
  activeIndex: number;
  folder: string;
}

export interface Settings {
  theme: ThemeMode;
  accent: Accent;
  previewFontSize: number;
  editorFontSize: number;
  autosave: boolean;
  restoreSession: boolean;
  sidebarOpen: boolean;
}

export const SETTINGS_KEY = 'housemd-settings-v2';
export const SESSION_KEY = 'housemd-session-v2';
export const RECENT_KEY = 'housemd-recent-v2';
export const LEGACY_THEME_KEY = 'housemd-theme';

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  accent: 'amber',
  previewFontSize: 18,
  editorFontSize: 17,
  autosave: false,
  restoreSession: true,
  sidebarOpen: false,
};

const THEMES: ThemeMode[] = ['light', 'dark', 'system'];
const ACCENTS: Accent[] = ['amber', 'ocean', 'forest', 'rose'];

export function createTab(content = '', path = '', savedContent = content): Tab {
  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `tab-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return {
    id,
    path,
    content,
    savedContent,
    dirty: content !== savedContent,
    editorScroll: 0,
    previewScroll: 0,
    selectionStart: 0,
    selectionEnd: 0,
  };
}

export function tabLabel(tab: Tab, index: number, total: number) {
  if (tab.path) return baseName(tab.path, 'Untitled.md');
  return total > 1 ? `Untitled ${index + 1}` : 'Untitled';
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Settings>;
      return {
        theme: THEMES.includes(parsed.theme as ThemeMode) ? (parsed.theme as ThemeMode) : DEFAULT_SETTINGS.theme,
        accent: ACCENTS.includes(parsed.accent as Accent) ? (parsed.accent as Accent) : DEFAULT_SETTINGS.accent,
        previewFontSize: clamp(Number(parsed.previewFontSize) || DEFAULT_SETTINGS.previewFontSize, 15, 24),
        editorFontSize: clamp(Number(parsed.editorFontSize) || DEFAULT_SETTINGS.editorFontSize, 13, 22),
        autosave: Boolean(parsed.autosave),
        restoreSession: parsed.restoreSession !== false,
        sidebarOpen: Boolean(parsed.sidebarOpen),
      };
    }
    const legacyTheme = localStorage.getItem(LEGACY_THEME_KEY);
    if (legacyTheme === 'light' || legacyTheme === 'dark') {
      return { ...DEFAULT_SETTINGS, theme: legacyTheme };
    }
  } catch (error) {
    console.error('Could not read settings', error);
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(settings: Settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Could not persist settings', error);
  }
}

export function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.filter((value): value is string => typeof value === 'string' && value.length > 0))].slice(
      0,
      10,
    );
  } catch {
    return [];
  }
}

export function addRecent(path: string) {
  const recent = [path, ...loadRecent().filter((value) => value !== path)].slice(0, 10);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
  } catch (error) {
    console.error('Could not persist recent files', error);
  }
  return recent;
}

export function clearRecent() {
  try {
    localStorage.removeItem(RECENT_KEY);
  } catch {
    /* ignore */
  }
}

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Session>;
    if (!Array.isArray(parsed.tabs) || parsed.tabs.length === 0) return null;
    const tabs = parsed.tabs
      .filter(
        (tab): tab is StoredTab =>
          typeof tab === 'object' &&
          tab !== null &&
          typeof tab.content === 'string' &&
          typeof tab.savedContent === 'string' &&
          typeof tab.path === 'string',
      )
      .slice(0, 20)
      .map((tab) => ({
        path: tab.path,
        content: tab.content,
        savedContent: tab.savedContent,
        dirty: Boolean(tab.dirty) || tab.content !== tab.savedContent,
      }));
    if (tabs.length === 0) return null;
    const activeIndex = clamp(Number(parsed.activeIndex) || 0, 0, tabs.length - 1);
    return { tabs, activeIndex, folder: typeof parsed.folder === 'string' ? parsed.folder : '' };
  } catch {
    return null;
  }
}

export function saveSession(session: Session) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch (error) {
    console.error('Could not persist session', error);
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}
