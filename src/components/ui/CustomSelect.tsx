import React from 'react';
import clsx from 'clsx';
import { Check, ChevronDown } from 'lucide-react';

export interface CustomSelectOption<T extends string = string> {
  value: T;
  label: string;
  description?: string;
  disabled?: boolean;
}

interface CustomSelectProps<T extends string = string> {
  id?: string;
  name?: string;
  value: T;
  options: readonly CustomSelectOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
}

const getNextEnabledIndex = <T extends string>(
  options: readonly CustomSelectOption<T>[],
  start: number,
  step: 1 | -1,
): number => {
  if (options.length === 0) return -1;
  let index = start;
  for (let count = 0; count < options.length; count += 1) {
    index = (index + step + options.length) % options.length;
    if (!options[index]?.disabled) return index;
  }
  return -1;
};

export const CustomSelect = <T extends string,>({
  id,
  name,
  value,
  options,
  onChange,
  placeholder = '请选择',
  ariaLabel,
  disabled = false,
  className,
}: CustomSelectProps<T>) => {
  const generatedId = React.useId();
  const selectId = id || `custom-select-${generatedId}`;
  const listboxId = `${selectId}-listbox`;
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [open, setOpen] = React.useState(false);
  const selectedIndex = options.findIndex((option) => option.value === value);
  const [highlightedIndex, setHighlightedIndex] = React.useState(selectedIndex >= 0 ? selectedIndex : 0);
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  React.useEffect(() => {
    if (!open) return;
    setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : getNextEnabledIndex(options, -1, 1));

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [open, options, selectedIndex]);

  const choose = (index: number) => {
    const option = options[index];
    if (!option || option.disabled) return;
    onChange(option.value);
    setOpen(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      if (!open) {
        setOpen(true);
        return;
      }
      setHighlightedIndex((current) => getNextEnabledIndex(options, current, step));
      return;
    }
    if ((event.key === 'Enter' || event.key === ' ') && open) {
      event.preventDefault();
      choose(highlightedIndex);
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      setOpen(true);
      setHighlightedIndex(getNextEnabledIndex(options, -1, 1));
    }
    if (event.key === 'End') {
      event.preventDefault();
      setOpen(true);
      setHighlightedIndex(getNextEnabledIndex(options, 0, -1));
    }
  };

  return (
    <div ref={rootRef} className={clsx('relative', className)}>
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <button
        id={selectId}
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={open && highlightedIndex >= 0 ? `${selectId}-option-${highlightedIndex}` : undefined}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={handleKeyDown}
        className="flex min-h-12 w-full items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-left text-sm font-bold text-zinc-900 shadow-sm outline-none transition hover:border-zinc-300 focus-visible:border-black focus-visible:ring-4 focus-visible:ring-black/5 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="min-w-0">
          <span className={clsx('block truncate', !selectedOption && 'text-zinc-400')}>
            {selectedOption?.label || placeholder}
          </span>
          {selectedOption?.description ? (
            <span className="mt-0.5 block truncate text-[11px] font-medium text-zinc-400">
              {selectedOption.description}
            </span>
          ) : null}
        </span>
        <ChevronDown className={clsx('h-4 w-4 shrink-0 text-zinc-400 transition-transform', open && 'rotate-180')} />
      </button>

      {open ? (
        <div
          id={listboxId}
          role="listbox"
          aria-labelledby={selectId}
          className="absolute z-50 mt-2 w-full overflow-hidden rounded-2xl border border-zinc-200 bg-white p-1.5 shadow-[0_24px_70px_rgba(0,0,0,0.16)]"
        >
          {options.map((option, index) => {
            const selected = option.value === value;
            const highlighted = index === highlightedIndex;
            return (
              <button
                id={`${selectId}-option-${index}`}
                key={option.value}
                type="button"
                role="option"
                aria-selected={selected}
                disabled={option.disabled}
                onMouseEnter={() => setHighlightedIndex(index)}
                onClick={() => choose(index)}
                className={clsx(
                  'flex w-full items-center justify-between gap-4 rounded-xl px-3 py-2.5 text-left transition',
                  highlighted ? 'bg-zinc-950 text-white' : 'text-zinc-700 hover:bg-zinc-50',
                  option.disabled && 'cursor-not-allowed opacity-40',
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-black">{option.label}</span>
                  {option.description ? (
                    <span className={clsx('mt-0.5 block truncate text-[11px] font-medium', highlighted ? 'text-white/60' : 'text-zinc-400')}>
                      {option.description}
                    </span>
                  ) : null}
                </span>
                <Check className={clsx('h-4 w-4 shrink-0', selected ? 'opacity-100' : 'opacity-0')} />
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};

export default CustomSelect;
