<p align="center">
  <img src="docs/icon.png" width="120" alt="HouseMD icon" />
</p>

<h1 align="center">HouseMD</h1>

<p align="center">
  A quiet, local-first Markdown workspace for Linux, macOS, and Windows.
</p>

<p align="center">
  <a href="https://github.com/arnavpadwal/HouseMD/actions/workflows/ci.yml"><img src="https://github.com/arnavpadwal/HouseMD/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://github.com/arnavpadwal/HouseMD/releases"><img src="https://img.shields.io/github/v/release/arnavpadwal/HouseMD?style=flat-square" alt="Latest release" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/arnavpadwal/HouseMD?style=flat-square" alt="License" /></a>
  <img src="https://img.shields.io/badge/platform-Linux%20%7C%20macOS%20%7C%20Windows-2ea44f?style=flat-square" alt="Platforms" />
  <img src="https://img.shields.io/badge/Tauri-2-24C8DB?style=flat-square&logo=tauri&logoColor=white" alt="Tauri 2" />
  <img src="https://img.shields.io/badge/TypeScript-7-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <a href="CONTRIBUTING.md"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square" alt="PRs welcome" /></a>
</p>

<p align="center">
  <img src="docs/screenshots/housemd-dark.png" alt="HouseMD split view in dark mode" width="100%" />
</p>

HouseMD is a small desktop Markdown editor with a calm interface and a serious renderer. It opens local files, previews them live, and keeps the tools that matter for technical writing close at hand: real syntax highlighting, KaTeX math, Mermaid diagrams, GitHub-style anchors, and relative images.

No account, no sync service, no telemetry. Your notes stay where you put them.

## Why HouseMD?

- **Local by default.** Files are read and written directly through scoped Tauri commands.
- **Built for technical notes.** Fenced code is highlighted with highlight.js; math and diagrams are first-class.
- **A preview you can trust.** GitHub-style headings, anchors, tables, task lists, and relative images render correctly.
- **A quiet interface.** Three layouts, a large readable type scale, light and dark themes, and no unnecessary chrome.
- **Desktop-native behavior.** Native open/save dialogs, drag-and-drop, file-association/CLI opening, and single-instance handoff.
- **Safe editing.** Unsaved changes are protected on open, new, and close; file and asset access is scoped to the document.

## Screenshots

<table>
  <tr>
    <td width="50%">
      <img src="docs/screenshots/housemd-light.png" alt="HouseMD read mode in light theme" />
      <p align="center"><sub><b>Read mode</b> — a comfortable measure for long documents.</sub></p>
    </td>
    <td width="50%">
      <img src="docs/screenshots/housemd-code.png" alt="HouseMD showing syntax-highlighted TypeScript and shell code" />
      <p align="center"><sub><b>Real syntax highlighting</b> — TypeScript, shell, JSON, Rust, and more.</sub></p>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <img src="docs/screenshots/housemd-help.png" alt="HouseMD Markdown help overlay" />
      <p align="center"><sub><b>Markdown guide</b> — search syntax and insert it at the caret.</sub></p>
    </td>
    <td width="50%">
      <img src="docs/screenshots/housemd-dark.png" alt="HouseMD split view with editor and live preview" />
      <p align="center"><sub><b>Split view</b> — write on the left, see the result on the right.</sub></p>
    </td>
  </tr>
</table>

## Features

|                             |                                                                                                              |
| :-------------------------- | :----------------------------------------------------------------------------------------------------------- |
| **Read / Focus / Split**    | Three layouts with an adjustable split divider (mouse, keyboard, or double-click to reset).                  |
| **Live preview**            | Markdown rendered as you type, with scroll preservation.                                                     |
| **Syntax-highlighted code** | highlight.js grammars for TypeScript, JavaScript, shell, JSON, Rust, Python, YAML, HTML, CSS, SQL, and more. |
| **KaTeX math**              | Inline `$…$`, display `$$…$$`, and fenced `math` blocks.                                                     |
| **Mermaid diagrams**        | Flowcharts, sequence diagrams, gantt charts, and the rest of Mermaid — rendered at natural size.             |
| **GitHub-style anchors**    | Heading slugs and empty `<a id="…"></a>` targets work with table-of-contents links.                          |
| **Local images**            | Relative image paths resolve against the open document's folder.                                             |
| **Native file workflow**    | Open, save, save-as, drag-and-drop, CLI/desktop file opening, and single-instance reuse.                     |
| **Safe editing**            | Dirty-state tracking and a close/open/new confirmation before discarding changes.                            |
| **Themes**                  | Carefully tuned light and dark palettes, remembered between launches.                                        |
| **Print / PDF**             | Print dialog with a clean print stylesheet for the rendered preview.                                         |

## Installation

### Prebuilt release

