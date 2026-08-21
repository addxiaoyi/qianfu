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
  const [isVisible, setIsVisible] = useState(false);
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
          setIsVisible(true);
        }
      },
      { rootMargin: '200px' }, // preload 200px before visible
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setIsLoaded(false);
    setHasError(false);
  }, [src, fallbackSrc]);

  const effectiveSrc = hasError ? fallbackSrc : src;
  const showPlaceholder = !isVisible || !isLoaded || !effectiveSrc;

  const aspectStyle = aspectRatio
    ? { paddingTop: aspectRatio }
    : {};

  return (
    <div ref={imgRef} className={cn('overflow-hidden relative', aspectRatio && 'relative', wrapperClassName)}>
      {aspectRatio && (
        <div
          style={aspectStyle}
          className={cn('absolute inset-0', showPlaceholder && 'bg-zinc-100')}
        />
      )}

      {showPlaceholder && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-100 text-zinc-400">
          {placeholder}
        </div>
      )}

      {isVisible && effectiveSrc && (
        <img
          src={effectiveSrc}
          alt={alt}
          className={cn(
            'w-full h-full object-cover transition-opacity duration-300',
            isLoaded ? 'opacity-100' : 'opacity-0',
            className,
          )}
          onLoad={() => setIsLoaded(true)}
          onError={() => {
            setIsLoaded(false);
            setHasError(true);
          }}
          {...rest}
        />
      )}

    </div>
  );
});
