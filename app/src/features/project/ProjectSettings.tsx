import { useCallback, useEffect, useState } from 'react';
import type { ProjectSettings as Settings } from '@shared/ipc';
import { useEditorTabStore } from '@/features/editor/editorTabStore';
import TabBar from '@/features/editor/TabBar';
import { useProjectStore } from '@/features/project/projectStore';
import { useInfoModalStore } from '@/stores/infoModalStore';
import { FORM_BUTTON, FORM_FIELD, INLINE_ICON_BUTTON } from '@/lib/controls';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Device numbers 0x00-0xFF. */
const DEVICE_INDEXES = Array.from({ length: 256 }, (_, i) => i);

const toHexByte = (value: number) => `0x${value.toString(16).toUpperCase().padStart(2, '0')}`;

/** Editor for project.sic, shown while its tab is active: entry module, asm files, file devices. */
export default function ProjectSettings() {
  const settings = useProjectStore(s => s.settings);
  const setSettings = useProjectStore(s => s.setSettings);
  const saveSettings = useProjectStore(s => s.saveSettings);
  // This view shows the active tab, which is the settings tab.
  const settingsTabPath = useEditorTabStore(state => state.activePath);
  const setModified = useEditorTabStore(state => state.setModified);
  const setIsModified = useCallback(
    (isModified: boolean) => {
      if (settingsTabPath) setModified(settingsTabPath, isModified);
    },
    [settingsTabPath, setModified],
  );
  const [newAsm, setNewAsm] = useState('');
  const [deviceIndex, setDeviceIndex] = useState<number>(0);

  const devices = settings.filedevices || [];

  /** Apply a change to the settings and mark the tab as modified. */
  const update = (changed: Partial<Settings>) => {
    setSettings({ ...settings, ...changed });
    setIsModified(true);
  };

  // Ctrl+S / Cmd+S saves the settings.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        e.stopPropagation();
        saveSettings().then(res => {
          if (res.success) {
            setIsModified(false);
          } else {
            useInfoModalStore.getState().show('저장 실패', res.message ?? 'project.sic');
          }
        });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [saveSettings, setIsModified]);

  const addAsm = () => {
    setSettings({ ...settings, asm: [...settings.asm, newAsm] });
    setNewAsm('');
    setIsModified(true);
  };

  /** Map the selected device number to a file chosen in the native file picker. */
  const pickDeviceFile = async () => {
    const res = await window.api.pickFile();
    if (res.success && res.data) {
      const others = devices.filter(d => d.index !== deviceIndex);
      update({ filedevices: others.concat([{ index: deviceIndex, filename: res.data }]) });
    }
  };

  const save = () => {
    saveSettings().then(res => {
      if (res.success) {
        setIsModified(false);
        alert('Settings saved');
      } else {
        alert(res.message ?? 'Failed to save settings');
      }
    });
  };

  return (
    <div className="flex flex-col flex-1 w-full h-full">
      <TabBar />
      <div className="flex-1 overflow-auto bg-gray-100 p-4 text-sm">
        <div className="flex max-w-2xl flex-col gap-5">
          <h1 className="text-base font-semibold">SIC Setting</h1>

          <section className="flex flex-col gap-2">
            <label className="font-semibold" htmlFor="sic-main">
              Main
            </label>
            <input
              id="sic-main"
              type="text"
              className={`${FORM_FIELD} w-full max-w-xs font-mono`}
              value={settings.main}
              onChange={e => update({ main: e.target.value })}
            />
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-semibold">Asm List</h2>
            <ul className="divide-y rounded border bg-white">
              {settings.asm.map(asm => (
                <li key={asm} className="flex items-center gap-2 px-2 py-1">
                  <span className="min-w-0 flex-1 truncate font-mono" title={asm}>
                    {asm}
                  </span>
                  <button
                    className={INLINE_ICON_BUTTON}
                    title="목록에서 빼기"
                    onClick={() => update({ asm: settings.asm.filter(a => a !== asm) })}
                  >
                    <X width={12} height={12} />
                  </button>
                </li>
              ))}
              {settings.asm.length === 0 && (
                <li className="px-2 py-1 text-xs text-gray-400">No file</li>
              )}
            </ul>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                aria-label="Add Asm"
                placeholder="file.asm"
                className={`${FORM_FIELD} min-w-0 flex-1 basis-40 font-mono`}
                value={newAsm}
                onChange={e => setNewAsm(e.target.value)}
              />
              <button className={FORM_BUTTON} onClick={addAsm}>
                Add
              </button>
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-semibold">Device List</h2>
            <ul className="divide-y rounded border bg-white">
              {devices.map(d => (
                <li key={d.index} className="flex items-center gap-2 px-2 py-1">
                  <span className="shrink-0 font-mono text-xs">{toHexByte(d.index)}</span>
                  <span className="min-w-0 flex-1 truncate font-mono" title={d.filename}>
                    {d.filename}
                  </span>
                  <button
                    className={INLINE_ICON_BUTTON}
                    title="장치 연결 해제"
                    onClick={() =>
                      update({ filedevices: devices.filter(x => x.index !== d.index) })
                    }
                  >
                    <X width={12} height={12} />
                  </button>
                </li>
              ))}
              {devices.length === 0 && (
                <li className="px-2 py-1 text-xs text-gray-400">No device mapped</li>
              )}
            </ul>
            <div className="flex flex-wrap items-center gap-2">
              <span className="shrink-0 font-semibold">Add Device</span>
              <select
                className={`${FORM_FIELD} shrink-0 font-mono`}
                value={deviceIndex.toString(16)}
                onChange={e => setDeviceIndex(parseInt(e.target.value, 16))}
              >
                {DEVICE_INDEXES.map(i => (
                  <option key={i} value={i.toString(16)}>
                    {toHexByte(i)}
                  </option>
                ))}
              </select>
              <div className="flex min-w-0 flex-1 basis-48 items-center gap-2">
                <input
                  type="text"
                  className="h-7 min-w-0 flex-1 cursor-not-allowed rounded-md border border-gray-300 bg-gray-100 px-2 font-mono"
                  value={devices.find(d => d.index === deviceIndex)?.filename ?? ''}
                  placeholder="파일을 선택하세요"
                  disabled
                />
                <button
                  className={cn(FORM_BUTTON, 'px-2')}
                  title="파일 선택"
                  onClick={pickDeviceFile}
                >
                  …
                </button>
              </div>
            </div>
          </section>

          <div>
            <button className={FORM_BUTTON} onClick={save}>
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
