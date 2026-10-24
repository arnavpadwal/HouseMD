# AGENTS.md

## Project

HouseMD is a quiet, local-first Markdown editor built with Tauri 2. The frontend is
framework-free TypeScript; Rust provides the desktop shell, native dialogs, file
access, and system-browser integration.

## Stack

- TypeScript 7, Vite 8, plain DOM APIs
- Tauri 2 (Rust 2021) with dialog, fs, and opener plugins
- markdown-it + markdown-it-task-lists, KaTeX, Mermaid
- pnpm; font packages from Fontsource

## Commands

```sh
pnpm install        # install frontend dependencies
pnpm tauri dev      # run the desktop app with Vite
pnpm check          # tsc --noEmit + node --test
pnpm test           # renderer tests only (Node type stripping)
pnpm build          # typecheck + production frontend in dist/
pnpm tauri build    # desktop binary and bundles in src-tauri/target/release
```

There is no lint step. TypeScript is strict and `noEmit`; Vite bundles from `index.html`.

## Architecture

- `index.html` mounts `#app`; `src/main.ts` renders the entire shell and owns app state.
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
  `allow_document_dir` / `launch_file` commands. `allow_document_dir` extends the
  asset and fs scopes to the folder of the opened/saved document.
- `src-tauri/capabilities/default.json` grants core window title/destroy, dialog,
  fs, home-recursive fs scope, and opener permissions.
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
- Window close handling uses `onCloseRequested`; the handler awaits `ask()` and calls
  `preventDefault()` when the user keeps editing.
- The Tauri window title is set via `core:window:allow-set-title`; there is no router.
- `dist/` and `src-tauri/target/` are build outputs and should not be edited.
