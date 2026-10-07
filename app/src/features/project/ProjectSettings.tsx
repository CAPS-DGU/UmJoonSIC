import { AlertTriangle } from 'lucide-react';
import { useEffect, useState } from 'react';
import TabBar from '@/features/editor/TabBar';
import { AsmOrderList } from '@/features/project/AsmOrderList';
import { useMainFile, useProjectSources } from '@/features/devices/useProjectSources';
import { DeviceTable } from '@/features/project/DeviceTable';
import { useProjectStore } from '@/features/project/projectStore';
import { useStrings } from '@/i18n';
import { FORM_BUTTON, FORM_FIELD } from '@/lib/controls';
import { resolveInProject } from '@/lib/projectPath';
import { notify } from '@/stores/toastStore';

/** Which of these absolute paths exist (re-checked when the list changes). */
function useExisting(paths: string[]) {
  const [exists, setExists] = useState<Record<string, boolean>>({});
  const key = paths.join('\n');
  useEffect(() => {
    let current = true;
    void window.api.pathExists(paths).then(res => {
      if (current && res.success && res.data) {
        setExists(Object.fromEntries(paths.map((p, i) => [p, res.data![i]])));
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

/**
 * The project settings (they edit project.sic), shown while their tab is active: the main
 * program, the assembled files in their order, the devices. Every change is written at once:
 * no Save button next to changes that apply by themselves, and removals can be undone.
 */
export default function ProjectSettings() {
  const t = useStrings();
  const settings = useProjectStore(s => s.settings);
  const projectPath = useProjectStore(s => s.projectPath);
  const changeSettings = useProjectStore(s => s.changeSettings);
  const fileTree = useProjectStore(s => s.fileTree);
  const [main, setMain] = useState(settings.main);
  const [newAsm, setNewAsm] = useState('');

  // Another project, or a change from elsewhere: show the saved name.
  useEffect(() => setMain(settings.main), [settings.main]);

  const absolute = (file: string) => resolveInProject(projectPath, file);
  const asmExists = useExisting(settings.asm.map(absolute));
  const unlistedAsm = fileTree
    .map(f => f.relativePath)
    .filter(p => /\.asm$/i.test(p) && !settings.asm.includes(p))
    .sort();
  const sources = useProjectSources();
  const mainFile = useMainFile(sources);
  // The names main can give: the sections the files define (START, CSECT).
  const sectionNames = settings.asm.flatMap(file => sources.sections[file] ?? []);

  const saveMain = () => {
    const value = main.trim();
    if (value !== settings.main) void changeSettings({ main: value });
  };

  // Ctrl+S writes the main program's name now (everything else is written as it changes).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        e.stopPropagation();
        saveMain();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const changeAsm = async (asm: string[]) => {
    const before = settings.asm;
    const ok = await changeSettings({ asm });
    // A file taken off the list: say so, with the way back.
    const removed = before.find(file => !asm.includes(file));
    if (ok && removed && asm.length < before.length) {
      notify('info', t.settings.removedAsm(removed), {
        label: t.settings.undo,
        run: () => void changeSettings({ asm: before }),
      });
    }
  };

  const addAsm = () => {
    const file = newAsm.trim();
    if (!file || settings.asm.includes(file)) return;
    void changeSettings({ asm: [...settings.asm, file] });
    setNewAsm('');
  };

  return (
    <div className="flex flex-col flex-1 w-full h-full">
      <TabBar />
      <div className="slim-scroll flex-1 overflow-auto bg-gray-100 p-4 text-sm">
        <div className="flex max-w-3xl flex-col gap-6">
          <header className="flex flex-wrap items-baseline justify-between gap-2">
            <h1 className="text-base font-semibold">{t.settings.title}</h1>
            <span className="text-xs text-gray-600">{t.settings.autosave}</span>
          </header>

          <section className="flex flex-col gap-1.5">
            <label className="font-semibold" htmlFor="sic-main">
              {t.settings.main}
            </label>
            <input
              id="sic-main"
              type="text"
              list="asm-module-names"
              className={`${FORM_FIELD} w-full max-w-xs font-mono`}
              value={main}
              onChange={e => setMain(e.target.value)}
              onBlur={saveMain}
              onKeyDown={e => e.key === 'Enter' && saveMain()}
            />
            <datalist id="asm-module-names">
              {sectionNames.map(name => (
                <option key={name} value={name} />
              ))}
            </datalist>
            <p className="text-xs text-gray-600">{t.settings.mainHint}</p>
            {settings.main.trim() && settings.asm.length > 1 && mainFile === null && (
              <p className="flex items-center gap-1 text-xs text-amber-800" data-main-not-found>
                <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
                {t.settings.mainNotFound(settings.main)}
              </p>
            )}
          </section>

          <section className="flex flex-col gap-1.5">
            <h2 className="font-semibold">{t.settings.asmList}</h2>
            <p className="text-xs text-gray-600">{t.settings.asmHint}</p>
            <AsmOrderList
              files={settings.asm}
              mainFile={mainFile}
              onChange={asm => void changeAsm(asm)}
              missing={asm => !asmExists(absolute(asm))}
              missingMark={<Missing label={t.settings.missingFile} />}
            />
            <form
              className="flex flex-wrap items-center gap-2"
              onSubmit={e => {
                e.preventDefault();
                addAsm();
              }}
            >
              <input
                type="text"
                list="unlisted-asm-files"
                aria-label={t.settings.asmList}
                placeholder={t.settings.asmPlaceholder}
                className={`${FORM_FIELD} min-w-0 flex-1 basis-40 font-mono`}
                value={newAsm}
                onChange={e => setNewAsm(e.target.value)}
              />
              {/* The project's .asm files that are not assembled yet, as suggestions. */}
              <datalist id="unlisted-asm-files">
                {unlistedAsm.map(file => (
                  <option key={file} value={file} />
                ))}
              </datalist>
              <button type="submit" className={FORM_BUTTON}>
                {t.settings.add}
              </button>
            </form>
          </section>

          <section className="flex flex-col gap-1.5">
            <h2 className="font-semibold">{t.settings.devices}</h2>
            <p className="text-xs text-gray-600">{t.settings.devicesHint}</p>
            <DeviceTable />
          </section>
        </div>
      </div>
    </div>
  );
}
