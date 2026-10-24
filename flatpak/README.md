# Flatpak packaging

HouseMD is packaged as a Flatpak bundle using the GNOME 51 runtime (which includes
WebKitGTK 4.1).

## Build

```sh
pnpm install
pnpm tauri build --no-bundle
bash flatpak/build-flatpak.sh
```

The script creates `HouseMD-2.5.0-x86_64.flatpak` in the repository root. It uses
`flatpak build-init`, copies the prebuilt binary and assets, finishes the sandbox
metadata, and exports a stable-branch bundle.

The equivalent `flatpak-builder` manifest is
[`com.housemd.markdown.yml`](com.housemd.markdown.yml); it expects the binary at
`src-tauri/target/release/housemd`.

## Runtime

```sh
flatpak remote-add --user --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo
flatpak install --user org.gnome.Platform//51 org.gnome.Sdk//51
```

## Sandbox notes

- `--filesystem=home` allows normal local document editing.
- `--filesystem=/tmp` shares the temporary build folder used by the LaTeX compiler.
- `--talk-name=org.freedesktop.Flatpak` lets the compiler wrappers invoke the
  user's host TeX installation. The app only exposes fixed `pdflatex`, `xelatex`,
  and `lualatex` wrappers; shell escape is disabled.
- `--share=network` is needed for HTTPS preview images and external links.

## Test

```sh
flatpak run com.housemd.markdown ~/notes.md
flatpak run com.housemd.markdown ~/paper.tex
```
