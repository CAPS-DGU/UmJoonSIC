# UmJoonSIC 앱 (Electron)

엄준SIC의 데스크톱 앱입니다. Electron 메인 프로세스가 Java 시뮬레이터(`../simulator`)를 실행하고, React 렌더러가 HTTP로 시뮬레이터와 통신합니다.

## 명령어

```sh
pnpm install          # 의존성 설치
pnpm dev              # 개발 실행 (HMR, DevTools)
pnpm typecheck        # 타입 검사 (src, electron, shared)
pnpm lint             # ESLint
pnpm format           # Prettier 로 파일 정리 (format:check 는 검사만)
pnpm test             # 단위 테스트 (vitest)
pnpm build            # 타입 검사 + 빌드 (dist/)
pnpm package          # 실행 파일 묶음 (out/UmJoonSIC-<플랫폼>-<arch>/)
pnpm make             # electron-forge 설치 파일
```

Node.js 22, pnpm 10 기준입니다.

- Windows 설치 파일은 `pnpm package` 결과를 `../win-installer/inno-setup.iss` (Inno Setup) 로 묶어 만듭니다. `.sic` 파일 연결은 이 설치 파일이 등록합니다. `pnpm make` 의 Squirrel 설치 파일은 연결을 등록하지 않습니다.

## 실행 구조

```
┌ main process (electron/) ────────────────┐      ┌ simulator (Java, 127.0.0.1:9090) ┐
│ 창 생성, 메뉴, 파일 입출력(IPC),           │ 실행 │ /begin /load /step /memory        │
│ JRE·simulator.jar 준비와 프로세스 관리      ├─────▶│ /syntax-check                    │
└───────────────▲──────────────────────────┘      └──────────────▲───────────────────┘
                │ window.api (preload.ts)                        │ HTTP (src/api/simulator.ts)
┌ renderer (src/) ───────────────────────────────────────────────┴───────────────────┐
│ React + zustand + Monaco                                                            │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

- 렌더러는 파일 시스템에 직접 접근하지 않습니다. `window.api`(IPC)를 거칩니다.
- `window.api`의 모양과 IPC 채널·이벤트 이름은 `shared/ipc.ts` 한 곳에 있습니다.
- 시뮬레이터 포트 9090은 `electron/simulator/paths.ts`와 `src/api/simulator.ts` 두 곳에 있습니다.
- 시뮬레이터 프로세스는 `electron/simulator/process.ts` 한 곳에서 시작·재시작·종료합니다. 렌더러의 요청은 시뮬레이터가 준비될 때까지 기다립니다 (`window.api.waitForSimulator`).
- 앱이 인터넷에 접속하는 것은 새 버전 확인과 JRE·simulator.jar 내려받기뿐입니다. Monaco, 글꼴, 이미지는 앱에 들어 있습니다.

## 폴더

```
shared/ipc.ts            main · preload · renderer 가 공유하는 타입과 채널 이름

electron/
  main.ts                앱 생명주기 (단일 인스턴스, 시작 순서, 종료)
  menu.ts                메뉴 (화면 언어로 다시 만듦)
  i18n.ts                메인 프로세스의 글 (메뉴, 확인 창, 내려받기 창, 시작 오류): 영어·한국어
  preferences.ts         화면 언어·테마 설정(userData/ui-preferences.json), 최근 프로젝트
  preload.ts             window.api 노출, main→renderer 메시지를 DOM 이벤트로 전달
  appUpdate.ts           새 버전 확인
  paths.ts               빌드 결과물 경로
  windows/               mainWindow, splashWindow, aboutWindow
  ipc/                   window.api 요청 처리: project, files, server, window(창 닫기와 저장 확인), preferences
  project/               project.sic 읽기·생성(projectFiles), 외부에서 연 프로젝트 경로 큐(openQueue)
  simulator/             JRE(jre), simulator.jar(jar), 다운로드(download), 프로세스(process), 경로(paths)

