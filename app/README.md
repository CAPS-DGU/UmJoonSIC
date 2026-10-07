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

- Windows 설치 파일은 `pnpm package` 결과를 `../win-installer/inno-setup.iss` (Inno Setup) 로 묶어 만듭니다. `.sic` 과 `.asm` 파일 연결은 이 설치 파일이 등록합니다: 둘 다 "연결 프로그램" 목록에만 넣고 기본 프로그램으로 정하지는 않습니다 (`.asm` 은 다른 도구도 씁니다). `pnpm make` 의 Squirrel 설치 파일은 연결을 등록하지 않습니다.
- macOS 는 `forge.config.cjs` 의 `extendInfo` 로 `.sic` 의 주인(Owner), `.asm` 의 다른 선택지(Alternate)로 등록합니다. Linux 패키지(deb, rpm)는 `.asm` 의 MIME 형식을 등록하지 않습니다: 등록하면 freedesktop 규칙상 `.asm` 의 기본 프로그램이 될 수 있습니다.
- 밖에서 파일을 연 것처럼 시험하려면 경로를 넘깁니다: `pnpm exec electron-vite dev -- /경로/파일.asm` (또는 `project.sic`; `pnpm dev -- 경로` 는 pnpm 이 `--` 를 지워 electron-vite 가 경로를 프로젝트 폴더로 받습니다). 묶은 앱은 `UmJoonSIC /경로/파일.asm`. 앱이 떠 있으면 같은 명령이 두 번째 실행으로 그 창에 파일을 넘깁니다.

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
  project/               project.sic 읽기·생성(projectFiles), 밖에서 연 파일의 큐(openQueue)와 그 근처의 프로젝트(nearbyProject)
  simulator/             JRE(jre), simulator.jar(jar), 다운로드(download), 프로세스(process), 경로(paths)

src/
  App.tsx                화면 배치
  api/                   시뮬레이터 HTTP 클라이언트와 요청·응답 타입
  components/            앱 전체에서 쓰는 컴포넌트 (ui/ 는 shadcn 기본 컴포넌트), AppDialog, Toasts, StatusBar
  i18n/                  화면의 글 (strings.ts: 영어·한국어), 어셈블러 메시지 번역
  features/
    project/             프로젝트 열기·닫기, project.sic 설정 화면(어셈블 순서, 장치 표), 시작 화면
    fileTree/            왼쪽 파일 트리 (프로젝트가 뿌리)
    devices/             장치 패널(프로그램이 읽고 쓴 바이트), 소스에서 장치·제어 섹션 읽기
    editor/              Monaco 편집기(파일마다 모델 하나), 탭, 저장 확인, 자동 열 맞춤, 구문 검사
    listing/             실행 중 표시되는 리스트파일 탭
    debugger/            실행 제어(runningStore), 도구 모음, 실행 간격, 레지스터, 메모리 뷰어
    panel/               아래 패널: 변수 / 장치 / 오류 / 시뮬레이터
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

