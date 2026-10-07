#!/usr/bin/env bash
# Build the Linux x86-64 release files from the output of `pnpm package`:
#   cd app && pnpm package && bash ../linux-installer/pack.sh
# Writes app/out/release/:
#   UmJoonSIC-linux-x64-<version>.tar.gz   the app, install.sh, the icon and the licence
#   install-linux.sh                       the same installer on its own (downloads the archive)
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/.." && pwd)"
app="$root/app"
src="$app/out/UmJoonSIC-linux-x64"
[ -x "$src/UmJoonSIC" ] || {
  echo "error: $src not found; run 'pnpm package' in app/ first" >&2
  exit 1
}
version="$(node -p "require('$app/package.json').version")"
name="UmJoonSIC-linux-x64-$version"
dist="$app/out/release"
stage="$dist/$name"

rm -rf "$stage" "$dist/$name.tar.gz"
mkdir -p "$stage"
cp -a "$src" "$stage/UmJoonSIC"
# The newest glibc symbol version the app's binaries need: the installer checks the system's.
min_glibc="$(objdump -T "$src/UmJoonSIC" "$src/chrome_crashpad_handler" "$src"/*.so* 2>/dev/null |
  grep -o 'GLIBC_[0-9.]*' | sed 's/GLIBC_//' | sort -V | tail -n 1)"
[ -n "$min_glibc" ] || echo "warning: objdump found no glibc versions; the installer will not check glibc" >&2
sed -e "s/@VERSION@/$version/" -e "s/@MIN_GLIBC@/${min_glibc:-@MIN_GLIBC@}/" "$here/install.sh" >"$stage/install.sh"
chmod 755 "$stage/install.sh"
cp "$stage/install.sh" "$dist/install-linux.sh"
cp "$root/LICENSE" "$stage/LICENSE"
# The menu icon: 512 px is plenty (the source is 1024 px).
if command -v convert >/dev/null 2>&1; then
  convert "$app/src/assets/icon.png" -resize 512x512 "$stage/umjoonsic.png"
else
  cp "$app/src/assets/icon.png" "$stage/umjoonsic.png"
fi

tar -C "$dist" --owner=0 --group=0 -czf "$dist/$name.tar.gz" "$name"
rm -rf "$stage"
(cd "$dist" && sha256sum "$name.tar.gz" install-linux.sh)
