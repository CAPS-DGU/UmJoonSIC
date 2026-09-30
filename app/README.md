# UmJoonSIC 앱 (Electron)

엄준SIC의 데스크톱 앱입니다. Electron 메인 프로세스가 Java 시뮬레이터(`../simulator`)를 실행하고, React 렌더러가 HTTP로 시뮬레이터와 통신합니다.

## 명령어

```sh
pnpm install          # 의존성 설치
pnpm dev              # 개발 실행 (HMR, DevTools)
pnpm typecheck        # 타입 검사 (src, electron, shared)
pnpm lint             # ESLint
pnpm format           # Prettier
pnpm build            # 타입 검사 + 빌드 (dist/)
pnpm make             # 설치 파일 생성 (electron-forge)
```

Node.js 22, pnpm 10 기준입니다.

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
  ipc/                   window.api 요청 처리: project, files, server
  project/               project.sic 읽기·생성(projectFiles), 외부에서 연 프로젝트 경로 큐(openQueue)
  simulator/             JRE(jre), simulator.jar(jar), 다운로드(download), 프로세스(process), 경로(paths)

src/
  App.tsx                화면 배치
  api/                   시뮬레이터 HTTP 클라이언트와 요청·응답 타입
  components/            앱 전체에서 쓰는 컴포넌트 (ui/ 는 shadcn 기본 컴포넌트)
  features/
    project/             프로젝트 열기·닫기, project.sic 설정 화면, 시작 화면
    fileTree/            왼쪽 파일 트리
    editor/              Monaco 에디터, 탭, 자동 열 맞춤, 구문 검사
    listing/             실행 중 표시되는 리스트(List) 탭
    debugger/            실행 도구 모음, 레지스터, 메모리 뷰어
    panel/               아래 패널: 관찰 / 오류 / 서버
  lib/, stores/, types/  여러 기능이 함께 쓰는 유틸, 모달 스토어, 전역 타입

public/                  splash.html, progress.html, about.html (창에서 직접 불러오는 정적 파일)
```

## 규칙

- 파일 이름: 컴포넌트 `PascalCase.tsx`, 훅 `useXxx.ts`, 그 외 `camelCase.ts`.
- import 는 `@/…`(src), `@shared/…`(shared) 별칭을 씁니다.
- 기능 폴더 안에 그 기능의 컴포넌트·스토어·훅을 함께 둡니다.
- 시뮬레이터 호출은 `src/api/simulator.ts`, 파일 작업은 `window.api`만 사용합니다.
- 커밋 전에 `pnpm typecheck && pnpm lint && pnpm format` 이 통과해야 합니다.

## 알아 둘 점

코드에 `NOTE:` 주석으로 표시한 곳은 현재 화면 동작이 그 구현에 기대고 있어 정리 과정에서 일부러 그대로 둔 부분입니다 (예: 디버거 도구 모음이 일시정지 상태를 구독하지 않음, 에디터 테마 이름 불일치). 고칠 때는 관련 동작을 함께 확인하세요.