- 세 열(파일 목록 | 편집기 | 실행 패널)과 아래 패널의 크기는 `src/features/layout/columns.ts` 에 있습니다. 최소값은 측정해서 정했습니다 (작업 공간의 `documentations/08_layout`): 파일 목록 180 px, 실행 패널 296 px(SIC/XE 의 다섯 자리 주소와 8바이트 열, 스크롤 막대까지), 편집기 320 px. 정한 크기는 localStorage(`umjoonsic.layout`)에 남습니다.
- 경계는 `src/components/Splitter.tsx` 하나로 만듭니다(끌기, 키보드, 두 번 클릭).
- 크기 단계: 위쪽 막대 40 px, 패널 머리 막대 32 px, 막대와 입력 칸의 컨트롤 28 px, 패널 머리와 줄 안의 작은 버튼 24 px, 대화상자 36 px (`src/lib/controls.ts`). 새 컨트롤은 이 상수를 씁니다.
- 글꼴은 `font-sans`(Pretendard)와 `font-mono`(JetBrains Mono) 둘뿐이고, 둘 다 앱에 들어 있습니다 (`src/index.css` 의 `@theme`). 글자 크기는 12 / 14 / 16 / 24 px, 패널 안은 14 px.
- 스크롤 막대: 목록과 패널은 `slim-scroll`(8 px), 탭 줄은 `no-scrollbar`.
- 대화상자는 `src/components/ui/dialog.tsx` 로 만듭니다(Esc, 바깥 클릭, 포커스).
- 메모리 뷰어의 너비는 `ch` 단위입니다 (`src/features/debugger/memory/gridLayout.ts`). 실행 패널은 높이가 고정(`h-full`)이어야 합니다. 높이가 열리면 메모리 뷰어가 4096 줄을 모두 그립니다.
- 시험용 표시: `data-column`(세 열), `data-memory-row`(메모리 한 줄), `data-memory-underline` / `data-memory-label`(변수 밑줄과 이름), `data-tab-path`(탭), `data-statusbar`, `data-run-state`(실행 상태: ready, load-failed, assembling, running, paused, breakpoint, halted), `data-register`(레지스터 한 칸), `data-project-root`(트리의 뿌리), `data-assembly-order`(어셈블 순서 표시), `data-asm-file` / `data-asm-handle`(설정의 어셈블 파일 줄과 손잡이), `data-device-table` / `data-device-row` / `data-device-add-row`(설정의 장치 표), `data-device` / `data-stream-box`(장치 패널의 장치 한 줄과 바이트 칸), `data-tab-dot`(장치 탭의 새 데이터 점), `data-new-file-option`(새 파일 창의 선택), `data-outside-tab` / `data-outside-banner`(프로젝트 밖 파일의 탭과 띠), `data-no-project`(프로젝트 없이 연 파일의 왼쪽 열).

## 알아 둘 점

- 저장하지 않은 변경: 수정한 탭, 프로젝트, 창을 닫거나 앱을 끝낼 때 저장 / 저장 안 함 / 취소를 묻습니다 (`src/features/editor/unsavedChanges.ts`). 창 닫기는 메인 프로세스가 붙잡아 두었다가 렌더러가 답하면 닫습니다 (`electron/windows/mainWindow.ts`).
- 열 맞춤의 규칙은 `src/features/editor/lib/sicxeFormat.ts`(편집기 없는 순수 함수), 편집기 연결은 `autoIndentation.ts` 입니다. 키마다 실행되므로, 바꿀 때는 `sicxeFormat.test.ts`(키 입력 흉내 포함)와 함께 확인하세요.
- 실행 제어는 `src/features/debugger/runningStore.ts` 에 있습니다. 상태는 준비 → 실행 중 → 멈춤 → 종료이고, 상태 표시줄에 늘 보입니다. 중단점은 그 줄을 실행하기 전에 멈춥니다.
  - 실행(Run) 메뉴와 단축키: 실행·계속 F5, 일시 중지 F6, 한 단계 F10, 처음부터 다시 Ctrl+Shift+F5, 중지 Shift+F5.
  - 실행 간격(명령어 사이의 시간)은 도구 모음의 목록과 실행 메뉴에서 고르며, 실행 중에도 바로 적용됩니다. 기본 250 ms. 20 ms 보다 짧으면 화면을 덜 자주 그립니다(레지스터 50 ms, 메모리·변수 250 ms 마다). 시뮬레이터는 바꾸지 않았습니다.
  - 프로그램이 끝나면(halt) 창을 띄우지 않습니다. 레지스터, 메모리, 변수, 리스트파일은 마지막 상태로 남고, 리스트파일에 끝난 줄이 표시되며, 시뮬레이터 패널에 한 줄이 남습니다. 중지(Shift+F5)해야 실행이 닫힙니다.
  - 실행 전에 project.sic 의 파일과 장치 파일이 있는지 확인하고, 프로그램이 쓰는 장치가 파일에 연결되어 있지 않으면 알립니다. 알림의 버튼은 새 파일(레이블 이름, 예: `outdev.txt`)을 만들어 연결하고 다시 시작합니다.
  - 출력만 하는 장치(WD 만 있고 RD 는 없는 장치)의 파일은 실행을 시작할 때 비웁니다. 시뮬레이터는 파일을 앞에서부터 덮어쓰고 자르지 않아서, 짧은 출력 뒤에 지난 실행의 끝이 남았습니다(`XXXXXX` 에 `AB` → `ABXXXX`). 시뮬레이터는 바꾸지 않았습니다.
  - 연결 안 된 장치는 0 을 읽고 쓴 것을 버리며, TD 에 준비되지 않았다고 답합니다(이 저장소의 SicTools 는 `Device.test()` 가 false). 그래서 교재의 `TD` / `JEQ` 루프는 끝나지 않고, 장치 패널이 "대기 중"으로 알립니다.
