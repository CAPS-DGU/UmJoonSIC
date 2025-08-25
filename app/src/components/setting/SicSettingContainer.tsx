import { useProjectStore } from '@/stores/ProjectStore';
import TabBar from '../editor/TabBar';
import { useState } from 'react';
import { useEditorTabStore } from '@/stores/EditorTabStore';

export default function SicSettingContainer() {
  const { settings, setSettings, saveSettings } = useProjectStore();
  const { tabs, activeTabIdx, setIsModified } = useEditorTabStore();
  const [newAsm, setNewAsm] = useState('');
  return (
    <div className="flex flex-col flex-1 w-full h-full">
      <TabBar />
      <div className="flex-1 p-4 bg-gray-100 overflow-auto font-mono text-sm">
        <h1 className="font-bold text-lg mb-2">SIC Setting</h1>
        <div className="flex flex-col gap-2">
        <div>
          <span className="font-bold">Main: </span>
          <input type="text" className="border border-gray-300 rounded-md p-1" value={settings.main} onChange={(e) => {
            setSettings({ ...settings, main: e.target.value });
            setIsModified(activeTabIdx, true);
          }}/>
        </div>

        <div className="flex flex-col gap-2">
          <h2 className="font-bold">Asm List</h2>
          <ul>
            {settings.asm.map((asm) => (
              <li key={asm}>{asm} <span className="text-gray-500 text-xs" onClick={() => {
                setSettings({ ...settings, asm: settings.asm.filter((a) => a !== asm) });
                setIsModified(activeTabIdx, true);
              }}>x</span></li>
            ))}
          </ul>
        </div>
        <div>
          <span className="font-bold">Add Asm: </span>
          <input type="text" className="border border-gray-300 rounded-md p-1" value={newAsm} onChange={(e) => {
            setNewAsm(e.target.value);
          }}/>
          <button className="border border-gray-300 rounded-md p-1" onClick={() => {
            setSettings({ ...settings, asm: [...settings.asm, newAsm] });
            setNewAsm('');
            setIsModified(activeTabIdx, true);
          }}>Add</button>
          </div>
        </div>
        <button className="border border-gray-300 rounded-md p-1 mt-2" onClick={() => {
          saveSettings().then((res: { success: boolean, message?: string }) => {
            if (res.success) {
              setIsModified(activeTabIdx, false);
              alert('Settings saved');
            } else {
              alert(res.message ?? 'Failed to save settings');
            }
          });
        }}>Save</button>
      </div>
    </div>
  );
}
