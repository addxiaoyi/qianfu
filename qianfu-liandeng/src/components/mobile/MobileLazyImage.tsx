import React, { memo, useState, useRef, useEffect } from 'react';
import { cn } from '../../utils/cn';

interface MobileLazyImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'ref'> {
  fallbackSrc?: string;
  placeholder?: React.ReactNode;
  wrapperClassName?: string;
  aspectRatio?: string;
}

/**
 * Image with intersection-observer-based lazy loading.
 * Shows a placeholder / skeleton while the image is loading.
 */
export const LazyImage = memo(function LazyImage({
  src,
  fallbackSrc,
  placeholder,
  wrapperClassName,
  aspectRatio,
  className,
  alt = '',
  ...rest
}: MobileLazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);

  // Intersection observer for lazy loading
  useEffect(() => {
    const el = imgRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          observer.disconnect();
          setIsLoaded(true);
        }
      },
      { rootMargin: '200px' }, // preload 200px before visible
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const effectiveSrc = hasError && fallbackSrc ? fallbackSrc : src;

  const aspectStyle = aspectRatio
    ? { paddingTop: aspectRatio }
    : {};

  return (
    <div ref={imgRef} className={cn('overflow-hidden relative', aspectRatio && 'relative', wrapperClassName)}>
      {aspectRatio && (
        <div
          style={aspectStyle}
          className={cn('absolute inset-0', !isLoaded && 'bg-gray-200 animate-pulse')}
        />
      )}

      {!isLoaded && !aspectRatio && (
        <div className="w-full h-full bg-gray-200 animate-pulse" />
      )}

      {isLoaded && (
        <img
          src={effectiveSrc}
          alt={alt}
          className={cn(
            'w-full h-full object-cover transition-opacity duration-300',
            isLoaded && 'opacity-100',
            !isLoaded && 'opacity-0',
            className,
          )}
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
          {...rest}
        />
      )}

      {/* Render placeholder when not loaded and no aspect ratio */}
      {!isLoaded && !aspectRatio && placeholder}
    </div>
  );
});
