/**
 * 骨架屏组件库
 * 优化项23: 骨架屏缓存 - Loading状态
 *
 * 提供多种预设骨架屏组件，支持缓存优化
 */
import React, { memo, useMemo } from 'react';

// ============================================================
// 基础骨架屏原子组件
// ============================================================

/** 基础骨架块 */
export const SkeletonBlock = memo<{
  width?: string | number;
  height?: string | number;
  borderRadius?: string;
  className?: string;
}>(({ width = '100%', height = 16, borderRadius = '0.5rem', className = '' }) => (
  <div
    className={`bg-zinc-100 animate-pulse ${className}`}
    style={{
      width: typeof width === 'number' ? `${width}px` : width,
      height: typeof height === 'number' ? `${height}px` : height,
      borderRadius,
    }}
  />
));

/** 圆形骨架块（用于头像等） */
export const SkeletonCircle = memo<{
  size?: string | number;
  className?: string;
}>(({ size = 40, className = '' }) => (
  <div
    className={`bg-zinc-100 rounded-full animate-pulse ${className}`}
    style={{
      width: typeof size === 'number' ? `${size}px` : size,
      height: typeof size === 'number' ? `${size}px` : size,
    }}
  />
));

/** 文本行骨架 */
export const SkeletonText = memo<{
  lines?: number;
  lastLineWidth?: string;
  className?: string;
}>(({ lines = 3, lastLineWidth = '60%', className = '' }) => (
  <div className={`space-y-2 ${className}`}>
    {Array.from({ length: lines }).map((_, i) => (
      <SkeletonBlock
        key={i}
        width={i === lines - 1 ? lastLineWidth : '100%'}
        height={14}
      />
    ))}
  </div>
));

// ============================================================
// 卡片骨架屏
// ============================================================

export interface SkeletonCardProps {
  /** 是否显示图片占位符 */
  showImage?: boolean;
  /** 是否显示标签 */
  showBadge?: boolean;
  /** 是否显示操作按钮 */
  showActions?: boolean;
  /** 图片高度 */
  imageHeight?: number;
  className?: string;
}

export const SkeletonCard = memo<SkeletonCardProps>(({
  showImage = true,
  showBadge = true,
  showActions = true,
  imageHeight = 160,
  className = '',
}) => (
  <div className={`bg-white rounded-2xl border border-zinc-100 overflow-hidden ${className}`}>
    {showImage && (
      <SkeletonBlock height={imageHeight} borderRadius="0" />
    )}
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <SkeletonBlock width={120} height={20} />
        {showBadge && <SkeletonBlock width={60} height={24} borderRadius="9999px" />}
      </div>
      <SkeletonText lines={2} />
      {showActions && (
        <div className="flex gap-2 pt-2">
          <SkeletonBlock width={80} height={32} borderRadius="0.5rem" />
          <SkeletonBlock width={80} height={32} borderRadius="0.5rem" />
        </div>
      )}
    </div>
  </div>
));

// ============================================================
// 列表骨架屏
// ============================================================

export interface SkeletonListProps {
  /** 行数 */
  rows?: number;
  /** 是否显示头像 */
  showAvatar?: boolean;
  /** 是否显示缩略图 */
  showThumbnail?: boolean;
  /** 是否显示操作 */
  showAction?: boolean;
  /** 头像大小 */
  avatarSize?: number;
  className?: string;
}

export const SkeletonList = memo<SkeletonListProps>(({
  rows = 5,
  showAvatar = true,
  showThumbnail = false,
  showAction = true,
  avatarSize = 40,
  className = '',
}) => (
  <div className={`space-y-4 ${className}`}>
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex items-center gap-4">
        {showThumbnail ? (
          <SkeletonBlock width={60} height={60} borderRadius="0.75rem" />
        ) : showAvatar ? (
          <SkeletonCircle size={avatarSize} />
        ) : null}
        <div className="flex-1 space-y-2">
          <SkeletonBlock width="70%" height={16} />
          <SkeletonBlock width="40%" height={12} />
        </div>
        {showAction && (
          <SkeletonBlock width={60} height={32} borderRadius="0.5rem" />
        )}
      </div>
    ))}
  </div>
));