src/
  App.tsx                화면 배치
  api/                   시뮬레이터 HTTP 클라이언트와 요청·응답 타입
  components/            앱 전체에서 쓰는 컴포넌트 (ui/ 는 shadcn 기본 컴포넌트), AppDialog, Toasts, StatusBar
  i18n/                  화면의 글 (strings.ts: 영어·한국어), 어셈블러 메시지 번역
  features/
    project/             프로젝트 열기·닫기, project.sic 설정 화면, 시작 화면
    fileTree/            왼쪽 파일 트리
    editor/              Monaco 에디터(파일마다 모델 하나), 탭, 저장 확인, 자동 열 맞춤, 구문 검사
    listing/             실행 중 표시되는 리스팅 탭
    debugger/            실행 제어(runningStore), 도구 모음, 실행 간격, 레지스터, 메모리 뷰어
    panel/               아래 패널: 변수 / 오류 / 시뮬레이터
  lib/, types/           여러 기능이 함께 쓰는 유틸, 전역 타입
  stores/                화면 설정(preferencesStore), 확인 창(dialogStore), 알림(toastStore)

public/                  splash.html, progress.html, about.html (창에서 직접 불러오는 정적 파일)
```

## 규칙

- 파일 이름: 컴포넌트 `PascalCase.tsx`, 훅 `useXxx.ts`, 그 외 `camelCase.ts`.
- 렌더러(`src/`)의 import 는 `@/…`(src), `@shared/…`(shared) 별칭을 씁니다. `electron/` 에는 별칭이 없으므로 상대 경로(`../shared/ipc`)를 씁니다.
- 기능 폴더 안에 그 기능의 컴포넌트·스토어·훅을 함께 둡니다.
- 시뮬레이터 호출은 `src/api/simulator.ts`, 파일 작업은 `window.api`만 사용합니다.
- 단위 테스트는 대상 파일 옆에 `*.test.ts` 로 둡니다 (`src/`, 그리고 Electron API 를 쓰지 않는 `electron/` 모듈).
- Tailwind 는 `src/` 와 `index.html` 의 모든 글자에서 클래스 이름을 찾습니다. 주석에 `visible`, `hidden`, `resize` 같은 클래스 이름을 단어 그대로 쓰면 그 클래스가 CSS 에 들어갑니다 (Monaco 가 쓰는 `.visible` 처럼 화면이 달라질 수 있음).
- 커밋 전에 `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test` 가 통과해야 합니다.

## 화면 배치

- 세 열(파일 목록 | 에디터 | 실행 패널)과 아래 패널의 크기는 `src/features/layout/columns.ts` 에 있습니다. 최소값은 측정해서 정했습니다 (작업 공간의 `documentations/08_layout`): 파일 목록 180 px, 실행 패널 296 px(SIC/XE 의 다섯 자리 주소와 8바이트 열, 스크롤 막대까지), 에디터 320 px. 정한 크기는 localStorage(`umjoonsic.layout`)에 남습니다.
- 경계는 `src/components/Splitter.tsx` 하나로 만듭니다(끌기, 키보드, 두 번 클릭).
- 크기 단계: 위쪽 막대 40 px, 패널 머리 막대 32 px, 막대와 입력 칸의 컨트롤 28 px, 패널 머리와 줄 안의 작은 버튼 24 px, 대화상자 36 px (`src/lib/controls.ts`). 새 컨트롤은 이 상수를 씁니다.
- 글꼴은 `font-sans`(Pretendard)와 `font-mono`(JetBrains Mono) 둘뿐이고, 둘 다 앱에 들어 있습니다 (`src/index.css` 의 `@theme`). 글자 크기는 12 / 14 / 16 / 24 px, 패널 안은 14 px.
- 스크롤 막대: 목록과 패널은 `slim-scroll`(8 px), 탭 줄은 `no-scrollbar`.
- 대화상자는 `src/components/ui/dialog.tsx` 로 만듭니다(Esc, 바깥 클릭, 포커스).
- 메모리 뷰어의 너비는 `ch` 단위입니다 (`src/features/debugger/memory/gridLayout.ts`). 실행 패널은 높이가 고정(`h-full`)이어야 합니다. 높이가 열리면 메모리 뷰어가 4096 줄을 모두 그립니다.
- 시험용 표시: `data-column`(세 열), `data-memory-row`(메모리 한 줄), `data-tab-path`(탭), `data-statusbar`, `data-run-state`(실행 상태: ready, load-failed, assembling, running, paused, breakpoint, halted), `data-register`(레지스터 한 칸).

## 알아 둘 점

- 저장하지 않은 변경: 수정한 탭, 프로젝트, 창을 닫거나 앱을 끝낼 때 저장 / 저장 안 함 / 취소를 묻습니다 (`src/features/editor/unsavedChanges.ts`). 창 닫기는 메인 프로세스가 붙잡아 두었다가 렌더러가 답하면 닫습니다 (`electron/windows/mainWindow.ts`).
- 자동 열 맞춤(`src/features/editor/lib/autoIndentLine.ts`)은 입력 한 번마다 실행되므로, 바꿀 때는 `autoIndentLine.test.ts` 와 함께 확인하세요.
- 실행 제어는 `src/features/debugger/runningStore.ts` 에 있습니다. 상태는 준비 → 실행 중 → 멈춤 → 종료이고, 상태 표시줄에 늘 보입니다. 중단점은 그 줄을 실행하기 전에 멈춥니다.
  - 실행(Run) 메뉴와 단축키: 실행·계속 F5, 일시 중지 F6, 한 단계 F10, 처음부터 다시 Ctrl+Shift+F5, 중지 Shift+F5.
  - 실행 간격(명령어 사이의 시간)은 도구 모음의 목록과 실행 메뉴에서 고르며, 실행 중에도 바로 적용됩니다. 기본 100 ms. 20 ms 보다 짧으면 화면을 덜 자주 그립니다(레지스터 50 ms, 메모리·변수 250 ms 마다). 시뮬레이터는 바꾸지 않았습니다.
  - 프로그램이 끝나면(halt) 창을 띄우지 않습니다. 레지스터, 메모리, 변수, 리스팅은 마지막 상태로 남고, 리스팅에 끝난 줄이 표시되며, 시뮬레이터 패널에 한 줄이 남습니다. 중지(Shift+F5)해야 실행이 닫힙니다.
  - 실행 전에 project.sic 의 파일과 장치 파일이 있는지 확인하고, 프로그램이 쓰는 장치가 파일에 연결되어 있지 않으면 알립니다.
- `project.sic` 는 JSON 입니다: `asm`(프로젝트 기준 경로), `main`(확장자 없는 이름), `filedevices`, `mode`(`"SIC"` 또는 `"SICXE"`, 없으면 SIC). 모드를 바꾸면 `mode` 만 바로 저장되고, 설정 화면의 저장하지 않은 편집은 그대로 남습니다.
- 실행 간격은 프로젝트가 아니라 앱의 설정이라 렌더러의 localStorage(`umjoonsic.runInterval`)에 둡니다.
- 메시지는 세 가지뿐입니다: 묻거나 오류를 알리는 창(`src/stores/dialogStore.ts` 의 `ask`, `showError` → `AppDialog`), 잠깐 보이는 알림(`toastStore` 의 `notify` → `Toasts`), 입력 칸 아래의 오류. 운영체제의 메시지 창은 시작 오류와 파일 선택 창에만 씁니다.
- 에디터에서 Tab 은 다음 열로 갑니다. 키보드로 에디터를 나가려면 Ctrl+M(macOS 는 Ctrl+Shift+M)으로 Monaco 의 "Tab 으로 포커스 이동"을 켭니다 (VS Code 와 같음). 그래서 Windows·Linux 의 창 최소화에는 단축키가 없습니다.
- 탭: 끌어서 순서를 바꾸고, Ctrl+PageDown / Ctrl+PageUp 으로 옮겨 가며, Ctrl+Shift+PageDown / Ctrl+Shift+PageUp 으로 자리를 옮깁니다 (File 메뉴). macOS 에서도 Ctrl 입니다 (Cmd+PageDown 은 에디터의 스크롤).
- 스플래시는 시작이 끝날 때까지의 창입니다. 닫으면 시작을 취소하고 앱이 끝납니다 (`electron/main.ts`).

## 화면 언어와 테마

- 영어와 한국어 두 가지입니다. 처음에는 운영체제의 언어를 따르고, 상태 표시줄이나 보기(View) 메뉴에서 바꿉니다. 테마(밝게 / 어둡게)도 같습니다. 설정은 `userData/ui-preferences.json` 에 있고(`electron/preferences.ts`), 첫 화면부터 그 언어로 그리도록 preload 가 시작할 때 읽어 둡니다.
- 렌더러의 글은 `src/i18n/strings.ts`, 메인 프로세스의 글은 `electron/i18n.ts` 에 있습니다. 두 언어의 키가 같아야 하며, 빠진 번역은 타입 오류가 됩니다. 화면에 보이는 글을 코드에 바로 쓰지 마세요.
- 영어 모드는 모두 영어입니다. 언어 선택에서만 각 언어를 그 언어로 씁니다(English / 한국어).
- 어셈블러·링커 메시지는 SicTools 가 영어로 냅니다. 한국어 모드에서는 알려진 메시지를 `src/i18n/assemblerMessages.ts` 가 옮깁니다(모르는 메시지는 그대로).
- 어두운 테마는 `src/index.css` 의 `.dark` 에서 Tailwind 색(`gray-*`, `blue-*`, …)의 값을 바꿔서 만듭니다. 클래스마다 `dark:` 를 붙이지 않습니다. 새 색을 쓰면 `.dark` 에도 값이 있는지 확인하세요. Monaco 는 `vs` / `vs-dark` 테마를 씁니다.

## 한국어 모드의 용어

교재(Beck, _System Software_; 번역본 유원희·이필규·김유성 공역, 홍릉과학출판사)와 수업, 시험에서 학생이 만나는 말을 씁니다.

- 니모닉(LDA, JSUB …), 지시어(START, BYTE, EXTDEF …), 레지스터 이름(A, X, L, B, S, T, F, PC, SW), 레코드 문자(H, T, E, M, D, R), SYMTAB·OPTAB·LOCCTR, nixbpe 는 옮기지 않습니다.
- 약어는 약어를 먼저, 뜻을 괄호에: PC(프로그램 카운터), SYMTAB(기호 테이블).
- 한국어 용어에는 영어를 한 번은 붙입니다(툴팁이나 메시지): 기호(symbol), 중단점(breakpoint).
- 한 개념에는 한 가지 말만 씁니다. 에러가 아니라 오류.

| 영어                        | 한국어 모드            | 영어                 | 한국어 모드          |
| --------------------------- | ---------------------- | -------------------- | -------------------- |
| assembler / linker / loader | 어셈블러 / 링커 / 로더 | symbol               | 기호(symbol)         |
| instruction                 | 명령어                 | label                | 레이블               |
| mnemonic                    | 니모닉                 | operand              | 피연산자             |
| directive                   | 어셈블러 지시어        | object code          | 목적 코드            |
| listing                     | 리스팅                 | location counter     | 위치 카운터 (LOCCTR) |
| control section             | 제어 섹션              | addressing mode      | 주소 지정 방식       |
| accumulator (A)             | 누산기                 | index register (X)   | 인덱스 레지스터      |
| linkage register (L)        | 연결 레지스터          | base register (B)    | 베이스 레지스터      |
| status word (SW)            | 상태 워드              | program counter (PC) | 프로그램 카운터      |
| breakpoint                  | 중단점                 | step                 | 한 단계              |
| pause / stop                | 일시 중지 / 중지       | halt (program end)   | 종료                 |
| memory / register           | 메모리 / 레지스터      | device               | 장치                 |
