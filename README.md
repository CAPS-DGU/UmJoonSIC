[![Read in English](https://img.shields.io/badge/Read_in-English-blue)](README.en.md)

# 동국대학교 컴퓨터·AI학부 공식 실습 프로그램 **엄준SIC**
<img width="2100" height="1400" alt="splash" src="https://github.com/user-attachments/assets/f293ede4-6af5-4723-b066-98ae02784de6" />


[>>설치 방법 및 사용 설명서(클릭)<<](https://radical-potential-27c.notion.site/How-to-use-UmJoonSIC-267b7ce7932f80d799f0f6b0a11c0bd9?source=copy_link)


컴퓨터공학과(현 컴퓨터·AI학부) 전공과목 **시스템소프트웨어(구 시스템소프트웨어및실습)** 전반부의 SIC/SIC-XE 어셈블리 실습은 오랫동안 `sicsim.exe`, `sicedit.exe`, `sicasm.exe` 세 프로그램에 의존해 왔습니다. 그러나 이 도구들은 **DOSBox**가 필요하고 기본적인 CLI만 제공해 실습·디버깅·보고서 작성이 매우 불편했습니다. 특히 **DOSBox 출력은 복사가 어렵고**, `sicedit.exe`는 **macOS에서 동작하지 않아** 맥북 사용자들이 메모장으로 공백 수를 직접 계산하며 코드를 작성해야 하는 문제가 있었습니다.

이 문제를 해결하기 위해 동국대학교 중앙동아리 **CAPS**는 2025년 여름 스터디로 실습 프로그램을 **리마스터**했습니다. 목표는 운영체제 제약 없이 누구나 현대적인 UI로 편리하게 실습하고, 결과를 쉽게 복사·공유할 수 있는 환경을 제공하는 것입니다.

## 프로젝트 개요

- **프론트엔드(Electron)**  
  Windows·macOS·**리눅스(x64)**에서 설치/실행 가능합니다. 기존 도구 대비 현대적이고 접근성 높은 UI/UX를 제공합니다.

- **백엔드(Java, Spark 기반)**  
  jurem의 **SicTools**(Java) 프로젝트를 기반으로, 기존 **Swing 앱을 Spark(Java) 서버 애플리케이션**으로 재구성했습니다.
  - 백엔드의 기초가 된 프로그램 : jurem/SicTools
     - 원작 리포지터리 : https://github.com/jurem/SicTools
     - 원작자 웹사이트 : https://jurem.github.io/SicTools/
  - **SIC-XE뿐 아니라 순수 SIC까지** 아우르도록 로직을 보강했습니다.  
  - **문법 오류 위치 반환의 부정확성** 등 기존 이슈를 일괄 패치하여 실습 시 디버깅 경험을 개선했습니다.

## 리눅스(x64) 설치

[Releases](https://github.com/CAPS-DGU/UmJoonSIC/releases)에서 `UmJoonSIC-linux-x64-<버전>.tar.gz`를 받아 압축을 풀고 `install.sh`를 실행합니다. 관리자 권한은 필요 없습니다.

```bash
tar -xzf UmJoonSIC-linux-x64-1.1.0.tar.gz
cd UmJoonSIC-linux-x64-1.1.0
./install.sh
```

설치 후 앱 목록의 엄준SIC 또는 터미널의 `umjoonsic`으로 실행합니다. 삭제는 `./install.sh --uninstall`입니다.

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
  통계학과 24학번 전가희, 컴퓨터공학전공 24학번 박예진, 컴퓨터AI학부 25학번 원종호, 컴퓨터AI학부 22학번 서동건, 통계학과 23학번 박서연, 컴퓨터AI학부 24학번 노혜륜, 경찰행정학부 20학번 조준용, 경영정보학과 23학번 최지인, 컴퓨터ai학부 25학번 김영주, 기계로봇에너지공학과 24학번 채건, 컴퓨터AI학부 22학번 김민설, 컴퓨터공학전공 23학번 김예원, 컴퓨터ai학부 23학번 신효환, 컴퓨터ai학부 23학번 이정은, 컴퓨터공학과 24학번 윤재필, 멀티미디어소프트웨어공학전공 23학번 이서연, 컴퓨터ai학부 21학번 장길빈, 컴퓨터공학전공 23학번 박준홍, 정보통신공학과 20학번 한병헌, 컴퓨터AI학부 25학번 심현서, 컴퓨터AI학부 25학번 강성찬, 수학과 24학번 성준영, 컴퓨터AI학부 25학번 박재관, 통계학과 25학번 김주혜

오류 제보는 자유롭게 **Issues**로 등록해 주세요. **BSD-2-Clause** 라이선스를 준수하는 범위에서 자유로운 이용과 파생 작업을 환영합니다. 함께해 주신 스터디원들과 **정준호 교수님, 한 인 교수님**께 깊이 감사드립니다.


## 개발자 / 기여자를 위한 가이드

개발 환경 설정, 빌드, 릴리스 방법은 [개발 문서(영문)](docs/DEVELOPMENT.md)에 있습니다.
