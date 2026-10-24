# Contributing to HouseMD

Thanks for taking the time to improve HouseMD. This project is small on purpose:
focused changes, clear commits, and a clean renderer are valued over large rewrites.

## Development setup

Prerequisites:

- Rust stable
- Node.js 22.6 or newer
- pnpm 10 or newer
- Tauri system dependencies for your platform

```sh
git clone https://github.com/arnavpadwal/HouseMD.git
cd HouseMD
pnpm install
pnpm tauri dev
```

## Checks

Run these before opening a pull request:

```sh
pnpm check
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
```

`pnpm check` runs the TypeScript compiler, the renderer tests, and Prettier.
Use `pnpm format` to fix formatting automatically.

## Branches and commits

- `main` contains released, stable code.
- `develop` is the integration branch. Open pull requests against `develop`.
- Use short-lived `feature/*` or `fix/*` branches.

Write commit messages in the imperative mood and keep each commit coherent:

```text
feat: add recent files to the overflow menu
fix: keep mermaid diagrams inside the preview column
docs: document the save-as shortcut
```

## Pull requests

A good PR includes:

- A focused description of the problem and the approach
- Linked issue where applicable
- Tests for renderer or file-behavior changes
- Screenshots for visible UI changes
- No build artifacts, `node_modules`, or generated Tauri schemas

## Code style

- TypeScript is strict and formatted with Prettier.
- Keep Markdown rendering escaped; raw HTML is disabled by design.
- Keep static content in `src/content.ts` and renderer logic in `src/markdown.ts`.
- Keep global CSS selectors intentional. In particular, scope SVG sizing to app icons;
  an unscoped `svg` rule breaks Mermaid and KaTeX.
- Rust is formatted with `cargo fmt` and checked with `cargo clippy`.
- Native file access must stay inside the scopes declared in
  `src-tauri/capabilities/default.json` and the asset protocol config.

## Reporting security issues

Please do not file public issues for suspected vulnerabilities. See [SECURITY.md](SECURITY.md).
