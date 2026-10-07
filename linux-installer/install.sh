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

VERSION="@VERSION@"     # filled in by pack.sh
MIN_GLIBC="@MIN_GLIBC@" # the newest glibc symbol version the app needs (measured by pack.sh)
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

# ---------------------------------------------------------------------------------------
# The system: C library, shared libraries, a Korean font
# ---------------------------------------------------------------------------------------
# shellcheck disable=SC1091 # the system's own file
os_name="$( (. /etc/os-release 2>/dev/null && printf '%s' "${PRETTY_NAME:-$NAME}") || true)"
say "System: ${os_name:-unknown Linux} ($(uname -m))"

# $1 >= $2, as versions.
version_ge() { [ "$(printf '%s\n%s\n' "$2" "$1" | sort -V | head -n 1)" = "$2" ]; }

# The app is built against glibc; musl systems (Alpine) cannot run it.
libc="$(getconf GNU_LIBC_VERSION 2>/dev/null || true)"
[ -n "$libc" ] || die "UmJoonSIC needs a glibc-based distribution; this system's C library is not glibc (Alpine and other musl systems are not supported)"
libc="${libc#glibc }"
case "$MIN_GLIBC" in
  @*) ;;
  *) version_ge "$libc" "$MIN_GLIBC" || die "this system's glibc $libc is too old: UmJoonSIC needs glibc $MIN_GLIBC or newer" ;;
esac

# Run a command as root: directly, or through sudo.
as_root() {
  if [ "$(id -u)" -eq 0 ]; then
    "$@"
  elif command -v sudo >/dev/null 2>&1; then
    sudo "$@"
  else
    return 1
  fi
}

pm=""
for candidate in apt-get dnf yum zypper pacman; do
  if command -v "$candidate" >/dev/null 2>&1; then
    pm="$candidate"
    break
  fi
done

# The package that provides a shared library, for each package manager. rpm-based systems
# resolve the library name itself ("libgbm.so.1()(64bit)"); apt and pacman need the package.
package_for() {
  local lib="$1"
  case "$pm" in
    dnf | yum | zypper) printf '%s()(64bit)\n' "$lib" ;;
    apt-get)
      case "$lib" in
        libglib-2.0.so.0 | libgobject-2.0.so.0 | libgio-2.0.so.0) echo libglib2.0-0 ;;
        libnspr4.so) echo libnspr4 ;;
        libnss3.so | libnssutil3.so | libsmime3.so) echo libnss3 ;;
        libdbus-1.so.3) echo libdbus-1-3 ;;
        libatk-1.0.so.0) echo libatk1.0-0 ;;
        libatk-bridge-2.0.so.0) echo libatk-bridge2.0-0 ;;
        libatspi.so.0) echo libatspi2.0-0 ;;
        libcups.so.2) echo libcups2 ;;
        libcairo.so.2) echo libcairo2 ;;
        libgtk-3.so.0) echo libgtk-3-0 ;;
        libpango-1.0.so.0) echo libpango-1.0-0 ;;
        libX11.so.6) echo libx11-6 ;;
        libXcomposite.so.1) echo libxcomposite1 ;;
        libXdamage.so.1) echo libxdamage1 ;;
        libXext.so.6) echo libxext6 ;;
        libXfixes.so.3) echo libxfixes3 ;;
        libXrandr.so.2) echo libxrandr2 ;;
        libgbm.so.1) echo libgbm1 ;;
        libexpat.so.1) echo libexpat1 ;;
        libxcb.so.1) echo libxcb1 ;;
        libxkbcommon.so.0) echo libxkbcommon0 ;;
        libudev.so.1) echo libudev1 ;;
        libasound.so.2) echo libasound2 ;;
        libGL.so.1) echo libgl1 ;;
        *) return 1 ;;
      esac
      ;;
    pacman)
      case "$lib" in
        libglib-2.0.so.0 | libgobject-2.0.so.0 | libgio-2.0.so.0) echo glib2 ;;
        libnspr4.so) echo nspr ;;
        libnss3.so | libnssutil3.so | libsmime3.so) echo nss ;;
        libdbus-1.so.3) echo dbus ;;
        libatk-1.0.so.0 | libatk-bridge-2.0.so.0 | libatspi.so.0) echo at-spi2-core ;;
        libcups.so.2) echo libcups ;;
        libcairo.so.2) echo cairo ;;
        libgtk-3.so.0) echo gtk3 ;;
        libpango-1.0.so.0) echo pango ;;
        libX11.so.6) echo libx11 ;;
        libXcomposite.so.1) echo libxcomposite ;;
        libXdamage.so.1) echo libxdamage ;;
        libXext.so.6) echo libxext ;;
        libXfixes.so.3) echo libxfixes ;;
        libXrandr.so.2) echo libxrandr ;;
        libgbm.so.1) echo mesa ;;
        libexpat.so.1) echo expat ;;
        libxcb.so.1) echo libxcb ;;
        libxkbcommon.so.0) echo libxkbcommon ;;
        libudev.so.1) echo systemd-libs ;;
        libasound.so.2) echo alsa-lib ;;
        libGL.so.1) echo libglvnd ;;
        *) return 1 ;;
      esac
      ;;
    *) return 1 ;;
  esac
}

