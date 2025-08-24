import { useProjectStore } from '@/stores/ProjectStore';

export let port = 8080; // placeholder, can be set dynamically at runtime

async function runSingleFile(filePath: string) {
  try {
    const res = await window.api.loadAsm(port, filePath);
    if (!res.success) {
      console.error('Load failed', { status: res.status, message: res.message });
    } else {
      console.log(res.data); // full result
    }
  } catch (err) {
    console.error('Failed to load single file:', err);
  }
}

async function runMultipleFiles(filePaths: string[]) {
  console.warn('TODO: implement multi-file load', filePaths);
}

export function useRunMenu() {
  const getAsmAbsolutePaths = useProjectStore(s => s.getAsmAbsolutePaths);

  const run = async () => {
    const abs = getAsmAbsolutePaths();
    if (abs.length === 0) {
      console.warn('No project files under "asm".');
      return;
    }
    if (abs.length === 1) {
      await runSingleFile(abs[0]);
    } else {
      await runMultipleFiles(abs);
    }
  };

  const rerun = () => console.log('ReRun');
  const stop = () => console.log('Stop');

  return { run, rerun, stop };
}
