import { useState, useEffect } from "react";

export interface ToastProps {
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
}

let toastCount = 0;
const observers: Array<(toasts: (ToastProps & { id: string })[]) => void> = [];
let toasts: (ToastProps & { id: string })[] = [];

export function toast(props: ToastProps) {
  const id = (++toastCount).toString();
  toasts = [...toasts, { ...props, id }];
  observers.forEach((observer) => observer(toasts));
  
  setTimeout(() => {
    dismiss(id);
  }, 3000);
}

export function dismiss(id: string) {
  const nextToasts = toasts.filter((toastItem) => toastItem.id !== id);
  if (nextToasts.length === toasts.length) return;
  toasts = nextToasts;
  observers.forEach((observer) => observer(toasts));
}

export function useToast() {
  const [activeToasts, setActiveToasts] = useState<(ToastProps & { id: string })[]>(toasts);

  useEffect(() => {
    observers.push(setActiveToasts);
    return () => {
      const index = observers.indexOf(setActiveToasts);
      if (index > -1) observers.splice(index, 1);
    };
  }, []);

  return { toasts: activeToasts, toast, dismiss };
}
