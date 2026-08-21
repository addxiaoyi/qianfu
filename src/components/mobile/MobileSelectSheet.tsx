import React, { useEffect, useId, useRef } from 'react';
import { Check, X } from 'lucide-react';

export interface MobileSelectOption<T extends string> {
  value: T;
  label: string;
  description?: string;
}

interface MobileSelectSheetProps<T extends string> {
  open: boolean;
  title: string;
  value: T;
  options: readonly MobileSelectOption<T>[];
  onChange: (value: T) => void;
  onClose: () => void;
}

const MobileSelectSheet = <T extends string>({
  open,
  title,
  value,
  options,
  onChange,
  onClose,
}: MobileSelectSheetProps<T>) => {
  const titleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => closeButtonRef.current?.focus());

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[230] flex items-end bg-black/45 p-0 backdrop-blur-[2px]"
      role="presentation"
      onClick={onClose}
    >
      <section
        className="w-full rounded-t-[1.75rem] bg-white pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onClose();
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
          <h2 id={titleId} className="text-base font-black text-zinc-950">{title}</h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="flex h-11 w-11 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-950"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="max-h-[min(60vh,28rem)] overflow-y-auto px-3 py-3">
          {options.map((option) => {
            const selected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  onChange(option.value);
                  onClose();
                }}
                className="flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 text-left transition-colors hover:bg-zinc-50 active:bg-zinc-100"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-black text-zinc-900">{option.label}</span>
                  {option.description ? <span className="mt-0.5 block text-xs font-medium text-zinc-400">{option.description}</span> : null}
                </span>
                {selected ? <Check className="h-5 w-5 shrink-0 text-zinc-950" aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default MobileSelectSheet;
