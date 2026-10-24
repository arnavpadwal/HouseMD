# Changelog

All notable changes to HouseMD are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project uses
[Semantic Versioning](https://semver.org/).

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
