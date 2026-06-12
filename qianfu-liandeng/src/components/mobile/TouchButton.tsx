import React, { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../utils/cn';

export type TouchButtonSize = 'sm' | 'md' | 'lg';

interface TouchButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onDrag' | 'onDragStart' | 'onDragEnd' | 'onDrop'> {
  size?: TouchButtonSize;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
  fullWidth?: boolean;
  loading?: boolean;
  onPress?: () => void;
  onPressIn?: () => void;
  onPressOut?: () => void;
}

const TouchButton = forwardRef<HTMLButtonElement, TouchButtonProps>(
  (
    {
      size = 'md',
      variant = 'primary',
      fullWidth = false,
      loading = false,
      disabled,
      className,
      children,
      onPress,
      onPressIn,
      onPressOut,
      ...rest
    },
    ref,
  ) => {
    const sizeClasses: Record<TouchButtonSize, string> = {
      sm: 'min-h-[40px] min-w-[40px] text-xs px-3 py-2',
      md: 'min-h-[48px] min-w-[48px] text-sm px-4 py-3',
      lg: 'min-h-[56px] text-base px-6 py-4',
    };

    const variantClasses: Record<string, string> = {
      primary: 'bg-black text-white active:bg-zinc-800',
      secondary: 'bg-zinc-100 text-zinc-900 active:bg-zinc-200',
      ghost: 'bg-transparent text-zinc-900 active:bg-zinc-100',
      danger: 'bg-red-500 text-white active:bg-red-600',
      outline:
        'bg-transparent border-2 border-black text-zinc-900 active:bg-zinc-50',
    };

    return (
      <motion.button type="button"
        ref={ref}
        whileTap={{ scale: 0.96 }}
        whileHover={{ scale: disabled ? 1 : 0.98 }}
        className={cn(
          'relative inline-flex items-center justify-center font-bold rounded-xl transition-colors select-none touch-manipulation',
          sizeClasses[size],
          variantClasses[variant],
          fullWidth && 'w-full',
          (disabled || loading) && 'opacity-50 pointer-events-none',
          className,
        )}
        disabled={disabled || loading}
        onClick={onPress}
        onTouchStart={() => onPressIn?.()}
        onTouchEnd={() => onPressOut?.()}
        {...(rest as any)}
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {!loading && children}
      </motion.button>
    );
  },
);

TouchButton.displayName = 'TouchButton';

export default TouchButton;
