#!/usr/bin/env bash
# UmJoonSIC installer for Linux on x86-64 (Wayland and X11 desktops).
#
#   ./install.sh                  install for the current user (~/.local), no root needed
#   sudo ./install.sh --system    install for all users (/opt/umjoonsic)
#   ./install.sh --uninstall      remove it again (with --system for a system install;
#                                 --purge also removes the settings and the downloaded Java)
#   ./install.sh --help
#
# Run it from the extracted release folder (UmJoonSIC-linux-x64-<version>/). Run on its own
# (for example after downloading only this script), it first downloads that folder for its
# version from the GitHub release.
#
# What it sets up: the app files, a launcher command (umjoonsic), a menu entry with the icon.
# The launcher chooses the display backend (X11, or Xwayland on a Wayland session; native
# Wayland when there is no X server) and Chromium's sandbox mode (see sandbox_ok below).
set -euo pipefail

VERSION="@VERSION@" # filled in by pack.sh
REPO="CAPS-DGU/UmJoonSIC"
ID="umjoonsic"

say() { printf '%s\n' "$*"; }
warn() { printf 'warning: %s\n' "$*" >&2; }
die() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

usage() {
  sed -n '2,13p' "$0" 2>/dev/null | sed 's/^# \{0,1\}//'
  exit 0
}

system=0
uninstall=0
purge=0
assume_yes=0
for arg in "$@"; do
  case "$arg" in
    --system) system=1 ;;
    --uninstall) uninstall=1 ;;
    --purge) purge=1 ;;
    -y | --yes) assume_yes=1 ;;
    -h | --help) usage ;;
    *) die "unknown option: $arg (see --help)" ;;
  esac
done

# Root without --system would install into /root: a system install is what was meant.
if [ "$(id -u)" -eq 0 ] && [ "$system" -eq 0 ]; then
  say "Running as root: installing for all users (as with --system)."
  system=1
fi
if [ "$system" -eq 1 ] && [ "$(id -u)" -ne 0 ]; then
  die "--system needs root: sudo $0 $*"
fi

if [ "$system" -eq 1 ]; then
  app_dir="/opt/$ID"
  bin_dir="/usr/local/bin"
  desktop_dir="/usr/local/share/applications"
else
  data_home="${XDG_DATA_HOME:-$HOME/.local/share}"
  app_dir="$data_home/$ID"
  bin_dir="$HOME/.local/bin"
  desktop_dir="$data_home/applications"
fi
launcher="$bin_dir/$ID"
desktop_file="$desktop_dir/$ID.desktop"

# A yes/no question on the terminal (also when this script is read from a pipe).
ask() {
  [ "$assume_yes" -eq 1 ] && return 0
  local answer=""
  if [ -r /dev/tty ]; then
    printf '%s [Y/n] ' "$1" >/dev/tty
    read -r answer </dev/tty || answer="n"
  else
    return 1
  fi
  case "$answer" in "" | y | Y | yes | Yes) return 0 ;; *) return 1 ;; esac
}

refresh_menus() {
  command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database -q "$desktop_dir" 2>/dev/null || true
}

# ---------------------------------------------------------------------------------------
# Uninstall
# ---------------------------------------------------------------------------------------
if [ "$uninstall" -eq 1 ]; then
  rm -rf "$app_dir" "$app_dir.new"
  rm -f "$launcher" "$desktop_file"
  refresh_menus
  say "UmJoonSIC was removed ($app_dir)."
  if [ "$purge" -eq 1 ] && [ "$system" -eq 0 ]; then
    # Electron's settings folder, and the Java runtime and simulator downloaded at first start.
    rm -rf "${XDG_CONFIG_HOME:-$HOME/.config}/UmJoonSIC" "${XDG_CONFIG_HOME:-$HOME/.config}/$ID"
    say "Settings and downloaded files were removed too."
  else
    say "Your projects are untouched. Settings and the downloaded Java runtime stay in"
    say "${XDG_CONFIG_HOME:-~/.config}/UmJoonSIC and ${XDG_CONFIG_HOME:-~/.config}/$ID (remove them with --uninstall --purge)."
  fi
  exit 0
fi