- `project.sic` 는 JSON 입니다: `asm`(프로젝트 기준 경로, 어셈블 순서), `main`(먼저 실행할 제어 섹션의 START 또는 CSECT 이름; 여러 파일을 링크할 때만 쓰이며 대소문자를 구분), `filedevices`, `mode`(`"SIC"` 또는 `"SICXE"`, 없으면 SIC).
- 프로젝트 설정 화면은 바뀐 것을 바로 project.sic 에 씁니다(저장 버튼 없음. 메인 프로그램 이름만은 칸을 떠날 때나 Enter, Ctrl+S 에 씁니다). 어셈블 파일을 빼거나 장치 연결을 끊으면 알림에 되돌리기가 있습니다.
  - 장치 표는 소스에서 찾은 장치(RD, WD, TD 와 그 BYTE)와 연결된 장치를 함께 보여 줍니다. 연결 안 된 장치는 한 번에 새 파일로 연결하거나, 프로젝트 파일·새 파일·파일 선택 창(출력 장치는 저장 창이라 새 이름을 쓸 수 있음)에서 고릅니다. 장치 번호는 `F1`, `0xF1`, `X'F1'` 모두 됩니다.
- 밖에서 연 파일(더블 클릭, 연결 프로그램, 명령줄, 두 번째 실행; macOS 는 `open-file`): `project.sic` 는 그 프로젝트를 엽니다. `.asm` 은 그 폴더와 위로 세 단계까지 가장 가까운 `project.sic` 을 찾아(`electron/project/nearbyProject.ts`) 다음처럼 엽니다 (`src/features/project/outsideFiles.ts`):

  | 상황                                        | 동작                                                                                                                                                        |
  | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | 열린 프로젝트 없음, 근처에 project.sic 있음 | 그 프로젝트를 열고 파일을 탭으로. 어셈블 목록에 없으면 알림에 "어셈블 파일에 추가"                                                                          |
  | 열린 프로젝트 없음, project.sic 없음        | 파일만 엽니다 (고치고 저장만, 아무것도 쓰지 않음). 왼쪽 열에 "여기에 프로젝트 만들기"·"프로젝트 열기". 실행하면 프로젝트를 만들자고 합니다                  |
  | 열린 프로젝트의 파일                        | 그 탭 (위와 같은 알림)                                                                                                                                      |
  | 다른 프로젝트의 파일                        | 묻습니다: 그 프로젝트 열기 / 파일만 고치기 / 취소. 실행 중이면 중지된다고 함께 말합니다                                                                     |
  | 어느 프로젝트에도 없는 파일                 | 프로젝트 밖 파일 탭(경로가 절대 경로, 기울임꼴): 그 자리에서 고치고 저장하지만 어셈블하지 않습니다. 위의 띠에 "이 프로젝트로 복사"·"여기에 프로젝트 만들기" |
  - 열린 프로젝트는 묻지 않고 닫지 않습니다 (VS Code, JetBrains, Visual Studio 처럼). 저장하지 않은 변경은 프로젝트를 바꿀 때 늘 묻습니다.
  - "여기에 프로젝트 만들기"는 파일 옆에 `project.sic` 를 씁니다: 그 파일 하나, `main` 은 그 파일의 START 이름, 머신은 명령어로 판단 (`+`, `#`, `@`, SIC/XE 에만 있는 명령어가 있으면 SIC/XE). 파일은 옮기지 않습니다.

- 파일 트리의 뿌리는 프로젝트 폴더입니다(Visual Studio 의 솔루션처럼). 누르면 프로젝트 설정이 열리고, 접히지 않습니다. project.sic 는 파일로 보이지 않습니다.
  - 어셈블하는 파일에는 순서(1st, 2nd …; 한국어 1번째 …)가 붙고, 메인 프로그램의 표시는 채워져 있습니다. 순서는 설정에서 손잡이를 끌거나, 손잡이에서 Alt+↑ / Alt+↓, ▲ / ▼ 로, 또는 트리의 오른쪽 클릭 메뉴로 바꿉니다.
  - 새 파일 창: `.asm` 은 "어셈블 파일에 추가"(기본 켬), `.txt` 는 "장치에 연결"(번호 입력)을 고를 수 있습니다.
