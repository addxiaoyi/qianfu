import React, { useState, useCallback, useRef } from 'react';
import { motion, useMotionValue, useTransform, AnimatePresence } from 'framer-motion';
import { cn } from '../../utils/cn';

interface SwipeAction {
  label: string;
  icon?: React.ElementType;
  className?: string;
  onPress: () => void;
}

interface SwipeableItemProps {
  children: React.ReactNode;
  actions?: SwipeAction[];
  onSwipe?: (direction: 'left' | 'right') => void;
  threshold?: number;
  className?: string;
}

const SwipeableItem: React.FC<SwipeableItemProps> = ({
  children,
  actions = [],
  onSwipe,
  threshold = 100,
  className,
}) => {
  const x = useMotionValue(0);
  const [isOpen, setIsOpen] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const hasSwiped = useRef(false);

  const backgroundX = useTransform(x, [-150, 0, 150], [-150, 0, 150]);

  const handleTouchEnd = useCallback(
    (offsetX: number) => {
      const absX = Math.abs(offsetX);
      if (absX >= threshold) {
        if (offsetX > 0) {
          x.set(150);
          setSwipeDirection('right');
        } else {
          x.set(-150);
          setSwipeDirection('left');
        }
        setIsOpen(true);
        if (!hasSwiped.current) {
          hasSwiped.current = true;
          onSwipe?.(swipeDirection || (offsetX > 0 ? 'right' : 'left'));
        }
      } else {
        x.set(0);
        setIsOpen(false);
      }
    },
    [x, threshold, onSwipe, swipeDirection],
  );

  const close = useCallback(() => {
    x.set(0);
    setIsOpen(false);
  }, [x]);

  return (
    <div className={cn('relative overflow-hidden', className)}>
      {/* Action Buttons */}
      <div className="absolute inset-y-0 right-0 flex items-center">
        {actions.map((action, index) => {
          const Icon = action.icon;
          const bgColor =
            index === 0
              ? 'bg-red-500'
              : index === 1
              ? 'bg-zinc-600'
              : 'bg-zinc-400';

          return (
            <motion.button
              key={index}
              onClick={() => {
                action.onPress();
                close();
              }}
              className={cn(
                `${bgColor} text-white min-w-[80px] h-full flex items-center justify-center px-4`,
                index > 0 && 'border-l border-white/20',
              )}
              initial={{ opacity: 0, x: 20 }}
              animate={isOpen ? { opacity: 1, x: 0 } : { opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
            >
              {Icon && <Icon className="w-5 h-5" />}
              <span className="text-sm font-bold ml-2">{action.label}</span>
            </motion.button>
          );
        })}
      </div>

      {/* Swipeable Content */}
      <motion.div
        style={{ x }}
        drag="x"
        dragConstraints={{ left: actions.length > 0 ? -150 : 0, right: actions.length > 0 ? 0 : 150 }}
        dragElastic={0.1}
        onDragEnd={(_, info) => {
          if (info.offset.x !== 0) {
            handleTouchEnd(info.offset.x);
          } else {
            x.set(0);
            setIsOpen(false);
          }
        }}
        className={cn(
          'relative z-10 bg-white rounded-xl',
          'min-h-[64px] touch-pan-y',
        )}
      >
        {children}
      </motion.div>
    </div>
  );
};

export default SwipeableItem;