// ============================================================
// 表格骨架屏
// ============================================================

export interface SkeletonTableProps {
  /** 列数 */
  columns?: number;
  /** 行数 */
  rows?: number;
  /** 列宽配置 */
  columnWidths?: number[];
  /** 是否显示复选框列 */
  showCheckbox?: boolean;
  className?: string;
}

export const SkeletonTable = memo<SkeletonTableProps>(({
  columns = 4,
  rows = 5,
  columnWidths,
  showCheckbox = false,
  className = '',
}) => {
  const widths = columnWidths || Array(columns).fill(100);

  return (
    <div className={`space-y-3 ${className}`}>
      {/* 表头 */}
      <div className={`flex items-center gap-4 pb-3 border-b border-zinc-100 ${showCheckbox ? '' : ''}`}>
        {showCheckbox && <SkeletonBlock width={20} height={20} borderRadius="0.25rem" />}
        {widths.map((w, i) => (
          <SkeletonBlock key={i} width={w} height={14} />
        ))}
      </div>
      {/* 表格行 */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex items-center gap-4 py-3">
          {showCheckbox && <SkeletonBlock width={20} height={20} borderRadius="0.25rem" />}
          {widths.map((w, i) => (
            <SkeletonBlock key={i} width={w} height={14} />
          ))}
        </div>
      ))}
    </div>
  );
});

// ============================================================
// 表单骨架屏
// ============================================================

export interface SkeletonFormProps {
  /** 字段组数 */
  groups?: number;
  /** 每组字段数 */
  fieldsPerGroup?: number;
  /** 是否显示提交按钮 */
  showSubmit?: boolean;
  className?: string;
}

export const SkeletonForm = memo<SkeletonFormProps>(({
  groups = 2,
  fieldsPerGroup = 2,
  showSubmit = true,
  className = '',
}) => (
  <div className={`space-y-6 ${className}`}>
    {Array.from({ length: groups }).map((_, groupIndex) => (
      <div key={groupIndex} className="space-y-4">
        <SkeletonBlock width={80} height={12} />
        <div className={`grid grid-cols-${Math.min(fieldsPerGroup, 2)} gap-4`}>
          {Array.from({ length: fieldsPerGroup }).map((_, fieldIndex) => (
            <div key={fieldIndex} className="space-y-2">
              <SkeletonBlock width={60} height={10} />
              <SkeletonBlock height={40} />
            </div>
          ))}
        </div>
      </div>
    ))}
    {showSubmit && (
      <div className="pt-4">
        <SkeletonBlock width={120} height={44} borderRadius="2rem" />
      </div>
    )}
  </div>
));

// ============================================================
// 统计卡片骨架屏
// ============================================================

export interface SkeletonStatsProps {
  /** 卡片数量 */
  cards?: number;
  /** 是否显示趋势指标 */
  showTrend?: boolean;
  className?: string;
}

export const SkeletonStats = memo<SkeletonStatsProps>(({
  cards = 4,
  showTrend = true,
  className = '',
}) => (
  <div className={`grid grid-cols-${Math.min(cards, 4)} gap-6 ${className}`}>
    {Array.from({ length: cards }).map((_, i) => (
      <div key={i} className="p-6 bg-white rounded-2xl border border-zinc-100">
        <div className="flex items-center justify-between mb-4">
          <SkeletonCircle size={48} />
          {showTrend && <SkeletonBlock width={60} height={24} borderRadius="9999px" />}
        </div>
        <SkeletonBlock width="50%" height={32} />
        <SkeletonBlock width="70%" height={12} className="mt-2" />
      </div>
    ))}
  </div>
));

// ============================================================
// 图表骨架屏
// ============================================================

export interface SkeletonChartProps {
  /** 图表类型 */
  type?: 'bar' | 'line' | 'pie' | 'area';
  /** 数据点数量 */
  dataPoints?: number;
  /** 高度 */
  height?: number;
  className?: string;
}

