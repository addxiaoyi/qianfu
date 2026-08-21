import { useToast } from '../../hooks/use-toast';

export default function ToastViewport() {
  const { toasts, dismiss } = useToast();

  return (
    <div
      aria-live="polite"
      aria-relevant="additions"
      className="pointer-events-none fixed inset-x-4 top-4 z-[400] flex flex-col gap-3 sm:left-auto sm:w-[380px]"
    >
      {toasts.map(({ id, title, description, variant }) => {
        const destructive = variant === 'destructive';
        return (
          <div
            key={id}
            role={destructive ? 'alert' : 'status'}
            className={`pointer-events-auto rounded-2xl border px-4 py-3 shadow-xl backdrop-blur ${
              destructive
                ? 'border-red-200 bg-red-50/95 text-red-950'
                : 'border-zinc-200 bg-white/95 text-zinc-950'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                {title ? <div className="text-sm font-bold">{title}</div> : null}
                {description ? <div className="mt-1 text-sm leading-6 opacity-80">{description}</div> : null}
              </div>
              <button
                type="button"
                aria-label="关闭通知"
                onClick={() => dismiss(id)}
                className="rounded-lg px-2 py-1 text-lg leading-none opacity-60 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
              >
                ×
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
