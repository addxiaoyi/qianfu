# 优化项23: 骨架屏缓存 - Loading状态

## 目标
减少Loading状态的视觉卡顿，提供流畅的用户体验

## 策略

### 1. 骨架屏组件库
提供多种预设骨架屏组件，支持缓存优化：

```tsx
import { 
  Skeletons, 
  SkeletonCard, 
  SkeletonList, 
  SkeletonTable,
  SkeletonPage 
} from '@/components/ui/Skeleton';

// 卡片骨架屏
<SkeletonCard showImage showBadge showActions />

// 列表骨架屏
<SkeletonList rows={10} showAvatar />

// 表格骨架屏
<SkeletonTable columns={5} rows={10} showCheckbox />

// 完整页面骨架屏
<SkeletonPage type="dashboard" />
```

### 2. 骨架屏缓存Hook
```tsx
import { useSkeletonCache, useSkeletonPlaceholder, warmupSkeletons } from '@/hooks/useSkeletonCache';

// 方式1: 使用缓存的占位符
function MyComponent() {
  const placeholder = useSkeletonPlaceholder({ rows: 5, showAvatar: true });
  return isLoading ? placeholder : <Content />;
}

// 方式2: 预热骨架屏（应用启动时调用）
warmupSkeletons({
  types: ['card', 'table', 'list'],
  delay: 1000,
  onComplete: () => console.log('预热完成')
});
```

### 3. 数据获取集成模式
```tsx
function useDataWithSkeleton<T>(fetcher: () => Promise<T>, skeletonType: 'card' | 'list' | 'table') {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetcher().then(result => {
      setData(result);
      setLoading(false);
    });
  }, [fetcher]);
  
  return { data, loading };
}
```

## 性能指标
- 首次渲染延迟: < 50ms
- 骨架屏切换: 无闪烁
- 内存占用: < 1MB

## 相关文件
- `src/components/ui/Skeleton.tsx` - 骨架屏组件库
- `src/hooks/useSkeletonCache.ts` - 缓存Hook