- 장치 패널(`src/features/devices/`)은 실행 중 RD, WD, TD 를 명령어마다 기록합니다. 시뮬레이터에 묻지 않습니다: 실행한 명령어의 주소와 그 전후 레지스터, 리스트파일로 압니다(WD 는 실행 전 A 의 마지막 바이트, RD 는 실행 후, TD 는 SW 의 CC).
  - 입력은 파일을 테이프처럼(읽은 바이트, 다음에 읽을 바이트, 남은 바이트, EOF), 출력은 쓴 바이트를 보여 줍니다. 연결 안 된 장치에 쓴 바이트는 지운 줄로 "버려짐" 표시. 문자 / 16진 보기, 복사, 장치마다 마지막 64 KiB.
  - 끝까지 내려가 있을 때만 따라가고, 위로 올렸으면 "새 바이트 N개" 버튼을 띄웁니다. 실행이 끝나거나 중지해도 다음 실행까지 남습니다. 탭이 보이지 않을 때 새 바이트가 오면 탭에 점이 붙고, 탭이 저절로 바뀌지는 않습니다.
- 바뀐 값 표시는 메모리 뷰어, 변수, 장치 패널이 같은 규칙을 씁니다(`src/lib/changeMarks.ts`). 한 단계에서 바뀐 값은 0.6 초 깜빡이고, 다음 단계까지 옅은 색과 굵은 글씨로 남습니다. 자동 실행 중 계속 바뀌는 값은 깜빡임을 다시 시작하지 않고 켜진 채로 둡니다(깜빡임이 초당 3번을 넘지 않도록). 20 ms 보다 짧은 간격에서는 표시하지 않습니다. 운영체제의 "움직임 줄이기"에서는 메모리 칸이 커지지 않습니다.
- 메모리 뷰어의 변수 밑줄과 이름은 값 아래에 따로 줄이 있습니다(값 17 px, 밑줄 3 px, 이름 12 px; `gridLayout.ts`). 위치는 CSS grid 로 정합니다. Chromium 이 `calc()` 안에서 곱과 합의 뺄셈을 잘못 줄여 밑줄이 한 칸 짧아진 일이 있어 그런 식을 쓰지 않습니다.
- 실행 간격은 프로젝트가 아니라 앱의 설정이라 렌더러의 localStorage(`umjoonsic.runInterval`)에 둡니다.
- 메시지는 세 가지뿐입니다: 묻거나 오류를 알리는 창(`src/stores/dialogStore.ts` 의 `ask`, `showError` → `AppDialog`), 잠깐 보이는 알림(`toastStore` 의 `notify` → `Toasts`), 입력 칸 아래의 오류. 운영체제의 메시지 창은 시작 오류와 파일 선택 창에만 씁니다.
- 편집기의 열 맞춤 (프로젝트의 `.asm` 파일): 레이블 1열, 명령어 10열, 피연산자 18열, 주석 36열.
  - 필드는 어셈블러(SicTools)가 읽는 대로 나눕니다. 1열의 단어는 레이블이지만, 명령어이고 다음 단어가 명령어가 아니면 명령어입니다(1열에 친 `LDA ZERO`). 들여 쓴 단어는 다음 단어가 명령어이면 레이블입니다. 피연산자가 없는 명령어(RSUB, LTORG …) 뒤는 주석입니다. 피연산자 안의 빈칸(따옴표 안, 쉼표·연산자 옆, `=WORD 65535`)은 피연산자입니다.
  - Space 와 Tab 은 다음 열로, Shift+Tab 은 앞 필드로 갑니다. 따옴표 안, 주석 안, 쉼표 뒤의 Space 는 빈칸입니다.
  - Enter 는 그 줄을 정리하고, 새 줄은 명령어 열(10열)에서 시작합니다. 레이블은 그대로 쳐도 명령어가 뒤따르면 1열로 갑니다. Backspace 는 줄 앞의 빈칸에서 1열로, 필드 사이 빈칸에서 앞 필드 끝으로 갑니다(빈칸은 지우지 않음).
  - 입력한 줄은 커서가 그 줄을 떠날 때 정리됩니다. 여러 줄 붙여넣기는 한 덩어리로 정리합니다: 모든 줄 앞의 줄 번호(교재 그림)를 빼고, 통째로 들여 쓴 덩어리는 왼쪽으로 옮깁니다. 문서 서식(Windows·macOS 는 Shift+Alt+F, Linux 는 Ctrl+Shift+I; 오른쪽 클릭 메뉴의 Format Document)은 파일 전체를 정리합니다.
  - 정리할 때 어셈블러가 받지 않고 뜻이 하나뿐인 것은 고칩니다: 명령어, `C'`/`X'`, `,X`, 레지스터를 대문자로(기호는 대소문자를 구분하므로 그대로), 쉼표 옆 빈칸, 점 없는 주석 앞의 `. `(교재의 고정 형식). 데이터나 피연산자일 수 있는 것(`65535`, `- X1`, `'…'`)과 모르는 명령어 뒤에는 점을 붙이지 않아 오류로 보입니다.
  - 키는 편집기가 적용하기 전에 처리합니다 (빠르게 쳐도 순서가 섞이지 않음). 선택 영역, 다중 커서, 한글 입력 중(조합 중)에는 편집기 기본 동작입니다. 단어 제안이 열려 있으면 Tab 은 제안을 받습니다.
