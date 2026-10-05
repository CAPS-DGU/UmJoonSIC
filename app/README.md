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
  menu.ts                메뉴
  preload.ts             window.api 노출, main→renderer 메시지를 DOM 이벤트로 전달
  appUpdate.ts           새 버전 확인
  paths.ts               빌드 결과물 경로
  windows/               mainWindow, splashWindow, aboutWindow
  ipc/                   window.api 요청 처리: project, files, server, window(창 닫기와 저장 확인)
  project/               project.sic 읽기·생성(projectFiles), 외부에서 연 프로젝트 경로 큐(openQueue)
  simulator/             JRE(jre), simulator.jar(jar), 다운로드(download), 프로세스(process), 경로(paths)

src/
  App.tsx                화면 배치
  api/                   시뮬레이터 HTTP 클라이언트와 요청·응답 타입
  components/            앱 전체에서 쓰는 컴포넌트 (ui/ 는 shadcn 기본 컴포넌트)
  features/
    project/             프로젝트 열기·닫기, project.sic 설정 화면, 시작 화면
    fileTree/            왼쪽 파일 트리
    editor/              Monaco 에디터(파일마다 모델 하나), 탭, 저장 확인, 자동 열 맞춤, 구문 검사
    listing/             실행 중 표시되는 리스트(List) 탭
    debugger/            실행 제어(runningStore), 도구 모음, 레지스터, 메모리 뷰어
    panel/               아래 패널: 관찰 / 오류 / 서버
  lib/, stores/, types/  여러 기능이 함께 쓰는 유틸, 모달 스토어, 전역 타입

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

## 알아 둘 점

- 저장하지 않은 변경: 수정한 탭, 프로젝트, 창을 닫거나 앱을 끝낼 때 저장 / 저장 안 함 / 취소를 묻습니다 (`src/features/editor/unsavedChanges.ts`). 창 닫기는 메인 프로세스가 붙잡아 두었다가 렌더러가 답하면 닫습니다 (`electron/windows/mainWindow.ts`).
- 자동 열 맞춤(`src/features/editor/lib/autoIndentLine.ts`)은 입력 한 번마다 실행되므로, 바꿀 때는 `autoIndentLine.test.ts` 와 함께 확인하세요.
- 실행 제어(실행, 지연 실행, 계속, 한 줄 실행, 중지)는 `src/features/debugger/runningStore.ts` 에 있습니다. 중단점은 그 줄을 실행하기 전에 멈춥니다.
- `project.sic` 는 JSON 입니다: `asm`(프로젝트 기준 경로), `main`(확장자 없는 이름), `filedevices`, `mode`(`"SIC"` 또는 `"SICXE"`, 없으면 SIC). 모드를 바꾸면 `mode` 만 바로 저장되고, 설정 화면의 저장하지 않은 편집은 그대로 남습니다.
- 사용자 지정 지연 시간은 프로젝트가 아니라 앱의 설정이라 렌더러의 localStorage(`umjoonsic.delayTime`)에 둡니다.
- 탭: 끌어서 순서를 바꾸고, Ctrl+PageDown / Ctrl+PageUp 으로 옮겨 가며, Ctrl+Shift+PageDown / Ctrl+Shift+PageUp 으로 자리를 옮깁니다 (File 메뉴). macOS 에서도 Ctrl 입니다 (Cmd+PageDown 은 에디터의 스크롤).
- 스플래시는 시작이 끝날 때까지의 창입니다. 닫으면 시작을 취소하고 앱이 끝납니다 (`electron/main.ts`).
