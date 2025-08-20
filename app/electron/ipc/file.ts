import { ipcMain, dialog } from "electron";
import * as fs from "fs";
import * as pathModule from "path";

// 재귀적으로 모든 파일을 상대경로로 가져오는 함수
function getAllFilesRecursive(dirPath: string, basePath: string): string[] {
  const files: string[] = [];
  
  try {
    const items = fs.readdirSync(dirPath);
    
    for (const item of items) {
      const fullPath = pathModule.join(dirPath, item);
      const relativePath = pathModule.relative(basePath, fullPath);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        // 디렉토리인 경우 재귀적으로 하위 파일들도 가져오기
        const subFiles = getAllFilesRecursive(fullPath, basePath);
        files.push(...subFiles);
      } else {
        // 파일인 경우 상대경로로 추가
        files.push(relativePath);
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dirPath}:`, error);
  }
  
  return files;
}

// 새 프로젝트 생성 함수
async function createNewProject(projectPath: string, projectName: string) {
  try {
    // 프로젝트 디렉토리 생성
    if (!fs.existsSync(projectPath)) {
      fs.mkdirSync(projectPath, { recursive: true });
    }

    // src/main.asm 파일 생성
    const mainAsmPath = pathModule.join(projectPath, "src", "main.asm");
    const mainAsmDir = pathModule.dirname(mainAsmPath);
    if (!fs.existsSync(mainAsmDir)) {
      fs.mkdirSync(mainAsmDir, { recursive: true });
    }
    
    const mainAsmContent = `. Tests: base-relative, directives BASE, NOBASE

base	START	0xA000

. load B register and notify assembler
		+LDB	#b
        BASE	b

        LDA		#b			base-relative addressing: (B)+0
        LDA		#b			but pc-relative addressing prefered: (PC)+2047
        RESB    2047
b       BYTE    C'FOO'         b displaced by 2048 bytes

. ********** other **********
        LDA		#c			base-relative (since c-b < 4096)
        NOBASE
       +LDA		#c			direct extended, LDA #c would fail here
        RESB    2048
c       BYTE    C'BAR'
`;
    
    fs.writeFileSync(mainAsmPath, mainAsmContent);

    // project.sic 파일 생성
    const projectSicPath = pathModule.join(projectPath, "project.sic");
    const projectSicContent = `{
  "asm": ["main.asm"],
  "main": "main.asm"
}`;
    
    fs.writeFileSync(projectSicPath, projectSicContent);

    return {
      success: true,
      data: {
        name: projectName,
        path: projectPath,
        settings: {
          asm: ["src/main.asm"],
          main: "src/main.asm"
        }
      }
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

ipcMain.handle("getFileList", async (event, dirPath: string) => {
  try {
    // 절대경로로 변환
    const absolutePath = pathModule.resolve(dirPath);
    
    // 재귀적으로 모든 파일 가져오기
    const allFiles = getAllFilesRecursive(absolutePath, absolutePath);
    
    return {
      success: true,
      data: allFiles
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error"
    };
  }
});

ipcMain.handle("createNewProject", async (event) => {
  try {
    // 폴더 선택 다이얼로그 표시
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      title: '새 프로젝트 폴더 선택'
    });

    if (result.canceled || result.filePaths.length === 0) {
      return {
        success: false,
        message: "폴더 선택이 취소되었습니다."
      };
    }

    const projectPath = result.filePaths[0];
    const projectName = pathModule.basename(projectPath);

    // 새 프로젝트 생성
    const createResult = await createNewProject(projectPath, projectName);
    
    if (createResult.success) {
      return createResult;
    } else {
      return {
        success: false,
        message: createResult.message
      };
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error"
    };
  }
});

ipcMain.handle("readFile", async (event, filePath: string) => {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    return {
      success: true,
      data: content
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error"
    };
  }
});