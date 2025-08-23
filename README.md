# 2025_summer_project

## 프론트엔드(일렉트론) 세팅 가이드

**1. pnpm 설치**
Node.js 환경에서 사용할 패키지 매니저 중 하나인 `pnpm`을 설치합니다.

```
npm install -g pnpm
```

> Node.js가 설치되어 있어야 합니다.

**2. 프로젝트 의존성 설치**
프로젝트의 프론트엔드 코드는 `app` 디렉토리에 있습니다. 이동 후 의존성을 설치합니다.

```
cd app
pnpm install
```

**3. 개발 서버 실행**
개발 중에는 로컬 서버를 띄워서 변경 사항을 실시간으로 확인할 수 있습니다.

```
pnpm run devdev
```

> 서버가 정상적으로 실행되면 브라우저 또는 일렉트론 앱에서 바로 확인 가능합니다.

**4. 빌드**

```
pnpm build
```

**5. 코드 포맷 및 린트 설정**
코드 스타일을 일관되게 유지하기 위해 Prettier를 사용합니다.

- IDE에서 Prettier 확장을 설치합니다.
- VSCode를 사용하는 경우, 루트 경로에 `.vscode/settings.json` 파일을 만들고 다음을 추가합니다.

```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true
}
```

> 이렇게 하면 저장할 때 자동으로 코드가 포맷되며, 협업 시 스타일 일관성을 유지할 수 있습니다.
