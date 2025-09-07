# 동국대학교 컴퓨터·AI학부 공식 실습 프로그램 **엄준SIC**
<img width="2100" height="1400" alt="splash" src="https://github.com/user-attachments/assets/f293ede4-6af5-4723-b066-98ae02784de6" />

전공과목 **시스템소프트웨어(구 시스템소프트웨어및실습)** 전반부의 SIC/SIC-XE 어셈블리 실습은 오랫동안 `sicsim.exe`, `sicedit.exe`, `sicasm.exe` 세 프로그램에 의존해 왔습니다. 그러나 이 도구들은 **DOSBox**가 필요하고 기본적인 CLI만 제공해 실습·디버깅·보고서 작성이 매우 불편했습니다. 특히 **DOSBox 출력은 복사가 어렵고**, `sicedit.exe`는 **macOS에서 동작하지 않아** 맥북 사용자들이 메모장으로 공백 수를 직접 계산하며 코드를 작성해야 하는 문제가 있었습니다.

이 문제를 해결하기 위해 동국대학교 중앙동아리 **CAPS**는 2025년 여름 스터디로 실습 프로그램을 **리마스터**했습니다. 목표는 운영체제 제약 없이 누구나 현대적인 UI로 편리하게 실습하고, 결과를 쉽게 복사·공유할 수 있는 환경을 제공하는 것입니다.

## 프로젝트 개요

- **프론트엔드(Electron)**  
  Windows·macOS에서 설치/실행 가능하며, **리눅스 지원도 순차적으로 추진**합니다. 기존 도구 대비 현대적이고 접근성 높은 UI/UX를 제공합니다.

- **백엔드(Java, Spark 기반)**  
  jurem의 **SicTools**(Java) 프로젝트를 기반으로, 기존 **Swing 앱을 Spark(Java) 서버 애플리케이션**으로 재구성했습니다.
  - 백엔드의 기초가 된 프로그램 : jurem/SicTools
     - 원작 리포지터리 : https://github.com/jurem/SicTools
     - 원작자 웹사이트 : https://jurem.github.io/SicTools/
  - **SIC-XE뿐 아니라 순수 SIC까지** 아우르도록 로직을 보강했습니다.  
  - **문법 오류 위치 반환의 부정확성** 등 기존 이슈를 일괄 패치하여 실습 시 디버깅 경험을 개선했습니다.

## 라이선스 및 서브트리 고지

- 본 프로젝트는 **BSD-2-Clause** 라이선스로 배포됩니다. (상세 내용은 저장소의 `LICENSE` 파일을 참조하세요.)
- 이 저장소에는 **jurem/SicTools**의 일부 코드 및 아이디어가 **Git subtree** 형태로 포함될 수 있습니다. 해당 부분은 **원저작권자 및 라이선스 고지( BSD-2-Clause )를 그대로 상속합니다**
- BSD-2-Clause 조건에 따라, **원저작권 고지 및 면책 조항**은 소스/바이너리 재배포 시 반드시 함께 제공되어야 합니다.

## 참고 문헌

- Leland L. Beck, *System Software: An Introduction to Systems Programming*, 3rd ed., Addison-Wesley, 1997.  
- Jurij Mihelič, Tomaž Dobravec, “SicSim: A simulator of the educational SIC/XE computer for a system-software course,” *Computer Applications in Engineering Education*, 23(1):137–146, 2015. doi:10.1002/cae.21585

## 개발 지도 및 참여

- **개발 지도**
  - 동국대학교 컴퓨터·AI학부 교수 **정준호**
  - 동국대학교 컴퓨터·AI학부 교수 **한인**

- **개발 총괄**
  - 컴퓨터공학과 **20학번 정상원**
  - 약학과 **23학번 원종인**
  - 컴퓨터·AI학부 **24학번 송윤석**
  - 컴퓨터공학과 **24학번 안지민**

- **검수: 중앙동아리 CAPS 여름 프로젝트형 스터디 참가자 일동**  
  통계학과 24학번 전가희, 컴퓨터공학전공 24학번 박예진, 컴퓨터AI학부 25학번 원종호, 컴퓨터AI학부 22학번 서동건, 통계학과 23학번 박서연, 컴퓨터AI학부 24학번 노혜륜, 경찰행정학부 20학번 조준용, 경영정보학과 23학번 최지인, 컴퓨터ai학부 25학번 김영주, 기계로봇에너지공학과 24학번 채건, 컴퓨터AI학부 22학번 김민설, 컴퓨터공학전공 23학번 김예원, 컴퓨터ai학부 23학번 신효환, 컴퓨터ai학부 23학번 이정은, 컴퓨터공학과 24학번 윤재필, 멀티미디어소프트웨어공학전공 23학번 이서연, 컴퓨터ai학부 21학번 장길빈, 컴퓨터공학전공 23학번 박준홍

오류 제보는 자유롭게 **Issues**로 등록해 주세요. **BSD-2-Clause** 라이선스를 준수하는 범위에서 자유로운 이용과 파생 작업을 환영합니다. 함께해 주신 스터디원들과 **정준호 교수님, 한 인 교수님**께 깊이 감사드립니다.


## 개발자 / 기여자를 위한 가이드
### 프론트엔드(일렉트론) 세팅 가이드

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
pnpm run dev
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



### 백엔드(java) 세팅 가이드
**중요 : 파라미터를 통해 별도로 포트를 받지 않는다면, 반드시 9090 포트가 비어있어야 합니다**

**1. gradle 설치**
적절한 버전의 gradle을 설치하셔도 되고, intelliJ에서 프로젝트를 열어 gradle을 사용해도 됩니다(권장)
**2. 실행 및 디버그**
```bash
cd simulator
./gradlew run --stacktrace
```
IntelliJ에서 열 경우 해당 커맨드가 우측 상단의 Run Configurations에 자동적으로 나타납니다.

**3. 최종 빌드**
같은 디렉터리에서
```bash
gradle clean shadowJar
```
 - 하나의 jar 파일로 빌드합니다
