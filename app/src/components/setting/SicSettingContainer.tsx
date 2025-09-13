import { useProjectStore } from '@/stores/ProjectStore';
import TabBar from '../editor/TabBar';
import { useState, useEffect } from 'react';
import { useEditorTabStore } from '@/stores/EditorTabStore';

export default function SicSettingContainer() {
  const { settings, setSettings, saveSettings } = useProjectStore();
  const { activeTabIdx, setIsModified } = useEditorTabStore();
  const [newAsm, setNewAsm] = useState('');
  const [deviceIndex, setDeviceIndex] = useState<number>(0);
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        e.stopPropagation();
        saveSettings().then((res: { success: boolean; message?: string }) => {
          if (res.success) {
            setIsModified(activeTabIdx, false);
          }
        });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [saveSettings, activeTabIdx, setIsModified]);
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
              onChange={e => {
                setSettings({ ...settings, main: e.target.value });
                setIsModified(activeTabIdx, true);
              }}
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
                    onClick={() => {
                      setSettings({ ...settings, asm: settings.asm.filter(a => a !== asm) });
                      setIsModified(activeTabIdx, true);
                    }}
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
              onChange={e => {
                setNewAsm(e.target.value);
              }}
            />
            <button
              className="border border-gray-300 rounded-md p-1"
              onClick={() => {
                setSettings({ ...settings, asm: [...settings.asm, newAsm] });
                setNewAsm('');
                setIsModified(activeTabIdx, true);
              }}
            >
              Add
            </button>
          </div>

          <div className="flex flex-col gap-2 mt-4">
            <h2 className="font-bold">Device List</h2>
            <ul className="divide-y rounded border bg-white">
              {(settings.filedevices || []).map(d => (
                <li key={d.index} className="flex items-center justify-between px-2 py-1">
                  <span className="font-mono text-xs">{`0x${d.index.toString(16).toUpperCase().padStart(2,'0')}`}</span>
                  <span className="flex-1 px-2 truncate font-mono text-sm">{d.filename}</span>
                  <button className="text-xs text-gray-500" onClick={() => {
                    const next = (settings.filedevices || []).filter(x => x.index !== d.index);
                    setSettings({ ...settings, filedevices: next });
                    setIsModified(activeTabIdx, true);
                  }}>x</button>
                </li>
              ))}
              {(settings.filedevices || []).length === 0 && (
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
                {Array.from({ length: 256 }, (_, i) => i).map(i => (
                  <option key={i} value={i.toString(16)}>{`0x${i.toString(16).toUpperCase().padStart(2,'0')}`}</option>
                ))}
              </select>
              <input
                type="text"
                className="border border-gray-300 rounded-md p-1 flex-1 bg-gray-100 cursor-not-allowed"
                value={(settings.filedevices || []).find(d => d.index === deviceIndex)?.filename ?? ''}
                placeholder="파일을 선택하세요"
                disabled
              />
              <button
                className="border px-2 py-1 rounded"
                onClick={async () => {
                  const res = await window.api.pickFile();
                  if (res.success && res.data) {
                    const filename = res.data as string;
                    const next = (settings.filedevices || []).filter(d => d.index !== deviceIndex).concat([{ index: deviceIndex, filename }]);
                    setSettings({ ...settings, filedevices: next });
                    setIsModified(activeTabIdx, true);
                  }
                }}
              >
                …
              </button>
            </div>
          </div>
        </div>
        <button
          className="border border-gray-300 rounded-md p-1 mt-2"
          onClick={() => {
            saveSettings().then((res: { success: boolean; message?: string }) => {
              if (res.success) {
                setIsModified(activeTabIdx, false);
                alert('Settings saved');
              } else {
                alert(res.message ?? 'Failed to save settings');
              }
            });
          }}
        >
          Save
        </button>
      </div>
    </div>
  );
}
