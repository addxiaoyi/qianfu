import React, { memo } from 'react';
import { cn } from '../../utils/cn';

/**
 * Animated skeleton loading placeholder.
 */
export const Skeleton = memo(function Skeleton({
  className,
  variant = 'rounded', // 'rounded' | 'circular' | 'square'
  width,
  height,
  animate = true,
}: {
  className?: string;
  variant?: 'rounded' | 'circular' | 'square';
  width?: number | string;
  height?: number | string;
  animate?: boolean;
}) {
  const baseClass = 'skeleton-shimmer bg-gray-200 dark:bg-gray-700';
  const borderRadiusClass =
    variant === 'circular'
      ? 'rounded-full'
      : variant === 'rounded'
        ? 'rounded-md'
        : 'rounded-none';

  return (
    <div
      className={cn(
        baseClass,
        borderRadiusClass,
        animate && 'animate-pulse',
        className,
      )}
      style={{ width, height }}
    />
  );
});

/**
 * Avatar skeleton — circular shape with fixed size.
 */
export const AvatarSkeleton = memo(function AvatarSkeleton({
  size = 'md',
}: {
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  const sizeClass = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24',
  }[size];

  return <Skeleton className={cn(sizeClass, 'rounded-full')} variant="circular" />;
});

/**
 * Card skeleton for list items or detail cards.
 */
export const CardSkeleton = memo(function CardSkeleton({
  lines = 3,
}: {
  lines?: number;
}) {
  return (
    <div className="p-4 space-y-3">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      {lines > 2 && (
        <>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </>
      )}
    </div>
  );
});

/**
 * Shimmer effect for background loading state.
 */
export const Shimmer = memo(function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'shimmer-effect bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%]',
        className,
      )}
    />
  );
});
