# AGENTS.md

## Project

HouseMD is a quiet, local-first Markdown editor built with Tauri 2. The frontend is
framework-free TypeScript; Rust provides the desktop shell, native dialogs, file
access, and system-browser integration.

## Stack

- TypeScript 7, Vite 8, plain DOM APIs
- Tauri 2 (Rust 2021) with dialog, fs, and opener plugins
- markdown-it + markdown-it-task-lists, KaTeX, Mermaid, highlight.js
- pnpm; font packages from Fontsource; Prettier for formatting

## Version

Version 2.5.0 is the current public baseline (CodeMirror editor, line numbers, search/multi-cursor,
LaTeX editing and compilation, tabs, recovery, settings, and folder sidebar).

## Commands

```sh
pnpm install        # install frontend dependencies
pnpm tauri dev      # run the desktop app with Vite
pnpm check          # tsc --noEmit + 18 tests + Prettier check
pnpm test           # renderer tests only (Node type stripping)
pnpm format         # format the repo with Prettier
pnpm build          # typecheck + production frontend in dist/
pnpm tauri build    # desktop binary and bundles in src-tauri/target/release
cargo fmt --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
```

TypeScript is strict and `noEmit`; Prettier enforces style and Rust uses `cargo fmt` / `clippy`. Vite bundles from `index.html`.

## Architecture

- `index.html` mounts `#app`; `src/main.ts` renders the entire shell and owns app state.
- `src/content.ts` owns the sample document, SVG icon strings, and Markdown guide entries.
- `src/model.ts` owns tab, settings, recent-file, and session types/storage. `src/paths.ts` has
  cross-platform path helpers.
- `src/editor.ts` owns the CodeMirror 6 editor, language configuration, search, multi-cursor,
  line numbers, and LaTeX language mode. `src/explorer.ts` renders the folder sidebar and
  `src/settings-panel.ts` owns the appearance/file settings dialog.
- `src/style.css` is a sectioned stylesheet (tokens, shell, workspace, CodeMirror host, Markdown, LaTeX panel, overlays, print). Never reintroduce global `svg { width }` sizing; it breaks Mermaid and KaTeX.
- `src/markdown.ts` is the pure renderer: it extracts math before Markdown, protects code
  spans/fences from the math pass, converts empty GitHub-style anchors into invisible
  targets, adds heading ids for TOC links, highlights fenced code with highlight.js, and
  renders Mermaid fences as `.mermaid` containers. It is covered by
  `tests/markdown.test.ts`.
- `src/main.ts` handles:
  - document state (`content`, `savedContent`, `currentPath`, `dirty`)
  - file operations through `@tauri-apps/plugin-dialog` and `@tauri-apps/plugin-fs`
  - unsaved-change prompts (`ask`) for new/open/close
  - external links through `@tauri-apps/plugin-opener`
  - relative image resolution through `convertFileSrc` and the asset protocol
  - window title, drag-and-drop opening, menus, help overlay, split divider
  - command-line/desktop file opening via the `launch_file` command and the
    `open-file` event from the single-instance plugin
  - an in-app close confirmation (not a native dialog, which can deadlock while a
    close request is pending)
- `src-tauri/src/lib.rs` registers plugins (single-instance first) and the
  `allow_document_dir`, `launch_file`, `latex_compiler`, and `compile_latex` commands.
  `allow_document_dir` extends the asset and fs scopes to the opened/saved document folder;
  `compile_latex` runs pdflatex/xelatex/lualatex with shell escape disabled.
- `src-tauri/capabilities/default.json` grants core window title/destroy, dialog,
  fs (including read-dir), home-recursive fs scope, opener URL/path, and single-instance support.
- `src-tauri/tauri.conf.json` defines the window, CSP, asset protocol, and bundling.

## Conventions and gotchas

- Keep DOM rendering escaped; `html: false` is intentional. Markdown may contain
  untrusted text, and help/table/string interpolation must use `escapeHtml`.
- The app does not use a framework or state library. Updates to mode/theme/help are
  done in place to avoid losing editor selection; full `renderApp()` is used for
  document changes.
- Math is preprocessed, not handled by a markdown-it plugin. Single-dollar math is
  conservative so currency like `$5` and `$10` stays text. Keep code protected.
- Mermaid is dynamically imported only when `.mermaid` nodes exist; theme changes
  re-render the preview. Keep the global icon `svg` rule scoped to buttons/help because
  an unscoped `svg` size breaks Mermaid's layout and KaTeX's stretchy glyphs.
- Native dialogs add only the selected file to fs scope. Use `allow_document_dir`
  before reading dropped files or showing sibling images.
- All frontend file access must stay inside the scopes declared in capabilities and
  the asset protocol config; do not widen them without a reason.
- Window close handling uses `onCloseRequested` and an in-app confirmation overlay, never a
  native dialog (native dialogs can deadlock while a close request is pending).
- The Tauri window title is set via `core:window:allow-set-title`; there is no router.
- `dist/`, `src-tauri/target/`, and `src-tauri/gen/` are ignored build outputs; never edit or
  commit them.
- CI lives in `.github/workflows/ci.yml` and runs frontend checks, Rust fmt/clippy, and a
  Tauri build on `main` and `develop`.
- Version 2.5.0 is the public baseline. Keep `main` release-ready and integrate work on
  `develop`.
