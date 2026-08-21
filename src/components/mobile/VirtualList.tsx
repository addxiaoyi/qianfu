import React, { useState, useRef, useCallback } from 'react';
import { cn } from '../../utils/cn';

interface VirtualListProps<T> {
  data: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  itemHeight?: number | number[];
  overscan?: number;
  height?: number;
  className?: string;
  buffer?: number;
}

function VirtualList<T>({
  data,
  renderItem,
  itemHeight = 64,
  overscan = 5,
  height = 400,
  className,
  buffer = 50,
}: VirtualListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const heightArray = useRef<(number | undefined)[]>([]);

  const getItemHeight = useCallback(
    (index: number) => {
      if (Array.isArray(itemHeight)) {
        return itemHeight[index] ?? heightArray.current[index] ?? buffer;
      }
      return itemHeight;
    },
    [itemHeight, buffer],
  );

  const totalHeight = data.reduce((sum, _, i) => sum + getItemHeight(i), 0);

  // Calculate visible range
  const startIdx = Math.max(0, Math.floor(scrollTop / (Array.isArray(itemHeight) ? buffer : itemHeight)) - overscan);
  const endIdx = Math.min(
    data.length - 1,
    Math.ceil((scrollTop + height) / (Array.isArray(itemHeight) ? buffer : itemHeight)) + overscan,
  );

  const offsetY = data
    .slice(0, startIdx)
    .reduce((sum, _, i) => sum + getItemHeight(i), 0);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn('overflow-auto', className)}
      style={{ height, WebkitOverflowScrolling: 'touch' }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div
          style={{
            transform: `translateY(${offsetY}px)`,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
          }}
        >
          {data.slice(startIdx, endIdx + 1).map((item, i) => {
            const actualIndex = startIdx + i;
            return (
              <div
                key={actualIndex}
                style={{
                  height: getItemHeight(actualIndex),
                  minHeight: getItemHeight(actualIndex),
                }}
              >
                {renderItem(item, actualIndex)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default VirtualList;
