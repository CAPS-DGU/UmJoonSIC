import { Minus, Plus, RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AppEvent } from '@shared/ipc';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { INTERVALS_MS } from '@/features/debugger/intervals';
import { useRunningStore } from '@/features/debugger/runningStore';
import { useStrings } from '@/i18n';
import { FORM_FIELD, INLINE_ICON_BUTTON } from '@/lib/controls';
import { usePreferencesStore } from '@/stores/preferencesStore';

const MIN_FONT = 10;
const MAX_FONT = 28;

/**
 * The app's preferences: kept by the main process (ui-preferences.json), so they stay after a
 * restart. All apply at once except the simulator's port, which applies at the next start.
 */
export default function PreferencesDialog() {
  const t = useStrings();
  const [open, setOpen] = useState(false);
  const prefs = usePreferencesStore();
  const delayTime = useRunningStore(s => s.delayTime);
  const setDelayTime = useRunningStore(s => s.setDelayTime);
  const [portText, setPortText] = useState(String(prefs.simulatorPort));
  const [portError, setPortError] = useState('');
  const portInUse = open ? window.api.simulatorPortInUse() : prefs.simulatorPort;

  useEffect(() => {
    const show = () => {
      setPortText(String(usePreferencesStore.getState().simulatorPort));
      setPortError('');
      setOpen(true);
    };
    window.addEventListener(AppEvent.openPreferences, show);
    return () => window.removeEventListener(AppEvent.openPreferences, show);
  }, []);

  const savePort = () => {
    const port = Number(portText);
    if (!Number.isInteger(port) || port < 1024 || port > 65535) {
      setPortError(t.preferences.badPort);
      return;
    }
    setPortError('');
    if (port !== prefs.simulatorPort) prefs.setSimulatorPort(port);
  };
  const font = (size: number) =>
    prefs.setEditorFontSize(Math.min(MAX_FONT, Math.max(MIN_FONT, size)));
  const intervals = INTERVALS_MS.includes(delayTime)
    ? INTERVALS_MS
    : [...INTERVALS_MS, delayTime].sort((a, b) => a - b);
  const segment = (active: boolean) =>
    `rounded px-3 py-1 text-sm ${active ? 'bg-blue-600 text-white' : 'text-gray-800 hover:bg-gray-100'}`;
  const row = 'grid grid-cols-[9rem_1fr] items-start gap-3';

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-lg" aria-describedby={undefined} data-preferences>
        <DialogHeader>
          <DialogTitle>{t.preferences.title}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 text-sm">
          <div className={row}>
            <span className="pt-1 font-medium">{t.preferences.language}</span>
            <div className="flex w-fit rounded-md border border-gray-300 p-0.5" role="radiogroup">
              {(['en', 'ko'] as const).map(lang => (
                <button
                  key={lang}
                  type="button"
                  role="radio"
                  aria-checked={prefs.language === lang}
                  className={segment(prefs.language === lang)}
                  onClick={() => prefs.setLanguage(lang)}
                >
                  {lang === 'en' ? 'English' : '한국어'}
                </button>
              ))}
            </div>
          </div>
          <div className={row}>
            <span className="pt-1 font-medium">{t.preferences.theme}</span>
            <div className="flex w-fit rounded-md border border-gray-300 p-0.5" role="radiogroup">
              {(['light', 'dark'] as const).map(theme => (
                <button
                  key={theme}
                  type="button"
                  role="radio"
                  aria-checked={prefs.theme === theme}
                  className={segment(prefs.theme === theme)}
                  onClick={() => prefs.setTheme(theme)}
                >
                  {theme === 'light' ? t.preferences.light : t.preferences.dark}
                </button>
              ))}
            </div>
          </div>
          <div className={row}>
            <label className="pt-1 font-medium" htmlFor="pref-interval">
              {t.preferences.interval}
            </label>
            <div className="flex flex-col gap-1">
              <select
                id="pref-interval"
                className={`${FORM_FIELD} w-40`}
                value={String(delayTime)}
                onChange={e => setDelayTime(Number(e.target.value))}
              >
                {intervals.map(ms => (
                  <option key={ms} value={String(ms)}>
                    {ms === 0 ? t.preferences.fastest : `${ms} ms`}
                  </option>
                ))}
              </select>
              <span className="text-xs text-gray-600">{t.preferences.intervalHint}</span>
            </div>
          </div>
          <div className={row}>
            <label className="pt-1 font-medium" htmlFor="pref-font">
              {t.preferences.fontSize}
            </label>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className={INLINE_ICON_BUTTON}
                aria-label={t.preferences.smaller}
                title={t.preferences.smaller}
                disabled={prefs.editorFontSize <= MIN_FONT}
                onClick={() => font(prefs.editorFontSize - 1)}
              >
                <Minus className="size-3.5" />
              </button>
              <input
                id="pref-font"
                type="number"
                min={MIN_FONT}
                max={MAX_FONT}
                className={`${FORM_FIELD} w-16 text-center tabular-nums`}
                value={prefs.editorFontSize}
                onChange={e => {
                  const size = Number(e.target.value);
                  if (Number.isInteger(size) && size >= MIN_FONT && size <= MAX_FONT) font(size);
                }}
              />
              <button
                type="button"
                className={INLINE_ICON_BUTTON}
                aria-label={t.preferences.larger}
                title={t.preferences.larger}
                disabled={prefs.editorFontSize >= MAX_FONT}
                onClick={() => font(prefs.editorFontSize + 1)}
              >
                <Plus className="size-3.5" />
              </button>
              <span className="ml-1 text-xs text-gray-600">px</span>
            </div>
          </div>
          <div className={row}>
            <label className="pt-1 font-medium" htmlFor="pref-port">
              {t.preferences.port}
            </label>
            <div className="flex flex-col gap-1">
              <input
                id="pref-port"
                type="text"
                inputMode="numeric"
                className={`${FORM_FIELD} w-28 font-mono`}
                value={portText}
                aria-invalid={!!portError}
                onChange={e => {
                  setPortText(e.target.value);
                  setPortError('');
                }}
                onBlur={savePort}
                onKeyDown={e => e.key === 'Enter' && savePort()}
              />
              {portError ? (
                <span className="text-xs text-red-700" role="alert">
                  {portError}
                </span>
              ) : (
                <span className="text-xs text-gray-600">{t.preferences.portHint(portInUse)}</span>
              )}
              {prefs.simulatorPort !== portInUse && (
                <div className="flex flex-wrap items-center gap-2 text-xs text-amber-800">
                  {t.preferences.restartNeeded(prefs.simulatorPort)}
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 font-medium text-blue-700 hover:underline"
                    onClick={() => window.api.relaunchApp()}
                    data-restart-app
                  >
                    <RotateCcw className="size-3" aria-hidden />
                    {t.preferences.restartNow}
                  </button>
                </div>
              )}
            </div>
          </div>
          <p className="text-xs text-gray-600">{t.preferences.kept}</p>
        </div>
        <DialogFooter>
          <Button type="button" onClick={() => setOpen(false)}>
            {t.common.close}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