export const SkeletonChart = memo<SkeletonChartProps>(({
  type = 'bar',
  dataPoints = 12,
  height = 200,
  className = '',
}) => {
  const bars = useMemo(() => (
    Array.from({ length: dataPoints }).map((_, i) => (
      <div
        key={i}
        className="flex-1 bg-zinc-100 animate-pulse rounded-t-sm"
        style={{
          height: `${20 + Math.random() * 80}%`,
          animationDelay: `${i * 50}ms`,
        }}
      />
    ))
  ), [dataPoints]);

  const lines = useMemo(() => (
    <svg viewBox="0 0 400 100" className="w-full h-full">
      <polyline
        points={Array.from({ length: dataPoints }).map((_, i) => {
          const x = (i / (dataPoints - 1)) * 400;
          const y = 20 + Math.random() * 60;
          return `${x},${y}`;
        }).join(' ')}
        fill="none"
        stroke="rgb(228 228 231)"
        strokeWidth="2"
        className="animate-pulse"
      />
    </svg>
  ), [dataPoints]);

  return (
    <div className={`bg-white rounded-2xl border border-zinc-100 p-6 ${className}`} style={{ height }}>
      <SkeletonBlock width={120} height={16} className="mb-4" />
      <div className="flex items-end gap-2 h-32">
        {type === 'bar' ? bars : type === 'line' || type === 'area' ? lines : bars}
      </div>
    </div>
  );
});

// ============================================================
// 完整页面骨架屏
// ============================================================

export interface SkeletonPageProps {
  /** 页面类型 */
  type?: 'dashboard' | 'list' | 'detail' | 'form' | 'profile';
  className?: string;
}

export const SkeletonPage = memo<SkeletonPageProps>(({
  type = 'dashboard',
  className = '',
}) => {
  const renderContent = () => {
    switch (type) {
      case 'dashboard':
        return (
          <>
            {/* 页面标题 */}
            <div className="flex items-center justify-between mb-8">
              <div className="space-y-2">
                <SkeletonBlock width={200} height={32} />
                <SkeletonBlock width={300} height={16} />
              </div>
              <SkeletonBlock width={100} height={40} borderRadius="0.5rem" />
            </div>
            {/* 统计卡片 */}
            <SkeletonStats cards={4} className="mb-8" />
            {/* 图表 */}
            <div className="grid grid-cols-2 gap-6">
              <SkeletonChart type="bar" height={280} />
              <SkeletonChart type="line" height={280} />
            </div>
          </>
        );

      case 'list':
        return (
          <>
            <div className="flex items-center justify-between mb-6">
              <SkeletonBlock width={150} height={28} />
              <SkeletonBlock width={200} height={40} borderRadius="0.5rem" />
            </div>
            <SkeletonList rows={8} showAvatar showAction />
          </>
        );

      case 'detail':
        return (
          <>
            <div className="flex items-center gap-4 mb-8">
              <SkeletonCircle size={80} />
              <div className="space-y-2">
                <SkeletonBlock width={200} height={28} />
                <SkeletonBlock width={150} height={16} />
              </div>
            </div>
            <SkeletonForm groups={3} fieldsPerGroup={2} />
          </>
        );

      case 'form':
        return (
          <>
            <SkeletonBlock width={200} height={32} className="mb-8" />
            <SkeletonForm groups={4} fieldsPerGroup={2} showSubmit />
          </>
        );

      case 'profile':
        return (
          <>
            <div className="flex flex-col items-center mb-12">
              <SkeletonCircle size={120} className="mb-4" />
              <SkeletonBlock width={150} height={24} className="mb-2" />
              <SkeletonBlock width={100} height={14} />
            </div>
            <SkeletonForm groups={2} fieldsPerGroup={1} />
          </>
        );

      default:
        return <SkeletonText lines={5} />;
    }
  };

  return (
    <div className={`p-8 ${className}`}>
      {renderContent()}
    </div>
  );
});

// ============================================================
// 导出所有骨架屏组件
// ============================================================

export const Skeletons = {
  Block: SkeletonBlock,
  Circle: SkeletonCircle,
  Text: SkeletonText,
  Card: SkeletonCard,
  List: SkeletonList,
  Table: SkeletonTable,
  Form: SkeletonForm,
  Stats: SkeletonStats,
  Chart: SkeletonChart,
  Page: SkeletonPage,
};

export default Skeletons;