- 편집기에서 Tab 은 다음 열로 갑니다. 키보드로 편집기를 나가려면 Ctrl+M(macOS 는 Ctrl+Shift+M)으로 Monaco 의 "Tab 으로 포커스 이동"을 켭니다 (VS Code 와 같음). 그래서 Windows·Linux 의 창 최소화에는 단축키가 없습니다.
- 탭: 끌어서 순서를 바꾸고, Ctrl+PageDown / Ctrl+PageUp 으로 옮겨 가며, Ctrl+Shift+PageDown / Ctrl+Shift+PageUp 으로 자리를 옮깁니다 (File 메뉴). macOS 에서도 Ctrl 입니다 (Cmd+PageDown 은 편집기의 스크롤).
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
- 한 개념에는 한 가지 말만 씁니다. 에러가 아니라 오류, 에디터가 아니라 편집기, listing 은 리스트파일. "use" 는 `사용하다` 로 씁니다(`쓰다` 는 WD 의 "write" 와 헷갈립니다).
- 문체는 VS Code·Visual Studio·JetBrains 의 한국어판과 Microsoft 한국어 지역화 지침을 따릅니다:
  - 메뉴, 버튼, 탭, 열 제목, 체크박스는 명사형(`파일 선택`, `실행 취소`, `열린 파일 없음`).
  - 툴팁의 설명, 안내, 띠, 오류 메시지는 `~합니다` 문장과 마침표. 질문은 `~할까요?`, 할 일은 `~하세요`.
  - 한 문자열에서 문장과 명사형을 섞지 않고, 화면에 이미 보이는 내용은 다시 쓰지 않습니다.
  - 조사는 붙여 씁니다(`${name}을(를)`, `RD로`, `00을`). 받침을 알 수 없는 이름 뒤에는 `을(를)`, `이(가)`.
  - 설명하는 괄호는 붙이고(`입력(RD)`), 단축키 앞에는 한 칸(`계속 (F5)`). 개수는 명사 뒤에(`명령어 42개`).

| 영어                        | 한국어 모드            | 영어                 | 한국어 모드          |
| --------------------------- | ---------------------- | -------------------- | -------------------- |
| assembler / linker / loader | 어셈블러 / 링커 / 로더 | symbol               | 기호(symbol)         |
| instruction                 | 명령어                 | label                | 레이블               |
| mnemonic                    | 니모닉                 | operand              | 피연산자             |
| directive                   | 어셈블러 지시어        | object code          | 목적코드(OBJCODE)    |
| listing                     | 리스트파일             | location counter     | 위치 카운터 (LOCCTR) |
| control section             | 제어 섹션              | addressing mode      | 주소 지정 방식       |
| accumulator (A)             | 누산기                 | index register (X)   | 인덱스 레지스터      |
| linkage register (L)        | 연결 레지스터          | base register (B)    | 베이스 레지스터      |
| status word (SW)            | 상태 워드              | program counter (PC) | 프로그램 카운터      |
| breakpoint                  | 중단점                 | step                 | 한 단계              |
| pause / stop                | 일시 중지 / 중지       | halt (program end)   | 종료                 |
| memory / register           | 메모리 / 레지스터      | device               | 장치                 |
