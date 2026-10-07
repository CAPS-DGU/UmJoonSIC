[![한국어로 읽기](https://img.shields.io/badge/%ED%95%9C%EA%B5%AD%EC%96%B4-README-blue)](README.md)

# **UmJoonSIC**, the official practice program of the Division of Computer Science and AI, Dongguk University
<img width="2100" height="1400" alt="splash" src="https://github.com/user-attachments/assets/f293ede4-6af5-4723-b066-98ae02784de6" />


[>> Installation and user guide (Korean) <<](https://radical-potential-27c.notion.site/How-to-use-UmJoonSIC-267b7ce7932f80d799f0f6b0a11c0bd9?source=copy_link)


For many years, the SIC/SIC-XE assembly exercises in the first half of **System Software** (formerly System Software and Practice), a major course of the Department of Computer Engineering (now the Division of Computer Science and AI), relied on three programs: `sicsim.exe`, `sicedit.exe` and `sicasm.exe`. These tools need **DOSBox** and offer only a basic command line, which made practice, debugging and writing reports very inconvenient. In particular, **DOSBox output is hard to copy**, and `sicedit.exe` **does not run on macOS**, so MacBook users had to write their code in a plain text editor, counting the spaces by hand.

To solve this, **CAPS**, a central club of Dongguk University, **remastered** the practice program as its summer 2025 study. The goal is an environment where anyone can practise conveniently in a modern interface, on any operating system, and copy and share the results easily.

## Overview

- **Frontend (Electron)**
  Installs and runs on Windows, macOS and **Linux (x64)**. Its UI/UX is modern and more accessible than the old tools.

- **Backend (Java, based on Spark)**
  Based on jurem's **SicTools** (Java) project: the original **Swing application was rebuilt as a Spark (Java) server application**.
  - The program the backend is based on: jurem/SicTools
     - Original repository: https://github.com/jurem/SicTools
     - Author's website: https://jurem.github.io/SicTools/
  - The logic was extended to cover **pure SIC as well as SIC-XE**.
  - Existing issues such as **inaccurate positions of syntax errors** were fixed, for a better debugging experience in the exercises.

## Installing on Linux (x64)

From [Releases](https://github.com/CAPS-DGU/UmJoonSIC/releases), download only `install-linux.sh` and run it. It downloads the program itself (`UmJoonSIC-linux-x64-<version>.tar.gz`); curl or wget is needed.

```bash
curl -fLO https://github.com/CAPS-DGU/UmJoonSIC/releases/download/v1.1.0/install-linux.sh
bash install-linux.sh
```

If you downloaded the tar.gz yourself, unpack it and run the `install.sh` inside. The result is the same.

```bash
tar -xzf UmJoonSIC-linux-x64-1.1.0.tar.gz
cd UmJoonSIC-linux-x64-1.1.0
./install.sh
```

It installs for the current user (`~/.local`). It asks for the administrator (sudo) password only when it has to install missing libraries or a Korean font, or set up the sandbox.

Then start UmJoonSIC from the applications menu, or with `umjoonsic` in a terminal. To remove it, run `bash ~/.local/share/umjoonsic/install.sh --uninstall`.

## Licence and subtree notice

- This project is distributed under the **BSD-2-Clause** licence (see the `LICENSE` file in the repository).
- This repository may contain code and ideas from **jurem/SicTools** as a **Git subtree**. Those parts **inherit the original copyright and licence notice (BSD-2-Clause)**.
- Under the BSD-2-Clause terms, the **original copyright notice and disclaimer** must accompany any redistribution in source or binary form.

## References

- Leland L. Beck, *System Software: An Introduction to Systems Programming*, 3rd ed., Addison-Wesley, 1997.
- Jurij Mihelič, Tomaž Dobravec, “SicSim: A simulator of the educational SIC/XE computer for a system-software course,” *Computer Applications in Engineering Education*, 23(1):137–146, 2015. doi:10.1002/cae.21585

## Supervision and contributors

- **Supervision**
  - Prof. **정준호**, Division of Computer Science and AI, Dongguk University
  - Prof. **한인**, Division of Computer Science and AI, Dongguk University

- **Development leads**
  - **정상원** (Computer Engineering, '20)
  - **원종인** (Pharmacy, '23)
  - **송윤석** (Computer Science and AI, '24)
  - **안지민** (Computer Engineering, '24)

- **Review: all participants of the CAPS summer project study**
  전가희 (Statistics, '24), 박예진 (Computer Engineering, '24), 원종호 (Computer Science and AI, '25), 서동건 (Computer Science and AI, '22), 박서연 (Statistics, '23), 노혜륜 (Computer Science and AI, '24), 조준용 (Police Administration, '20), 최지인 (Management Information Systems, '23), 김영주 (Computer Science and AI, '25), 채건 (Mechanical, Robotics and Energy Engineering, '24), 김민설 (Computer Science and AI, '22), 김예원 (Computer Engineering, '23), 신효환 (Computer Science and AI, '23), 이정은 (Computer Science and AI, '23), 윤재필 (Computer Engineering, '24), 이서연 (Multimedia Software Engineering, '23), 장길빈 (Computer Science and AI, '21), 박준홍 (Computer Engineering, '23), 한병헌 (Information and Communication Engineering, '20), 심현서 (Computer Science and AI, '25), 강성찬 (Computer Science and AI, '25), 성준영 (Mathematics, '24), 박재관 (Computer Science and AI, '25), 김주혜 (Statistics, '25)

Please report problems freely as **Issues**. Use and derivative works are welcome within the terms of the **BSD-2-Clause** licence. Our deep thanks go to the study members and to **Prof. 정준호 and Prof. 한인**.

## For developers and contributors

Setting up, building and releasing are described in the [developer documentation](docs/DEVELOPMENT.md).
