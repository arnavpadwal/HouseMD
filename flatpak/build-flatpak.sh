#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

binary="src-tauri/target/release/housemd"
if [[ ! -x "$binary" ]]; then
  pnpm tauri build --no-bundle
fi

build_dir="$(mktemp -d)"
trap 'rm -rf "$build_dir"' EXIT
repo="$(mktemp -d)"
trap 'rm -rf "$build_dir" "$repo"' EXIT

flatpak build-init "$build_dir" com.ortiqo.housemd org.gnome.Sdk//51 org.gnome.Platform//51

install -Dm755 "$binary" "$build_dir/files/bin/housemd"
for compiler in pdflatex xelatex lualatex; do
  install -Dm755 "flatpak/$compiler" "$build_dir/files/bin/$compiler"
done
install -Dm644 flatpak/com.ortiqo.housemd.desktop "$build_dir/files/share/applications/com.ortiqo.housemd.desktop"
install -Dm644 flatpak/com.ortiqo.housemd.metainfo.xml "$build_dir/files/share/metainfo/com.ortiqo.housemd.metainfo.xml"
install -Dm644 LICENSE "$build_dir/files/share/licenses/com.ortiqo.housemd/LICENSE"
install -Dm644 src-tauri/icons/32x32.png "$build_dir/files/share/icons/hicolor/32x32/apps/com.ortiqo.housemd.png"
install -Dm644 src-tauri/icons/128x128.png "$build_dir/files/share/icons/hicolor/128x128/apps/com.ortiqo.housemd.png"
install -Dm644 src-tauri/icons/128x128@2x.png "$build_dir/files/share/icons/hicolor/256x256/apps/com.ortiqo.housemd.png"
install -Dm644 flatpak/icon-512.png "$build_dir/files/share/icons/hicolor/512x512/apps/com.ortiqo.housemd.png"

flatpak build-finish "$build_dir" \
  --command=housemd \
  --metadata=Application=version=2.5.0 \
  --share=ipc \
  --share=network \
  --socket=wayland \
  --socket=fallback-x11 \
  --device=dri \
  --filesystem=home \
  --filesystem=/tmp \
  --talk-name=org.freedesktop.portal.Desktop \
  --talk-name=org.freedesktop.Flatpak

flatpak build-export "$repo" "$build_dir" stable
flatpak build-bundle "$repo" "HouseMD-2.5.0-x86_64.flatpak" com.ortiqo.housemd stable
echo "Created HouseMD-2.5.0-x86_64.flatpak"
