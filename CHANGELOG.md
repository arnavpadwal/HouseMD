# Changelog

All notable changes to HouseMD are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project uses
[Semantic Versioning](https://semver.org/).

## [2.5.0] - 2026-10-25

The editor release: CodeMirror, line numbers, multi-cursor search, and LaTeX.

### Added

- CodeMirror 6 editor with line numbers, folding, bracket matching, active-line highlighting, and undo history.
- Language-aware editor highlighting for Markdown, LaTeX, and plain text.
- CodeMirror search/replace panel with case, regexp, whole-word, next/previous, replace, and replace all.
- Select all occurrences / change all occurrences via `Ctrl+Shift+L`, `Ctrl+F2`, and the action menu.
- Select next occurrence (`Ctrl+D`) and go-to-line (`Ctrl+G`).
- LaTeX document support for `.tex` / `.latex`, with syntax highlighting for `.sty` / `.cls` and text support for `.bib`.
- LaTeX compiler detection and PDF compilation through `pdflatex`, `xelatex`, or `lualatex`.
- LaTeX build panel with compiler status, build log, generated PDF path, and open-PDF action.
- LaTeX-specific Markdown guide entries.
- LaTeX files in the open dialog, CLI launcher, recent files, and folder sidebar.

### Changed

- Replaced the textarea editor with CodeMirror while preserving tabs, session recovery, autosave, help insertion, and preview synchronization.
- Search and replace now uses the CodeMirror panel instead of the custom find bar.
- File filters now accept Markdown, LaTeX, bibliography, class, style, and text files.
- `Ctrl+/` remains the Markdown/LaTeX guide shortcut; CodeMirror's comment toggle was intentionally not bound.
- Status bar now shows the active language.

### Fixed

- Search-panel buttons render with readable text in dark mode.
- LaTeX compilation runs with shell escape disabled and reports build failures in-app.
- Opening a generated PDF without a system viewer no longer blocks the build result.

## [2.0.0] - 2026-10-24

The workspace release: tabs, recovery, search, settings, and folder browsing.

### Added

- Tabbed documents with dirty indicators, close protection, middle-click close, and tab shortcuts.
- Session recovery for tabs, unsaved drafts, active tab, and folder sidebar.
- Optional autosave to disk after a short pause.
- Recent-files menu.
- Find and replace bar with match case, next/previous, replace one, and replace all.
- Settings panel with light/dark/system themes, four accent palettes, and adjustable preview/editor font sizes.
- Collapsible folder sidebar for browsing Markdown files.
- Sanitized inline HTML support for README-style layouts, images, tables, and anchors.
- HTTPS image support in the preview.
- Recovery toast when unsaved tabs are restored.

### Changed

- Default theme now follows the system preference.
- Shell, sidebar, tabs, find, and settings layouts rewritten around the larger type scale.
- Added `src/model.ts`, `src/paths.ts`, `src/explorer.ts`, `src/findbar.ts`, and `src/settings-panel.ts` to keep the v2 surface maintainable.

### Fixed

- Multiple new documents can coexist as tabs.
- Closing a tab no longer requires discarding unrelated documents.
- Window close now reports every dirty document, not just one.
- Folder and document scopes are extended before reading files and trees.
- README HTML no longer appears as literal text and is stripped of unsafe tags and attributes.

## [1.0.0] - 2026-10-24

The first public release.

### Added

- Read, Focus, and Split layouts with a draggable and keyboard-adjustable divider.
- Live Markdown preview with tables, task lists, blockquotes, and GitHub-style anchors.
- Language-aware syntax highlighting with highlight.js.
- KaTeX inline, display, and fenced math.
- Mermaid diagrams rendered at natural size.
- GitHub-style heading IDs for table-of-contents links.
- Relative image resolution scoped to the open document's folder.
- Native open, save, and save-as dialogs, plus drag-and-drop opening.
- CLI and desktop file opening (`housemd notes.md`) with single-instance handoff.
- Dirty-state tracking and an in-app confirmation before discarding changes on close.
- Light and dark themes, remembered between launches.
- Adjustable split ratio, remembered between launches.
- Searchable Markdown guide with syntax insertion at the caret.
- Print / PDF export with a dedicated print stylesheet.
- Renderer test suite and GitHub Actions CI.
- Linux bundles: `.deb`, `.rpm`, and AppImage.

### Fixed

- Empty `<a id="…"></a>` anchors no longer appear as literal text.
- Mermaid diagrams no longer inherit the 16 px icon SVG size or the old height cap.
- Single-dollar prose such as `$5` and `$10` stays text instead of becoming math.
- Math delimiters inside code spans and fences are preserved.
- Read and Focus layouts no longer retain stale Split grid columns.
- Printing from Focus mode now prints the preview.
- Theme changes no longer require a full app re-render.
