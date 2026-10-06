import { AlertTriangle, FileUp, Minus, Unplug } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { ProjectSettings as Settings } from '@shared/ipc';
import { useEditorTabStore } from '@/features/editor/editorTabStore';
import TabBar from '@/features/editor/TabBar';
import { usableDevicePaths } from '@/features/project/devicePaths';
import { useProjectStore } from '@/features/project/projectStore';
import { useStrings } from '@/i18n';
import { FORM_BUTTON, FORM_FIELD, INLINE_ICON_BUTTON } from '@/lib/controls';
import { resolveInProject, toProjectRelativePath } from '@/lib/projectPath';
import { cn } from '@/lib/utils';
import { showError } from '@/stores/dialogStore';
import { notify } from '@/stores/toastStore';

const toHexByte = (value: number) => value.toString(16).toUpperCase().padStart(2, '0');

/**
 * Which of these absolute paths pass `test` (by default: exist), re-checked when the list
 * changes. Device files use usableDevicePaths: an output file need not exist yet.
 */
function useExisting(
  paths: string[],
  test: (paths: string[]) => Promise<boolean[] | undefined> = async p => {
    const res = await window.api.pathExists(p);
    return res.success ? res.data : undefined;
  },
) {
  const [exists, setExists] = useState<Record<string, boolean>>({});
  const key = paths.join('\n');
  useEffect(() => {
    let current = true;
    void test(paths).then(result => {
      if (current && result) {
        setExists(Object.fromEntries(paths.map((p, i) => [p, result[i]])));
      }
    });
    return () => {
      current = false;
    };
    // `key` stands for `paths`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return (p: string) => exists[p] !== false;
}

function Missing({ label }: { label: string }) {
  return (
    <span className="flex shrink-0 items-center gap-1 text-xs text-amber-700" title={label}>
      <AlertTriangle className="size-3.5" aria-hidden />
      {label}
    </span>
  );
}

/** Editor for project.sic, shown while its tab is active: main module, asm files, file devices. */
export default function ProjectSettings() {
  const t = useStrings();
  const settings = useProjectStore(s => s.settings);
  const projectPath = useProjectStore(s => s.projectPath);
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
  const [deviceInput, setDeviceInput] = useState('05');

  const devices = settings.filedevices || [];
  const absolute = (file: string) => resolveInProject(projectPath, file);
  const asmExists = useExisting(settings.asm.map(absolute));
  const deviceExists = useExisting(
    devices.map(d => absolute(d.filename)),
    paths => usableDevicePaths(projectPath, paths),
  );

  /** Apply a change to the settings and mark the tab as modified. */
  const update = (changed: Partial<Settings>) => {
    setSettings({ ...settings, ...changed });
    setIsModified(true);
  };

  const save = useCallback(() => {
    void saveSettings().then(res => {
      if (res.success) {
        setIsModified(false);
        notify('success', t.settings.saved);
      } else {
        void showError(t.messages.saveFailed('project.sic'), res.message);
      }
    });
  }, [saveSettings, setIsModified, t]);

  // Ctrl+S / Cmd+S saves the settings.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        e.stopPropagation();
        save();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [save]);

  const addAsm = () => {
    const file = newAsm.trim();
    if (!file || settings.asm.includes(file)) return;
    update({ asm: [...settings.asm, file] });
    setNewAsm('');
  };

  const deviceIndex = /^[0-9a-f]{1,2}$/i.test(deviceInput.trim())
    ? parseInt(deviceInput.trim(), 16)
    : null;

  /**
   * Connect the device number to a file chosen in the file picker. A file inside the project
   * is kept relative to it, so that the project works on another computer too.
   */
  const pickDeviceFile = async () => {
    if (deviceIndex === null) return;
    const res = await window.api.pickFile();
    if (res.success && res.data) {
      // Inside the project: relative, with '/' (works on every system); outside: as it is.
      const filename = toProjectRelativePath(projectPath, res.data);
      const others = devices.filter(d => d.index !== deviceIndex);
      update({
        filedevices: [...others, { index: deviceIndex, filename }].sort(
          (a, b) => a.index - b.index,
        ),
      });
    }
  };

  return (
    <div className="flex flex-col flex-1 w-full h-full">
      <TabBar />
      <div className="slim-scroll flex-1 overflow-auto bg-gray-100 p-4 text-sm">
        <div className="flex max-w-2xl flex-col gap-6">
          <h1 className="text-base font-semibold">{t.settings.title}</h1>

          <section className="flex flex-col gap-1.5">
            <label className="font-semibold" htmlFor="sic-main">
              {t.settings.main}
            </label>
            <input
              id="sic-main"
              type="text"
              className={`${FORM_FIELD} w-full max-w-xs font-mono`}
              value={settings.main}
              onChange={e => update({ main: e.target.value })}
            />
            <p className="text-xs text-gray-600">{t.settings.mainHint}</p>
          </section>

          <section className="flex flex-col gap-1.5">
            <h2 className="font-semibold">{t.settings.asmList}</h2>
            <p className="text-xs text-gray-600">{t.settings.asmHint}</p>
            <ul className="divide-y divide-gray-200 rounded border border-gray-300 bg-white">
              {settings.asm.map(asm => (
                <li key={asm} className="flex items-center gap-2 px-2 py-1">
                  <span className="min-w-0 flex-1 truncate font-mono" title={asm}>
                    {asm}
                  </span>
                  {!asmExists(absolute(asm)) && <Missing label={t.settings.missingFile} />}
                  <button
                    className={INLINE_ICON_BUTTON}
                    title={t.settings.remove}
                    aria-label={t.settings.remove}
                    onClick={() => update({ asm: settings.asm.filter(a => a !== asm) })}
                  >
                    <Minus width={14} height={14} />
                  </button>
                </li>
              ))}
              {settings.asm.length === 0 && (
                <li className="px-2 py-1 text-xs text-gray-600">{t.settings.noFile}</li>
              )}
            </ul>
            <form
              className="flex flex-wrap items-center gap-2"
              onSubmit={e => {
                e.preventDefault();
                addAsm();
              }}
            >
              <input
                type="text"
                aria-label={t.settings.asmList}
                placeholder={t.settings.asmPlaceholder}
                className={`${FORM_FIELD} min-w-0 flex-1 basis-40 font-mono`}
                value={newAsm}
                onChange={e => setNewAsm(e.target.value)}
              />
              <button type="submit" className={FORM_BUTTON}>
                {t.settings.add}
              </button>
            </form>
          </section>

          <section className="flex flex-col gap-1.5">
            <h2 className="font-semibold">{t.settings.devices}</h2>
            <p className="text-xs text-gray-600">{t.settings.devicesHint}</p>
            <ul className="divide-y divide-gray-200 rounded border border-gray-300 bg-white">
              {devices.map(d => (
                <li key={d.index} className="flex items-center gap-2 px-2 py-1">
                  <span className="w-8 shrink-0 font-mono text-xs font-semibold">
                    {toHexByte(d.index)}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-mono" title={absolute(d.filename)}>
                    {d.filename}
                  </span>
                  {!deviceExists(absolute(d.filename)) && (
                    <Missing label={t.settings.fileMissing} />
                  )}
                  <button
                    className={INLINE_ICON_BUTTON}
                    title={t.settings.disconnect}
                    aria-label={t.settings.disconnect}
                    onClick={() =>
                      update({ filedevices: devices.filter(x => x.index !== d.index) })
                    }
                  >
                    <Unplug width={14} height={14} />
                  </button>
                </li>
              ))}
              {devices.length === 0 && (
                <li className="px-2 py-1 text-xs text-gray-600">{t.settings.noDevice}</li>
              )}
            </ul>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2">
                <span className="shrink-0">{t.settings.device}</span>
                <input
                  type="text"
                  inputMode="text"
                  maxLength={2}
                  aria-invalid={deviceIndex === null}
                  className={`${FORM_FIELD} w-12 text-center font-mono uppercase`}
                  value={deviceInput}
                  onChange={e => setDeviceInput(e.target.value)}
                />
              </label>
              <button
                className={cn(FORM_BUTTON, 'gap-1.5')}
                onClick={() => void pickDeviceFile()}
                disabled={deviceIndex === null}
              >
                <FileUp width={14} height={14} />
                {t.settings.chooseFile}
              </button>
            </div>
          </section>

          {/* Stays in view at the bottom: with a few devices it was below the fold at 1366x768.
              -bottom-4: a sticky box keeps clear of the scroller's p-4, and content showed in the gap. */}
          <div className="sticky -bottom-4 border-t border-gray-300 bg-gray-100 py-3">
            <button
              className="inline-flex h-8 items-center rounded-md bg-blue-600 px-4 font-medium text-white transition hover:bg-blue-700"
              onClick={save}
            >
              {t.common.save}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
