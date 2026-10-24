# Changelog

All notable changes to HouseMD are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project uses
[Semantic Versioning](https://semver.org/).

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
