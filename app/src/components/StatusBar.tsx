import { CircleStop, CircleX, Moon, PauseCircle, PlayCircle, Settings2, Sun } from 'lucide-react';
import { useRegisterStore } from '@/features/debugger/registerStore';
import { formatAddress, useRunningStore } from '@/features/debugger/runningStore';
import { selectActiveTab, useEditorTabStore } from '@/features/editor/editorTabStore';
import { useErrorStore } from '@/features/panel/errorStore';
import { useStrings } from '@/i18n';
import { openPreferences, usePreferencesStore } from '@/stores/preferencesStore';

/** What the run is doing, in words, with its colour (status bar, left). */
function RunState() {
  const t = useStrings();
  const { isRunning, isStarting, isPaused, isHalted, stopReason, stepCount, rate, loadFailed } =
    useRunningStore();
  const hasErrors = useErrorStore(s => Object.keys(s.errors).length > 0);
  const pc = useRegisterStore(s => s.PC);

  if (isStarting)
    return (
      <span className="text-gray-700" data-run-state="assembling">
        {t.state.assembling}
      </span>
    );
  // Run or Step found errors: say why nothing runs, until they are fixed or the next try.
  if (!isRunning && loadFailed && hasErrors)
    return (
      <span
        className="flex items-center gap-1 font-medium text-red-700"
        data-run-state="load-failed"
      >
        <CircleX className="size-3.5" aria-hidden />
        {t.state.loadFailed}
      </span>
    );
  if (!isRunning)
    return (
      <span className="text-gray-700" data-run-state="ready">
        {t.state.ready}
      </span>
    );
  if (isHalted) {
    return (
      <span
        className="flex items-center gap-1 font-medium text-gray-900"
        title={t.state.haltedHint}
        data-run-state="halted"
      >
        <CircleStop className="size-3.5 text-red-600" aria-hidden />
        {t.state.halted(formatAddress(pc), stepCount)}
      </span>
    );
  }
  if (!isPaused) {
    return (
      <span className="flex items-center gap-1 text-green-800" data-run-state="running">
        <PlayCircle className="size-3.5" aria-hidden />
        {t.state.running(rate > 0 ? String(rate) : '…')}
      </span>
    );
  }
  return (
    <span
      className="flex items-center gap-1 text-amber-700"
      data-run-state={stopReason === 'breakpoint' ? 'breakpoint' : 'paused'}
    >
      <PauseCircle className="size-3.5" aria-hidden />
      {stopReason === 'breakpoint'
        ? t.state.breakpoint(formatAddress(pc))
        : t.state.paused(formatAddress(pc))}
    </span>
  );
}

/**
 * Bottom bar: the run's state (left), then the cursor position, the language and the theme.
 * Neutral colours: a red bar read as an error (usage study, 2026-10-06).
 */
export default function StatusBar() {
  const t = useStrings();
  const activeTab = useEditorTabStore(selectActiveTab);
  const { language, theme, setLanguage, setTheme } = usePreferencesStore();

  // Always shown, so the layout does not jump when the last tab closes.
  return (
    <div
      className="flex h-6 shrink-0 items-center justify-between gap-3 border-t border-gray-300 bg-gray-100 px-2 text-xs"
      data-statusbar
    >
      <div className="min-w-0 truncate" role="status" aria-live="polite">
        <RunState />
      </div>
      <div className="flex shrink-0 items-center gap-1 text-gray-700">
        {activeTab && (
          <span className="px-1 tabular-nums">
            {t.status.lineCol(activeTab.cursor.line, activeTab.cursor.column)}
          </span>
        )}
        <button
          type="button"
          className="rounded px-1.5 py-0.5 font-medium hover:bg-gray-200"
          title={t.status.language}
          aria-label={t.status.language}
          onClick={() => setLanguage(language === 'ko' ? 'en' : 'ko')}
        >
          {language === 'ko' ? '한국어' : 'English'}
        </button>
        <button
          type="button"
          className="rounded p-1 hover:bg-gray-200"
          title={theme === 'dark' ? t.status.themeToLight : t.status.themeToDark}
          aria-label={theme === 'dark' ? t.status.themeToLight : t.status.themeToDark}
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          {theme === 'dark' ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
        </button>
        <button
          type="button"
          className="rounded p-1 hover:bg-gray-200"
          title={t.status.preferences}
          aria-label={t.status.preferences}
          onClick={openPreferences}
        >
          <Settings2 className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