# ---------------------------------------------------------------------------------------
# Install
# ---------------------------------------------------------------------------------------
case "$(uname -m)" in
  x86_64 | amd64) ;;
  *) die "this build is for x86-64; this computer is $(uname -m)" ;;
esac

# The release folder next to this script; otherwise download it.
src_dir=""
if [ -n "${BASH_SOURCE[0]:-}" ] && [ -f "${BASH_SOURCE[0]}" ]; then
  here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  [ -x "$here/UmJoonSIC/UmJoonSIC" ] && src_dir="$here"
fi
if [ -z "$src_dir" ]; then
  case "$VERSION" in @*) die "run this script from the extracted UmJoonSIC-linux-x64 folder" ;; esac
  name="UmJoonSIC-linux-x64-$VERSION"
  url="https://github.com/$REPO/releases/download/v$VERSION/$name.tar.gz"
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' EXIT
  say "Downloading $name.tar.gz ..."
  if command -v curl >/dev/null 2>&1; then
    curl -fL --progress-bar -o "$tmp/$name.tar.gz" "$url" || die "download failed: $url"
  elif command -v wget >/dev/null 2>&1; then
    wget -q --show-progress -O "$tmp/$name.tar.gz" "$url" || die "download failed: $url"
  else
    die "curl or wget is needed to download $url"
  fi
  tar -xzf "$tmp/$name.tar.gz" -C "$tmp" || die "could not unpack $name.tar.gz"
  bash "$tmp/$name/install.sh" "$@"
  exit $?
fi

# Libraries the app needs that are missing (an unusual minimal system): name them, go on.
if command -v ldd >/dev/null 2>&1; then
  missing="$(ldd "$src_dir/UmJoonSIC/UmJoonSIC" 2>/dev/null | awk '/not found/ {print $1}' | sort -u | tr '\n' ' ')"
  if [ -n "$missing" ]; then
    warn "these libraries are missing: $missing"
    warn "install them with your package manager (for example: sudo apt install libnss3 libgtk-3-0 libgbm1 libasound2)."
  fi
fi

if pgrep -f "$app_dir/UmJoonSIC" >/dev/null 2>&1; then
  die "UmJoonSIC is running from $app_dir: close it, then run the installer again"
fi

say "Installing UmJoonSIC $VERSION into $app_dir ..."
mkdir -p "$(dirname "$app_dir")" "$bin_dir" "$desktop_dir"
rm -rf "$app_dir.new"
cp -a "$src_dir/UmJoonSIC" "$app_dir.new"
[ -f "$src_dir/$ID.png" ] && cp "$src_dir/$ID.png" "$app_dir.new/$ID.png"
rm -rf "$app_dir"
mv "$app_dir.new" "$app_dir"

# Chromium's sandbox needs either unprivileged user namespaces or a setuid-root helper.
# Some systems (Ubuntu 24.04 and later, Debian with the old default, hardened kernels) do not
# allow the first; the helper then has to belong to root, which needs sudo once.
userns_allowed() {
  [ "$(cat /proc/sys/kernel/unprivileged_userns_clone 2>/dev/null || echo 1)" = 1 ] &&
    [ "$(cat /proc/sys/kernel/apparmor_restrict_unprivileged_userns 2>/dev/null || echo 0)" = 0 ] &&
    [ "$(cat /proc/sys/user/max_user_namespaces 2>/dev/null || echo 1)" != 0 ]
}
helper="$app_dir/chrome-sandbox"
if [ "$system" -eq 1 ]; then
  chown root:root "$helper" && chmod 4755 "$helper"
elif ! userns_allowed; then
  say "This system restricts the sandbox Chromium normally uses."
  if command -v sudo >/dev/null 2>&1 && ask "Set up the sandbox helper with sudo now (recommended)?"; then
    if ! { sudo chown root:root "$helper" && sudo chmod 4755 "$helper"; }; then
      warn "sudo failed: the app will start without Chromium's sandbox"
    fi
  else
    say "The app will start without Chromium's sandbox (--no-sandbox). To set it up later:"
    say "  sudo chown root:root '$helper' && sudo chmod 4755 '$helper'"
  fi
