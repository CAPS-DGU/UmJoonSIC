import { useEffect, useState } from 'react';
import type { ProjectSettings as Settings } from '@shared/ipc';
import { useEditorTabStore } from '@/features/editor/editorTabStore';
import TabBar from '@/features/editor/TabBar';
import { useProjectStore } from '@/features/project/projectStore';

/** Device numbers 0x00-0xFF. */
const DEVICE_INDEXES = Array.from({ length: 256 }, (_, i) => i);

const toHexByte = (value: number) => `0x${value.toString(16).toUpperCase().padStart(2, '0')}`;

/** Editor for project.sic, shown while its tab is active: entry module, asm files, file devices. */
export default function ProjectSettings() {
  const { settings, setSettings, saveSettings } = useProjectStore();
  const { activeTabIdx, setIsModified } = useEditorTabStore();
  const [newAsm, setNewAsm] = useState('');
  const [deviceIndex, setDeviceIndex] = useState<number>(0);

  const devices = settings.filedevices || [];

  /** Apply a change to the settings and mark the tab as modified. */
  const update = (changed: Partial<Settings>) => {
    setSettings({ ...settings, ...changed });
    setIsModified(activeTabIdx, true);
  };

  // Ctrl+S / Cmd+S saves the settings.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        e.stopPropagation();
        saveSettings().then(res => {
          if (res.success) {
            setIsModified(activeTabIdx, false);
          }
        });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [saveSettings, activeTabIdx, setIsModified]);

  const addAsm = () => {
    setSettings({ ...settings, asm: [...settings.asm, newAsm] });
    setNewAsm('');
    setIsModified(activeTabIdx, true);
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
        setIsModified(activeTabIdx, false);
        alert('Settings saved');
      } else {
        alert(res.message ?? 'Failed to save settings');
      }
    });
  };

  return (
    <div className="flex flex-col flex-1 w-full h-full">
      <TabBar />
      <div className="flex-1 p-4 bg-gray-100 overflow-auto font-mono text-sm">
        <h1 className="font-bold text-lg mb-2">SIC Setting</h1>
        <div className="flex flex-col gap-2">
          <div>
            <span className="font-bold">Main: </span>
            <input
              type="text"
              className="border border-gray-300 rounded-md p-1"
              value={settings.main}
              onChange={e => update({ main: e.target.value })}
            />
          </div>

          <div className="flex flex-col gap-2">
            <h2 className="font-bold">Asm List</h2>
            <ul>
              {settings.asm.map(asm => (
                <li key={asm}>
                  {asm}{' '}
                  <span
                    className="text-gray-500 text-xs"
                    onClick={() => update({ asm: settings.asm.filter(a => a !== asm) })}
                  >
                    x
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <span className="font-bold">Add Asm: </span>
            <input
              type="text"
              className="border border-gray-300 rounded-md p-1"
              value={newAsm}
              onChange={e => setNewAsm(e.target.value)}
            />
            <button className="border border-gray-300 rounded-md p-1" onClick={addAsm}>
              Add
            </button>
          </div>

          <div className="flex flex-col gap-2 mt-4">
            <h2 className="font-bold">Device List</h2>
            <ul className="divide-y rounded border bg-white">
              {devices.map(d => (
                <li key={d.index} className="flex items-center justify-between px-2 py-1">
                  <span className="font-mono text-xs">{toHexByte(d.index)}</span>
                  <span className="flex-1 px-2 truncate font-mono text-sm">{d.filename}</span>
                  <button
                    className="text-xs text-gray-500"
                    onClick={() =>
                      update({ filedevices: devices.filter(x => x.index !== d.index) })
                    }
                  >
                    x
                  </button>
                </li>
              ))}
              {devices.length === 0 && (
                <li className="px-2 py-1 text-xs text-gray-400">No device mapped</li>
              )}
            </ul>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm">Add Device :</span>
              <select
                className="border border-gray-300 rounded-md px-2 py-1 text-sm font-mono"
                value={deviceIndex}
                onChange={e => setDeviceIndex(parseInt(e.target.value, 16))}
              >
                {DEVICE_INDEXES.map(i => (
                  <option key={i} value={i.toString(16)}>
                    {toHexByte(i)}
                  </option>
                ))}
              </select>
              <input
                type="text"
                className="border border-gray-300 rounded-md p-1 flex-1 bg-gray-100 cursor-not-allowed"
                value={devices.find(d => d.index === deviceIndex)?.filename ?? ''}
                placeholder="파일을 선택하세요"
                disabled
              />
              <button className="border px-2 py-1 rounded" onClick={pickDeviceFile}>
                …
              </button>
            </div>
          </div>
        </div>
        <button className="border border-gray-300 rounded-md p-1 mt-2" onClick={save}>
          Save
        </button>
      </div>
    </div>
  );
}