Download the latest bundle from [Releases](https://github.com/arnavpadwal/HouseMD/releases).

**Debian / Ubuntu**

```sh
sudo apt install ./HouseMD_1.0.0_amd64.deb
```

**Fedora / RHEL**

```sh
sudo dnf install ./HouseMD-1.0.0-1.x86_64.rpm
```

**Arch Linux / other distributions**

Use the AppImage:

```sh
chmod +x HouseMD_1.0.0_amd64.AppImage
./HouseMD_1.0.0_amd64.AppImage
```

For desktop-menu integration, use an AppImage manager such as Gear Lever, or build from source and install the binary and `.desktop` entry into `~/.local`.

> v1.0.0 ships Linux bundles. macOS and Windows builds can be produced from source with Tauri; signed installers are on the roadmap.

### Build from source

**Prerequisites**

- Rust stable
- Node.js 22.6+
- pnpm 10+
- Tauri system dependencies ([Linux](https://v2.tauri.app/start/prerequisites/), macOS, or Windows)

```sh
git clone https://github.com/arnavpadwal/HouseMD.git
cd HouseMD
pnpm install
pnpm tauri dev
```

Create a distributable for the current platform:

```sh
pnpm tauri build
```

## Usage

Open a document from the toolbar, drag a Markdown file onto the window, or pass one on the command line:

```sh
housemd notes.md
```

A second launch with another file reuses the existing window.

### Keyboard shortcuts

| Action              | Shortcut               |
| :------------------ | :--------------------- |
| New document        | `Ctrl+N` / `⌘N`        |
| Open                | `Ctrl+O` / `⌘O`        |
| Save                | `Ctrl+S` / `⌘S`        |
| Save as             | `Ctrl+Shift+S` / `⌘⇧S` |
| Print / PDF         | `Ctrl+P` / `⌘P`        |
| Markdown guide      | `Ctrl+/` / `⌘/`        |
| Close guide or menu | `Esc`                  |

### Markdown support

- CommonMark, GFM tables and task lists
- Fenced code with language-aware highlighting
- Inline and display math with KaTeX
- Mermaid diagrams in `mermaid` fences
- Relative image paths and external links
- GitHub-style heading IDs and explicit anchors
- Raw HTML stays escaped by design; empty `<a id="…"></a>` anchors are the exception

## Architecture

```mermaid
flowchart LR
  UI["TypeScript UI<br/>markdown-it · KaTeX · Mermaid · highlight.js"]
  Shell["Tauri 2 / Rust shell"]
  OS["Native dialogs<br/>scoped file access<br/>system browser"]

  UI <-->|IPC| Shell
  Shell --> OS
```

- **Frontend:** framework-free TypeScript, Vite, and a single sectioned stylesheet.
- **Renderer:** `src/markdown.ts` — markdown-it, highlight.js, KaTeX, Mermaid, anchors, and heading IDs.
- **Shell:** `src-tauri/src/lib.rs` — Tauri plugins, scoped asset/file access, CLI file opening, and single-instance handoff.
- **Tests:** Node's test runner against the pure renderer.

```text
src/
  content.ts      sample document, icons, Markdown guide entries
  main.ts         app shell, editor, file lifecycle, menus, shortcuts
  markdown.ts     Markdown/KaTeX/Mermaid/highlight.js renderer
  style.css       design tokens, layout, Markdown, themes, print
  vendor.d.ts     ambient declarations for untyped dependencies
tests/
  markdown.test.ts
src-tauri/
  src/lib.rs      Tauri setup and native commands
  capabilities/   permission scopes
  tauri.conf.json window, CSP, asset protocol, bundles
```

## Development

```sh
pnpm install
pnpm tauri dev      # desktop app with Vite
pnpm check          # typecheck + tests + Prettier check
pnpm build          # frontend production build
pnpm tauri build    # desktop bundles
```

Useful individual commands:

```sh
pnpm typecheck
pnpm test
pnpm format
cargo fmt --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
```

### Branches

| Branch      | Purpose                                       |
| :---------- | :-------------------------------------------- |
| `main`      | Stable, released code                         |
| `develop`   | Integration branch for the next release       |
| `feature/*` | Focused changes, opened as PRs into `develop` |

## Roadmap

- [x] v1.0.0 — renderer, themes, file workflow, single instance
- [ ] Tabs and recent files
- [ ] Autosave and crash recovery
- [ ] Find and replace
- [ ] User themes and font settings
- [ ] Signed macOS and Windows installers
- [ ] Optional workspace/folder view

Have an idea? [Open an issue](https://github.com/arnavpadwal/HouseMD/issues).

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) for setup, branch, and review guidance. Please open PRs against `develop`.

## License

HouseMD is released under the [MIT License](LICENSE).

Bundled fonts are licensed under the SIL Open Font License; see [`public/licenses`](public/licenses). Third-party libraries retain their own licenses.

## Acknowledgements

Built with [Tauri](https://tauri.app), [markdown-it](https://github.com/markdown-it/markdown-it), [highlight.js](https://highlightjs.org), [KaTeX](https://katex.org), and [Mermaid](https://mermaid.js.org). Type set in [Source Sans 3](https://adobe-fonts.github.io/source-sans/) and [Source Code Pro](https://adobe-fonts.github.io/source-code-pro/).
