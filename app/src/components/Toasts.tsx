import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { useStrings } from '@/i18n';
import { useToastStore } from '@/stores/toastStore';

const ICONS = {
  success: <CheckCircle2 className="size-4 shrink-0 text-green-700" aria-hidden />,
  info: <Info className="size-4 shrink-0 text-blue-700" aria-hidden />,
  warning: <AlertTriangle className="size-4 shrink-0 text-amber-700" aria-hidden />,
};

/** Notices at the bottom right, above the status bar; they do not take the focus. */
export function Toasts() {
  const toasts = useToastStore(s => s.toasts);
  const dismiss = useToastStore(s => s.dismiss);
  const t = useStrings();
  if (toasts.length === 0) return null;
  return (
    <div
      className="pointer-events-none fixed right-3 bottom-9 z-50 flex w-80 max-w-[calc(100vw-1.5rem)] flex-col gap-2"
      role="status"
      aria-live="polite"
    >
      {toasts.map(toast => (
        <div
          key={toast.id}
          className="pointer-events-auto flex items-start gap-2 rounded-md border border-gray-300 bg-white p-3 text-sm text-gray-900 shadow-lg"
        >
          {ICONS[toast.tone]}
          <div className="min-w-0 flex-1">
            <p className="[overflow-wrap:anywhere]">{toast.message}</p>
            {toast.action && (
              <button
                className="mt-1 text-sm font-medium text-blue-700 hover:underline"
                onClick={() => {
                  toast.action!.run();
                  dismiss(toast.id);
                }}
              >
                {toast.action.label}
              </button>
            )}
          </div>
          <button
            className="-m-1 rounded p-1 text-gray-600 hover:bg-gray-100"
            title={t.common.dismiss}
            aria-label={t.common.dismiss}
            onClick={() => dismiss(toast.id)}
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
