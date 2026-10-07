# UmJoonSIC developer documentation

This document is for people who build, change or release UmJoonSIC. It is always written in English. The user-facing READMEs are [README.md](../README.md) (Korean) and [README.en.md](../README.en.md).

- [Repository layout](#repository-layout)
- [Requirements](#requirements)
- [Frontend (Electron app)](#frontend-electron-app)
- [Backend (Java simulator)](#backend-java-simulator)
- [How the app runs](#how-the-app-runs)
- [Source layout](#source-layout)
- [Conventions](#conventions)
- [Screen layout rules](#screen-layout-rules)
- [Behaviour reference](#behaviour-reference)
- [Interface language, theme and Korean wording](#interface-language-theme-and-korean-wording)
- [Testing](#testing)
- [Building and releasing](#building-and-releasing)

## Repository layout

```
app/              the desktop app: Electron main process, React renderer (this is where most work happens)
simulator/        the Java backend: SicTools (as a Git subtree) wrapped in a Spark HTTP server
linux-installer/  install.sh and pack.sh: the Linux x64 release archive and its installer
win-installer/    inno-setup.iss: the Windows installer (Inno Setup)
docs/             this document, patch notes (docs/patch-notes/)
images/           icon and splash sources
```

## Requirements

- Node.js 22 and pnpm 10 for the app (`npm install -g pnpm`).
- JDK 17 to build or run the simulator yourself. The app does not need a JDK on the user's machine: it downloads its own Java runtime at its first start.
- The Gradle wrapper (`simulator/gradlew`) is included; IntelliJ IDEA can open `simulator/` directly.

## Frontend (Electron app)

All commands run in `app/`:

```sh
pnpm install          # dependencies
pnpm dev              # development run (hot reload, DevTools)
pnpm typecheck        # type check (src, electron, shared)
pnpm lint             # ESLint
pnpm format           # Prettier writes the files (format:check only checks)
pnpm test             # unit tests (vitest)
pnpm build            # type check + build (dist/)
pnpm package          # the runnable app (out/UmJoonSIC-<platform>-<arch>/)
pnpm make             # electron-forge installers
```

`typecheck`, `lint`, `format:check` and `test` must pass before a commit.

Prettier keeps the style consistent. With VS Code, install the Prettier extension and add to `.vscode/settings.json`:

```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true
}
```

To test opening a file from outside the app (what a double-click does), pass its path: `pnpm exec electron-vite dev -- /path/to/file.asm` (or a `project.sic`). Do not use `pnpm dev -- path`: pnpm removes the `--`, and electron-vite then takes the path as its project folder. A packaged app takes the path directly (`UmJoonSIC /path/to/file.asm`). If the app is already running, the same command hands the file to the open window and exits.

## Backend (Java simulator)

```bash
cd simulator
./gradlew run --stacktrace         # run and debug (IntelliJ shows this as a run configuration)
./gradlew clean shadowJar          # build/libs/simulator-all.jar, the single jar for a release
java -jar build/libs/simulator-all.jar 9091    # run on another port (default 9090)
```

The simulator listens on `127.0.0.1:<port>` (first argument, default 9090). Its HTTP API is documented at the top of `simulator/src/main/java/com/sicserver/Main.java`:

| Route | Purpose |
|---|---|
| `POST /begin` | start a simulation: machine type (`sic` / `sicxe`) and file devices |
| `POST /load` | assemble, link and load files from disk; returns listings, errors and registers |
| `POST /syntax-check` | assemble in-memory texts without linking; returns errors only |
| `POST /step` | execute one instruction |
| `POST /memory` | read memory |

The backend is SicTools by jurem (BSD-2-Clause), extended to cover pure SIC as well as SIC/XE and to report error positions accurately. Changes there should stay small: the app works around simulator behaviour in the frontend where it can (see [Behaviour reference](#behaviour-reference)).

## How the app runs

```
┌ main process (electron/) ─────────────────┐       ┌ simulator (Java, 127.0.0.1:<port>) ┐
│ windows, menu, file I/O (IPC),            │ start │ /begin /load /step /memory          │
│ Java runtime and simulator.jar, process   ├──────▶│ /syntax-check                       │
└───────────────▲───────────────────────────┘       └──────────────▲──────────────────────┘
                │ window.api (preload.ts)                          │ HTTP (src/api/simulator.ts)
┌ renderer (src/) ─────────────────────────────────────────────────┴──────────────────────┐
│ React + zustand + Monaco                                                                  │
└───────────────────────────────────────────────────────────────────────────────────────────┘
```

- The renderer never touches the file system: it goes through `window.api` (IPC). The shape of `window.api` and the IPC channel and event names are all in `shared/ipc.ts`.
- The simulator port is a preference (default 9090, `electron/simulator/paths.ts`), read once when the app starts. The renderer gets it from `window.api.waitForSimulator()`; the page's content security policy allows `http://127.0.0.1:*`.
- The simulator process is started, restarted and stopped in one place: `electron/simulator/process.ts`. Renderer requests wait until the simulator is ready.
- The app goes online for three things only: the new-version check, the Java runtime and `simulator.jar`. Monaco, fonts and images are bundled.

**First start.** The splash shows the progress at its bottom right while the app downloads:

1. the Java runtime, Eclipse Temurin 17.0.16+8 (one archive per platform, pinned in `electron/simulator/jre.ts`), only when it is missing;
2. `simulator.jar`, from the GitHub release tagged with the app's own version (`v<version>`). There is no fallback to another release for this first download.

Then, at every start, `checkJARUpdate` (`electron/simulator/jar.ts`) compares the jar on disk with `simulator-hash.txt` of the app's own release. It falls back to the latest release only when its own release cannot be read or lacks one of the two files. If the hashes differ, the jar is downloaded again. Without network, the jar on disk is kept.

**Data folders.**

| | Java runtime and `simulator.jar` | Electron settings (`ui-preferences.json`, recent projects) |
|---|---|---|
| Linux | `~/.config/umjoonsic` | `~/.config/UmJoonSIC` |
| Windows | `%APPDATA%\umjoonsic` | the same folder (the file system ignores case) |
| macOS | `~/Library/Application Support/umjoonsic` | the same folder |

## Source layout

```
shared/ipc.ts            types and channel names shared by main, preload and renderer

electron/
  main.ts                app lifecycle (single instance, start-up order, quit)
  menu.ts                the menu (rebuilt in the interface language)
  i18n.ts                main-process texts (menu, dialogs, splash, start errors): English and Korean
  preferences.ts         preferences (userData/ui-preferences.json), recent projects
  preload.ts             exposes window.api; forwards main→renderer messages as DOM events
  appUpdate.ts           new-version check
  paths.ts               build output paths
  windows/               mainWindow, splashWindow (and its progress text), aboutWindow
  ipc/                   window.api handlers: project, files, server, window (closing, save prompts), preferences
  project/               reading and creating project.sic (projectFiles), files opened from outside
                         (openQueue) and the project near them (nearbyProject)
  simulator/             Java runtime (jre), simulator.jar (jar), downloads (download), process, paths

src/
  App.tsx                screen layout
  api/                   simulator HTTP client, request and response types
  components/            app-wide components (ui/ holds the shadcn base components), AppDialog, Toasts, StatusBar
  i18n/                  interface texts (strings.ts: English and Korean), assembler message translations
  features/
    project/             open/close projects, the project settings screen (assembly order, device table), welcome screen
    fileTree/            the file tree (the project is its root)
    devices/             Devices panel (bytes the program read and wrote); devices and sections found in the source
    editor/              Monaco editor (one model per file), tabs, save prompts, column layout, syntax check
    listing/             the listing tab (one per run, a small tab per file) and navigation to and from it
    debugger/            run control (runningStore), toolbar, run interval, registers, memory viewer, "Last write"
    panel/               bottom panel: Watch / Devices / Errors / Simulator
    preferences/         the Preferences dialog
  lib/, types/           utilities and global types used by several features
  stores/                preferences (preferencesStore), dialogs (dialogStore), notifications (toastStore)

public/                  splash.html, progress.html, about.html (static pages loaded by windows)
```

## Conventions

- File names: components `PascalCase.tsx`, hooks `useXxx.ts`, everything else `camelCase.ts`.
- Imports in the renderer (`src/`) use the aliases `@/…` (src) and `@shared/…` (shared). `electron/` has no aliases: use relative paths (`../shared/ipc`).
- A feature folder holds that feature's components, stores and hooks together.
- Simulator calls go through `src/api/simulator.ts` only; file operations through `window.api` only.
- Unit tests sit next to the file they test, as `*.test.ts` (in `src/`, and in `electron/` modules that do not use the Electron API).
- Tailwind scans every word in `src/` and `index.html` for class names. A comment that contains a class name as a word (`visible`, `hidden`, `resize`) puts that class into the CSS, which can change the screen (Monaco uses `.visible`, for example).
- Interface texts never go into code directly: they live in `src/i18n/strings.ts` (renderer) and `electron/i18n.ts` (main process).

## Screen layout rules

- The three columns (files | editor | run panel) and the bottom panel are sized in `src/features/layout/columns.ts`. The minimums were measured: file list 180 px, run panel 296 px (five-digit SIC/XE addresses, eight byte columns and the scroll bar), editor 320 px. The sizes a user sets are kept in localStorage (`umjoonsic.layout`).
- Every splitter is `src/components/Splitter.tsx` (drag, keyboard, double-click).
- Size steps (`src/lib/controls.ts`): top bar 40 px, panel header 32 px, controls in bars and input fields 28 px, small buttons in headers and rows 24 px, dialog buttons 36 px. New controls use these constants.
- Two fonts only, both bundled: `font-sans` (Pretendard) and `font-mono` (JetBrains Mono) (`@theme` in `src/index.css`). Text sizes 12 / 14 / 16 / 24 px; 14 px inside panels. The editor's code font size is a preference (10–28 px, default 12); the listing follows it (+2 px).
- Scroll bars: `slim-scroll` (8 px) in lists and panels, `no-scrollbar` in tab strips.
- Dialogs are built with `src/components/ui/dialog.tsx` (Esc, click outside, focus).
- The memory viewer is sized in `ch` (`src/features/debugger/memory/gridLayout.ts`). The run panel must have a fixed height (`h-full`): with an open height, the memory viewer draws all 4096 rows.
- Test hooks in the DOM: `data-column` (the three columns), `data-memory-row`, `data-memory-address`, `data-memory-underline` / `data-memory-label` (variable underline and name), `data-last-write`, `data-tab-path`, `data-statusbar`, `data-run-state` (ready, load-failed, assembling, running, paused, breakpoint, halted), `data-register`, `data-project-root`, `data-assembly-order`, `data-asm-file` / `data-asm-handle`, `data-device-table` / `data-device-row` / `data-device-add-row`, `data-device` / `data-stream-box`, `data-tab-dot`, `data-new-file-option`, `data-outside-tab` / `data-outside-banner`, `data-no-project`, `data-listing-file` / `data-listing-row`, `data-symbol`, `data-watch-row`, `data-preferences`.

## Behaviour reference

### Running and debugging

- Run control is `src/features/debugger/runningStore.ts`. The states are ready → running → paused → halted, always shown in the status bar. A breakpoint stops before its line runs.
- Run menu and keys: run / continue F5, pause F6, step F10, restart Ctrl+Shift+F5, stop Shift+F5.
- The run interval (time between instructions) is chosen in the toolbar list, the Run menu or Preferences, and applies at once, also while running. Default 250 ms. Below 20 ms the screen is redrawn less often (registers every 50 ms, memory and Watch every 250 ms). The interval is an app setting, kept in the renderer's localStorage (`umjoonsic.runInterval`).
- When the program ends (halt), no dialog appears. Registers, memory, Watch and the listing keep their last state; the listing marks the halting line; the Simulator panel logs a line. Stop (Shift+F5) ends the run.
- Before a run, the files listed in project.sic and the device files are checked. A device the program uses that is not connected to a file is reported; the notification's button creates a new file named after the device's label (`outdev.txt`, for example), connects it and restarts.
- The file of an output-only device (WD but no RD) is emptied when a run starts. The simulator overwrites a file from the start without truncating it, so a short output used to leave the end of the previous run behind (`AB` over `XXXXXX` → `ABXXXX`). The simulator itself is unchanged.
- An unconnected device reads 0, discards what is written, and answers TD with "not ready" (`Device.test()` is false in this SicTools). A textbook `TD` / `JEQ` loop therefore never ends; the Devices panel shows it as "waiting".

### The listing

- A run has one Listing tab, with a small tab per assembled file. The small tab of the file the PC is in has a dot, and the listing follows the PC into other files.
- Closing the Listing tab during a run asks first, then stops the run: a run needs its listing.
- Ways in and out (`src/features/listing/navigate.ts`): double-click a row → its source line; click a symbol in an operand → the row that defines it (each name of `EXTDEF PRTNUM,PUTCH` is its own link); "Show in Listing" in the editor's context menu; click "Paused at …" in the status bar → the PC's row; double-click a memory byte during a run → its row; double-click a Watch variable → its row.
- Source and listing rows are matched by their fields (label, operation, operand), counting repeated lines (`listingStore.ts`).
- The column names stay at the top while scrolling. The table fills the listing's width; its columns shrink together in proportion to their content, each down to its content and its name in the interface language, and below that the listing scrolls sideways. A full-line comment wraps inside the table instead of widening it.

### Memory and Watch

- Change marks are shared by the memory viewer, Watch and the Devices panel (`src/lib/changeMarks.ts`). A value changed by a step flashes for 0.6 s and stays tinted and bold until the next step. During a run, values that keep changing stay lit instead of restarting the flash (no more than three flashes a second). No marks below a 20 ms interval. With the system's "reduce motion", memory cells do not grow.
- In Watch, a changed variable's whole row is marked. Double-click: during a run, the variable's listing row; otherwise its source line. The memory viewer scrolls to the variable if it is not shown. Arrays appear as `NAME[]`.
- The memory viewer's variable underlines and names have their own rows below the values (value 17 px, underline 3 px, name 12 px; `gridLayout.ts`), placed with CSS grid. Avoid `calc()` with products and sums inside a subtraction: Chromium once simplified one wrongly and an underline came out one cell short.
- "Last write" (`src/features/debugger/lastWrite.ts`) scrolls memory to the bytes the last store instruction wrote (STA, STX, STL, STCH, STB, STS, STF, STT, STSW). The address is decoded from the listing's object code and the registers before the step: SIC 15-bit addresses; SIC/XE format 3 with PC-relative, base-relative and indexed addressing; format 4; an indirect store reads its pointer when clicked. The simulator is not asked.

### Projects and files

- `project.sic` is JSON: `asm` (paths relative to the project, in assembly order), `main` (the START or CSECT name of the section to run first; used only when several files are linked; case-sensitive), `filedevices`, `mode` (`"SIC"` or `"SICXE"`; SIC if missing).
- The project settings screen writes every change to project.sic at once (no Save button; the main program name is written when its field is left, on Enter or Ctrl+S). Removing an assembled file or disconnecting a device offers Undo in the notification.
- The device table shows the devices found in the source (RD, WD, TD and their BYTE) together with the connected ones. An unconnected device is connected to a new file in one click, or to a project file, a new file, or a file chosen in a dialog (a save dialog for output devices, so a new name can be typed). Device numbers may be written `F1`, `0xF1` or `X'F1'`.
- The file tree's root is the project folder (like a Visual Studio solution). Clicking it opens the project settings; it does not collapse. project.sic is not shown as a file. Assembled files carry their order (1st, 2nd …; 1번째 … in Korean); the main program's badge is filled. The order changes by dragging the handle in settings, Alt+↑ / Alt+↓ or ▲ / ▼ on the handle, or the tree's context menu.
- New File dialog: `.asm` offers "Add to the assembled files" (on by default); `.txt` offers "Connect to device" (with a number).
- Unsaved changes: closing a modified tab, the project, the window, or quitting asks Save / Don't Save / Cancel (`src/features/editor/unsavedChanges.ts`). The main process holds the window's close until the renderer answers (`electron/windows/mainWindow.ts`).
- Files opened from outside (double-click, Open With, command line, a second start; `open-file` on macOS): a `project.sic` opens its project. An `.asm` looks for the nearest `project.sic` in its folder and up to three folders above (`electron/project/nearbyProject.ts`) and opens as follows (`src/features/project/outsideFiles.ts`):

  | Situation | What happens |
  |---|---|
  | No project open, a project.sic nearby | That project opens with the file in a tab. If the file is not assembled, a notification offers "Add to the assembled files". |
  | No project open, no project.sic | The file opens alone, edit only; nothing is written. The left column offers "Create a project here" and "Open a project…"; running asks to create a project. |
  | The file is in the open project | Its tab (with the same notification). |
  | The file is in another project | A question: open that project / edit the file only / cancel. If a program is running, it says the run will be stopped. |
  | The file is in no project | An outside-project tab (absolute path, in italics): edited and saved in place, never assembled. A banner offers "Copy into this project" and "Create a project here". |

  An open project is never closed without asking, and unsaved changes are always asked about when switching projects. "Create a project here" writes `project.sic` next to the file: that one file, `main` = its START name, the machine from its instructions (`+`, `#`, `@` or an SIC/XE-only instruction → SIC/XE). The file is not moved.

### Devices panel

- `src/features/devices/` records RD, WD and TD for every instruction, during a run, without asking the simulator: from the address of the executed instruction, the registers before and after it, and the listing (WD: the last byte of A before; RD: after; TD: the condition code in SW).
- Input devices show their file like a tape (read bytes, the next byte as a block cursor, the remaining bytes, EOF); output devices show the bytes written. Bytes written to an unconnected device appear struck through as "discarded". Text / hex views, copy, the last 64 KiB per device.
- The panel follows new bytes only when scrolled to the end; otherwise a "N new bytes" button appears. The record stays after the run ends or stops, until the next run. When bytes arrive while the tab is hidden, the tab gets a dot; it never switches by itself.

### Editor column layout

The rules are in `src/features/editor/lib/sicxeFormat.ts` (pure functions, no editor); `autoIndentation.ts` connects them to Monaco. They run on every key, so check changes with `sicxeFormat.test.ts`, which includes a typing simulator.

- Columns: label 1, operation 10, operand 18, comment 36 (the rulers mark them). A field that is too long pushes the next one by one space; the field after it returns to its column when it can.
- Fields are read the way the assembler (SicTools) reads them, using its table of operations. A word at column 1 is a label, unless it is an operation and the next word is not (`LDA ZERO` typed at column 1 is an instruction). An indented word is a label when an operation follows it. After an operation without operand (RSUB, LTORG, …) comes the comment. Spaces inside an operand belong to it: inside quotes, next to commas and operators, and in `=WORD 65535`.
- Keys: Space and Tab go to the next column; Shift+Tab to the field before. Space inside quotes, inside a comment, or after a comma is a space. Enter lays the line out and starts the next one at column 10; a label typed there moves to column 1 as soon as its operation follows. Backspace in the spaces before an instruction goes to column 1 (to type a label); in the spaces between fields it goes back to the end of the field before (the spaces are layout, not text).
- A line edited by typing is laid out when the cursor leaves it. A paste of several lines is laid out as a block: line numbers in front of every line (textbook figures) are dropped, and a block indented as a whole is moved left. Format Document / Format Selection lay out the whole file (Shift+Alt+F on Windows and macOS, Ctrl+Shift+I on Linux, or the context menu).
- When a line is laid out, only what the assembler refuses and can mean one thing is corrected: capitals for operations, `C'`/`X'`, `,X` and register names (symbols are case-sensitive and are left alone), no spaces next to commas, and `. ` before a comment that has none (the textbook's fixed format has no dots). No dot is added before what might be data or an operand (`65535`, `- X1`, a quote), or after an unknown operation: those stay as errors instead of being guessed. Tabs become spaces, except inside quotes (a tab in `C'…'` is a byte of the program).
- Keys are handled before Monaco applies them, so fast typing cannot overtake the layout. With a selection, several cursors, or while an input method is composing (Korean), Monaco's own behaviour applies. With the word suggestion open, Tab accepts it.
- These two commits can be reverted together to return to the previous behaviour: "feat(editor): 열 맞춤 다시 만들기 [되돌리기 가능: indent-v2]" and "fix(editor): 열 맞춤 보완 … [되돌리기 가능: indent-v2]".
- In the editor, Tab goes to the next column. To leave the editor with the keyboard, Ctrl+M (Ctrl+Shift+M on macOS) turns on Monaco's "Tab moves focus", as in VS Code. That is why minimising the window has no shortcut on Windows and Linux.

### Other

- Tabs: drag to reorder; Ctrl+PageDown / Ctrl+PageUp switch, Ctrl+Shift+PageDown / Ctrl+Shift+PageUp move a tab (File menu); Ctrl+W closes a tab. Also Ctrl on macOS (Cmd+PageDown scrolls the editor).
- Preferences (File → Preferences…, Ctrl+,, or the status bar's gear): language, theme, run interval and code font size apply at once; the simulator port applies at the next start ("Restart now" relaunches). Values are checked in the main process (font size 10–28, port 1024–65535).
- The splash is the window until start-up is finished; closing it cancels the start and quits (`electron/main.ts`). During a first start it shows the download progress at its bottom right; a failure stays visible for 1.5 s before the error box.
- There are only three kinds of message: a dialog for questions and errors (`ask`, `showError` in `src/stores/dialogStore.ts` → `AppDialog`), a short notification (`notify` in `toastStore` → `Toasts`), and an error under an input field. The system's message boxes are used only for start-up errors and file dialogs.
- The About window shows the app's version from `package.json` (passed to `public/about.html` as a query parameter).

## Interface language, theme and Korean wording

- Two languages, English and Korean. The first start follows the system language; the status bar, the View menu and Preferences change it. Theme (light / dark) likewise. Settings are in `userData/ui-preferences.json` (`electron/preferences.ts`); preload reads them at start so that the first screen is already in that language.
- Renderer texts are in `src/i18n/strings.ts`, main-process texts in `electron/i18n.ts`. Both languages must have the same keys; a missing translation is a type error.
- English mode is English throughout. Only the language choice shows each language in itself (English / 한국어).
- Assembler and linker messages come from SicTools in English. In Korean mode, `src/i18n/assemblerMessages.ts` translates the known ones (unknown ones stay as they are).
- The dark theme redefines Tailwind's colour values (`gray-*`, `blue-*`, …) under `.dark` in `src/index.css`; classes do not carry `dark:` variants. When you use a new colour, check that `.dark` defines it. Monaco uses its `vs` / `vs-dark` themes.

### Korean terminology

The Korean mode uses the words students meet in the textbook (Beck, *System Software*, Korean translation by 유원희·이필규·김유성, 홍릉과학출판사), in class and in exams.

Every English term has three possible Korean forms: the English word as is (Motor), a transliteration (모터), or a translation (전동기). Which one to use is decided by how real Korean software, textbooks and courses actually say it, never by translating word for word. Look it up before adding a term. For example, dark mode is 다크모드 (as in Korean apps), not 어두운 모드; a store instruction is 저장 (as in Korean lecture notes on STA/STCH), so "Last write" is 최근 저장 위치, not 마지막 쓰기. Compound UI nouns are written without a space: 다크모드, 리스트파일, 목적코드.

- Not translated: mnemonics (LDA, JSUB …), directives (START, BYTE, EXTDEF …), register names (A, X, L, B, S, T, F, PC, SW), record letters (H, T, E, M, D, R), SYMTAB, OPTAB, LOCCTR, nixbpe.
- Abbreviations first, meaning in brackets: PC(프로그램 카운터), SYMTAB(기호 테이블).
- A Korean term carries its English once (in a tooltip or message): 기호(symbol), 중단점(breakpoint).
- One word per concept: 오류 (not 에러), 편집기 (not 에디터), 리스트파일 for listing. "use" is `사용하다`; `쓰다` would be confused with WD's "write".
- Style follows the Korean editions of VS Code, Visual Studio and JetBrains IDEs and Microsoft's Korean localization style guide:
  - menus, buttons, tabs, column headers and check boxes are noun phrases (`파일 선택`, `실행 취소`, `열린 파일 없음`);
  - tooltip descriptions, guidance, banners and error messages are `~합니다` sentences with a full stop; questions are `~할까요?`, instructions `~하세요`;
  - one string does not mix sentences and noun phrases, and does not repeat what the screen already shows;
  - particles are attached (`${name}을(를)`, `RD로`, `00을`); after a name whose final consonant is unknown, use `을(를)`, `이(가)`;
  - explanatory brackets are attached (`입력(RD)`); a shortcut gets one space before it (`계속 (F5)`); counts follow the noun (`명령어 42개`).

| English | Korean mode | English | Korean mode |
|---|---|---|---|
| assembler / linker / loader | 어셈블러 / 링커 / 로더 | symbol | 기호(symbol) |
| instruction | 명령어 | label | 레이블 |
| mnemonic | 니모닉 | operand | 피연산자 |
| directive | 어셈블러 지시어 | object code | 목적코드(OBJCODE) |
| listing | 리스트파일 | location counter | 위치 카운터 (LOCCTR) |
| control section | 제어 섹션 | addressing mode | 주소 지정 방식 |
| accumulator (A) | 누산기 | index register (X) | 인덱스 레지스터 |
| linkage register (L) | 연결 레지스터 | base register (B) | 베이스 레지스터 |
| status word (SW) | 상태 워드 | program counter (PC) | 프로그램 카운터 |
| breakpoint | 중단점 | step | 한 단계 |
| pause / stop | 일시 중지 / 중지 | halt (program end) | 종료 |
| memory / register | 메모리 / 레지스터 | device | 장치 |
| light / dark mode | 라이트모드 / 다크모드 | last write (memory) | 최근 저장 위치 |

## Testing

- Unit tests (`pnpm test`, vitest) sit next to their code. They cover the stores, the listing and memory helpers, "Last write" decoding, the device record, and the editor's column layout (including a simulator that types key sequences).
- Before a commit: `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test`.
- The column layout can also be checked against the real assembler: format a file, assemble the original and the formatted version with `java -cp simulator-all.jar sicxe.Asm file.asm`, and compare the `.obj` files. They must be identical.

## Building and releasing

### Version

The version is `version` in `app/package.json`. The About window shows it, the new-version check compares it with the latest GitHub release, and the first start downloads `simulator.jar` from the release tagged `v<version>`. Also set `MyAppVersion` in `win-installer/inno-setup.iss` to the same version.

### The simulator in a release

Every release must carry `simulator.jar` and `simulator-hash.txt`, with exactly these names:

```bash
cd simulator
./gradlew clean shadowJar
cp build/libs/simulator-all.jar simulator.jar
sha256sum simulator.jar | cut -d' ' -f1 > simulator-hash.txt     # 64 hex digits and a newline
```

A new installation downloads the jar from its own version's release, so these files must be in the release before anyone installs that version. The jar is the same for every operating system.

### Linux (x64)

```bash
cd app
pnpm package                        # out/UmJoonSIC-linux-x64/
bash ../linux-installer/pack.sh     # out/release/UmJoonSIC-linux-x64-<version>.tar.gz and install-linux.sh
```

The archive contains the app, `install.sh`, the icon and the licence. `install.sh`:

- installs for the current user without root (`~/.local/share/umjoonsic`, the `umjoonsic` command in `~/.local/bin`, a menu entry), or for all users with `sudo ./install.sh --system` (`/opt/umjoonsic`, `/usr/local/bin`, `/usr/local/share/applications`);
- keeps a copy of itself in the install folder, and removes the app with `--uninstall` (`--purge` also removes the settings and the downloaded Java runtime);
- run on its own (as `install-linux.sh`), downloads the archive of its version from the release first;
- does not register the app for `.asm` files (it would become their default); "Open With" can still choose it;
- checks the system first and adapts to it:
  - glibc: the app's binaries need glibc 2.25 or newer (measured by `pack.sh` from the binaries' symbol versions and written into the installer). That is Debian 10, Ubuntu 18.04, RHEL 8 and newer. musl systems (Alpine) are refused with a clear message;
  - libraries: the ones `ldd` cannot find, and `libGL.so.1`, which Chromium's GPU process loads at run time (without it the app exits with "GPU process isn't usable"). It offers to install them with the system's package manager. apt (Debian, Ubuntu) gets package names, including the `…t64` names of Debian 13 and Ubuntu 24.04. dnf, yum and zypper (Fedora, the RHEL family, openSUSE) get the library names themselves (`libgbm.so.1()(64bit)`). pacman (Arch) gets package names;
  - a Korean font (the Korean menus use the system's fonts), offered with the libraries;
  - `-y` answers every question with yes (for unattended installs).

The launcher it writes decides at every start:

- **Display:** X11, or Xwayland on a Wayland session (the most compatible choice). Native Wayland only when there is no X server. `UMJOONSIC_OZONE=wayland|x11|auto` overrides this.
- **Rendering:** without the system's OpenGL library the app renders in software (`--disable-gpu`); `UMJOONSIC_DISABLE_GPU=1` forces it (for broken graphics drivers).
- **Sandbox:** Chromium's sandbox needs unprivileged user namespaces or a setuid-root `chrome-sandbox`. Some systems restrict the first (Ubuntu 24.04 and later, Debian 10, hardened kernels). There, the installer offers to make `chrome-sandbox` root-owned and setuid with sudo; without that, the launcher starts the app with `--no-sandbox`. A setuid helper on a `nosuid` file system (some `/home` setups) cannot work, so the launcher checks the mount too. A system install always sets the helper up.

`UMJOONSIC_DRY_RUN=1 umjoonsic` prints the command the launcher would run.

### Windows

Package with `pnpm package` on Windows, then build the installer from `win-installer/inno-setup.iss` with Inno Setup. It registers `.sic` and `.asm` as "Open With" choices only, never as their default (other tools open `.asm` too). The Squirrel installer from `pnpm make` registers no file associations.

### macOS

`pnpm make` builds the zip (the DMG maker is commented out in `forge.config.cjs`). Signing and notarisation read `APPLE_ID`, `APPLE_PASSWORD` and `APPLE_TEAM_ID` from the environment. `extendInfo` in `forge.config.cjs` makes the app the owner of `.sic` and an alternate for `.asm`.

### Release checklist

1. Set the version in `app/package.json` and `win-installer/inno-setup.iss`.
2. Run the checks (`pnpm typecheck && pnpm lint && pnpm format:check && pnpm test`) and `pnpm build`.
3. Write the patch notes in `docs/patch-notes/<version>.md` (Korean).
4. Tag `v<version>` on `main` and create the GitHub release with the patch notes.
5. Attach `simulator.jar` and `simulator-hash.txt` first, then the builds for each platform.
6. Mark the release as the latest only when the Windows and macOS builds are attached. Older apps check the latest release at every start and offer its download page.