# A font for the Korean interface (the menus use the system's fonts).
korean_font_package() {
  case "$pm" in
    apt-get) echo fonts-noto-cjk ;;
    dnf | yum) echo 'font(:lang=ko)' ;;
    zypper) echo noto-sans-cjk-fonts ;;
    pacman) echo noto-fonts-cjk ;;
    *) return 1 ;;
  esac
}

# Whether a shared library is installed (the dynamic linker's cache, or the usual folders).
has_lib() {
  local dir
  { ldconfig -p 2>/dev/null || /sbin/ldconfig -p 2>/dev/null; } | grep -qE "[[:space:]]$1[[:space:]]" && return 0
  for dir in /usr/lib/x86_64-linux-gnu /usr/lib64 /usr/lib /lib64 /lib/x86_64-linux-gnu; do
    [ -e "$dir/$1" ] && return 0
  done
  return 1
}
# The libraries ldd cannot find, and libGL.so.1, which Chromium's GPU process loads at run time
# (without it the app exits with "GPU process isn't usable").
missing_libs() {
  ldd "$src_dir/UmJoonSIC/UmJoonSIC" 2>/dev/null | awk '/not found/ {print $1}'
  has_lib libGL.so.1 || echo libGL.so.1
}

missing="$(missing_libs | sort -u | tr '\n' ' ')"
packages=""
for lib in $missing; do
  p="$(package_for "$lib" || true)"
  case " $packages " in *" $p "*) ;; *) [ -n "$p" ] && packages="$packages $p" ;; esac
done
font_missing=0
if ! command -v fc-list >/dev/null 2>&1; then
  # Without fontconfig's tools, whether a Korean font exists is unknown: install both.
  font_missing=1
  if [ -n "$pm" ]; then packages="$packages fontconfig"; fi
elif [ -z "$(fc-list :lang=ko family 2>/dev/null | head -n 1)" ]; then
  font_missing=1
fi
if [ "$font_missing" -eq 1 ]; then
  font_package="$(korean_font_package || true)"
  [ -n "$font_package" ] && packages="$packages $font_package"
fi
packages="${packages# }"