fi

# The launcher: display backend and sandbox are decided at every start.
cat >"$launcher" <<LAUNCHER
#!/usr/bin/env bash
# UmJoonSIC launcher, written by install.sh. Options for the environment:
#   UMJOONSIC_OZONE=wayland|x11|auto   choose the display backend (default: X11 or Xwayland,
#                                      native Wayland only when there is no X server)
#   UMJOONSIC_DISABLE_GPU=1            software rendering (for broken graphics drivers)
APP_DIR='$app_dir'
LAUNCHER
cat >>"$launcher" <<'LAUNCHER'
args=()
case "${UMJOONSIC_OZONE:-}" in
  wayland) args+=(--ozone-platform=wayland --enable-features=WaylandWindowDecorations) ;;
  x11) args+=(--ozone-platform=x11) ;;
  auto) args+=(--ozone-platform-hint=auto --enable-features=WaylandWindowDecorations) ;;
  *)
    if [ -n "${WAYLAND_DISPLAY:-}" ] && [ -z "${DISPLAY:-}" ]; then
      args+=(--ozone-platform=wayland --enable-features=WaylandWindowDecorations)
    fi
    ;;
esac
[ -n "${UMJOONSIC_DISABLE_GPU:-}" ] && args+=(--disable-gpu)

# Chromium's sandbox: a setuid-root helper, or unprivileged user namespaces. Without either
# (and as root, where Chromium refuses it), the app runs with --no-sandbox.
sandbox_ok() {
  [ "$(id -u)" -ne 0 ] || return 1
  local helper="$APP_DIR/chrome-sandbox"
  if [ -u "$helper" ] && [ "$(stat -c %u "$helper" 2>/dev/null)" = 0 ]; then return 0; fi
  [ "$(cat /proc/sys/kernel/unprivileged_userns_clone 2>/dev/null || echo 1)" = 1 ] || return 1
  [ "$(cat /proc/sys/kernel/apparmor_restrict_unprivileged_userns 2>/dev/null || echo 0)" = 0 ] || return 1
  [ "$(cat /proc/sys/user/max_user_namespaces 2>/dev/null || echo 1)" != 0 ] || return 1
}
sandbox_ok || args+=(--no-sandbox)

if [ -n "${UMJOONSIC_DRY_RUN:-}" ]; then
  printf '%q ' "$APP_DIR/UmJoonSIC" "${args[@]}" "$@"
  printf '\n'
  exit 0
fi
exec "$APP_DIR/UmJoonSIC" "${args[@]}" "$@"
LAUNCHER
chmod 755 "$launcher"

# The menu entry. No MimeType: the app would become the default for .asm files, which other
# tools also open; "Open With" can still choose it (Exec takes the files).
exec_path="$launcher"
case "$exec_path" in *[[:space:]]*) exec_path="\"$exec_path\"" ;; esac
cat >"$desktop_file" <<DESKTOP
[Desktop Entry]
Type=Application
Name=UmJoonSIC
Name[ko]=엄준SIC
GenericName=SIC/XE Assembly IDE
GenericName[ko]=SIC/XE 어셈블리 실습
Comment=Write, assemble, run and debug SIC and SIC/XE assembly
Comment[ko]=SIC/SIC-XE 어셈블리 작성, 어셈블, 실행, 디버깅
Exec=$exec_path %F
Icon=$app_dir/$ID.png
Terminal=false
Categories=Development;IDE;
Keywords=SIC;SICXE;assembly;assembler;simulator;
StartupWMClass=UmJoonSIC
DESKTOP
chmod 644 "$desktop_file"
refresh_menus

say ""
say "UmJoonSIC $VERSION is installed."
say "  Start it from the applications menu, or with: $ID"
case ":$PATH:" in
  *":$bin_dir:"*) ;;
  *) say "  ($bin_dir is not in your PATH: run $launcher, or add it to PATH)" ;;
esac
say "  At its first start it downloads its Java runtime and simulator (about 45 MB)."
if [ "$system" -eq 1 ]; then
  say "  Remove it with: sudo $0 --uninstall --system"
else
  say "  Remove it with: $0 --uninstall"
fi