if [ -n "$missing" ] || [ "$font_missing" -eq 1 ]; then
  [ -n "$missing" ] && say "Missing libraries: $missing"
  [ "$font_missing" -eq 1 ] && say "No Korean font found (the Korean menus would show boxes)."
  if [ -n "$packages" ] && ask "Install them with $pm now ($packages)?"; then
    install_ok=1
    # The package lists are split into words on purpose.
    # shellcheck disable=SC2086
    case "$pm" in
      apt-get)
        # Debian 13 and Ubuntu 24.04 renamed some library packages (…t64).
        as_root apt-get update -qq || install_ok=0
        resolved=""
        for p in $packages; do
          if apt-cache show "${p}t64" >/dev/null 2>&1; then resolved="$resolved ${p}t64"; else resolved="$resolved $p"; fi
        done
        as_root env DEBIAN_FRONTEND=noninteractive apt-get install -y -q $resolved || install_ok=0
        ;;
      dnf | yum) as_root "$pm" install -y $packages || install_ok=0 ;;
      zypper) as_root zypper --non-interactive install $packages || install_ok=0 ;;
      pacman) as_root pacman -S --needed --noconfirm $packages || install_ok=0 ;;
    esac
    [ "$install_ok" -eq 1 ] || warn "installing the packages did not fully succeed"
    missing="$(missing_libs | sort -u | tr '\n' ' ')"
    [ -z "$missing" ] || warn "still missing: $missing (the app may not start)"
  elif [ -n "$missing" ]; then
    warn "the app may not start until these are installed${packages:+ (packages: $packages)}"
  fi
fi

if command -v pgrep >/dev/null 2>&1 && pgrep -f "$app_dir/UmJoonSIC" >/dev/null 2>&1; then
  die "UmJoonSIC is running from $app_dir: close it, then run the installer again"
fi

say "Installing UmJoonSIC $VERSION into $app_dir ..."
mkdir -p "$(dirname "$app_dir")" "$bin_dir" "$desktop_dir"
rm -rf "$app_dir.new"
cp -a "$src_dir/UmJoonSIC" "$app_dir.new"
[ -f "$src_dir/$ID.png" ] && cp "$src_dir/$ID.png" "$app_dir.new/$ID.png"
# A copy of this installer stays with the app: it removes it later, also after the extracted
# folder (or the downloaded temporary copy) is gone.
cp "$src_dir/install.sh" "$app_dir.new/install.sh"
chmod 755 "$app_dir.new/install.sh"
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
  if case ",$(findmnt -no OPTIONS -T "$app_dir" 2>/dev/null)," in *,nosuid,*) true ;; *) false ;; esac then
    say "$app_dir is on a nosuid file system, where the sandbox helper cannot work. The app will start"
    say "without Chromium's sandbox; to have it, install for all users instead: sudo $0 --system"
  elif command -v sudo >/dev/null 2>&1 && ask "Set up the sandbox helper with sudo now (recommended)?"; then
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
# Without the system's OpenGL library, Chromium's GPU process cannot start: render in software.
has_gl() {
  local dir
  { ldconfig -p 2>/dev/null || /sbin/ldconfig -p 2>/dev/null; } | grep -qE '[[:space:]]libGL\.so\.1[[:space:]]' && return 0
  for dir in /usr/lib/x86_64-linux-gnu /usr/lib64 /usr/lib /lib64 /lib/x86_64-linux-gnu; do
    [ -e "$dir/libGL.so.1" ] && return 0
  done
  return 1
}
if [ -n "${UMJOONSIC_DISABLE_GPU:-}" ] || ! has_gl; then args+=(--disable-gpu); fi

# Chromium's sandbox: a setuid-root helper, or unprivileged user namespaces. Without either
# (and as root, where Chromium refuses it), the app runs with --no-sandbox.
sandbox_ok() {
  [ "$(id -u)" -ne 0 ] || return 1
  local helper="$APP_DIR/chrome-sandbox"
  if [ -u "$helper" ] && [ "$(stat -c %u "$helper" 2>/dev/null)" = 0 ]; then
    # A setuid helper on a nosuid file system (some /home setups) cannot work.
    case ",$(findmnt -no OPTIONS -T "$helper" 2>/dev/null)," in *,nosuid,*) ;; *) return 0 ;; esac
  fi
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
  say "  Remove it with: sudo $app_dir/install.sh --uninstall --system"
else
  say "  Remove it with: $app_dir/install.sh --uninstall"
fi
