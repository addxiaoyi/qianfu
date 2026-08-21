# 优化项 11: 嵌套路由 - 布局嵌套

## 问题分析

当前路由结构存在以下问题：
1. **重复的布局包装** - 每个 Admin 页面都需要手动包装 `<AdminLayout><AdminXXX /></AdminLayout>`
2. **布局嵌套不一致** - Desktop 和 Mobile 中的 Admin 路由重复定义
3. **路由维护困难** - 添加新页面需要多处修改

## 优化方案

### 1. 创建嵌套布局组件

**AdminPageWrapper.tsx** - 支持嵌套路由的 Admin 布局：

```tsx
// src/components/layout/AdminPageWrapper.tsx
import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import AdminSidebar from './admin/AdminSidebar';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * AdminPageWrapper - Admin 布局支持嵌套路由
 *
 * 使用方式:
 * <Route path="/admin" element={<AdminPageWrapper />}>
 *   <Route index element={<AdminDashboard />} />
 *   <Route path="users" element={<AdminUsers />} />
 * </Route>
 */
const AdminPageWrapper: React.FC = () => {
  const location = useLocation();

  return (
    <div className="flex bg-[#fafafa] min-h-screen">
      <AdminSidebar />
      <main className="flex-grow p-12 md:p-16 overflow-y-auto relative">
        <div className="absolute top-0 right-0 p-16 pointer-events-none opacity-[0.02]">
          <div className="text-[20rem] font-black leading-none select-none italic">QF.</div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-[1400px] mx-auto relative z-10"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
};

export default AdminPageWrapper;
```

**MobilePageWrapper.tsx** - 支持嵌套路由的 Mobile 布局：

```tsx
// src/components/layout/MobilePageWrapper.tsx
import React from 'react';
import { Outlet } from 'react-router-dom';
import MobileLayout from './MobileLayout';

interface MobilePageWrapperProps {
  title?: string;
  hideNav?: boolean;
  onBack?: () => void;
}

/**
 * MobilePageWrapper - Mobile 布局支持嵌套路由
 *
 * 使用方式:
 * <Route path="/mobile" element={<MobilePageWrapper />}>
 *   <Route index element={<Home />} />
 *   <Route path="servers" element={<ServerList />} />
 * </Route>
 */
const MobilePageWrapper: React.FC<MobilePageWrapperProps> = ({
  title,
  hideNav = false,
  onBack,
}) => {
  return (
    <MobileLayout title={title} hideNav={hideNav} onBack={onBack}>
      <Outlet />
    </MobileLayout>
  );
};

export default MobilePageWrapper;
```

### 2. 更新路由配置

**App.tsx** - 使用嵌套路由结构：

```tsx
// Admin 路由 - 使用嵌套布局
<Route path="/admin" element={<RequireAdmin><AdminPageWrapper /></RequireAdmin>}>
  <Route index element={<AdminDashboard />} />
  <Route path="users" element={<AdminUsers />} />
  <Route path="review" element={<AdminReview />} />
  <Route path="tickets" element={<AdminTickets />} />
  <Route path="reports" element={<AdminReports />} />
  <Route path="audit" element={<AdminLogs />} />
  <Route path="audit-stats" element={<AdminAuditStats />} />
  <Route path="moderation" element={<AdminModeration />} />
  <Route path="port5555" element={<AdminPortSecurity />} />
  <Route path="qianfu" element={<AdminPaymentConfig />} />
  <Route path="settings" element={<AdminSettings />} />
  <Route path="mail" element={<AdminMailConfig />} />
</Route>

// Mobile 路由 - 使用嵌套布局
<Route path="/mobile" element={<MobilePageWrapper />}>
  <Route index element={<MobileHome />} />
</Route>

<Route path="/servers" element={<MobilePageWrapper title="发现" />}>
  <Route index element={<MobileSearch />} />
</Route>
```

### 3. 布局组件统一导出

**src/components/layout/index.ts**：

```tsx
// Admin layouts
export { default as AdminLayout } from './admin/AdminLayout';
export { default as AdminSidebar } from './admin/AdminSidebar';
export { default as AdminPageWrapper } from './AdminPageWrapper';

// Mobile layouts
export { default as MobileLayout } from './MobileLayout';
export { default as MobileWrapperPage } from './MobileWrapperPage';
export { default as MobilePageWrapper } from './MobilePageWrapper';

// Shared layouts
export { default as Navbar } from './Navbar';
export { default as Footer } from './Footer';
export { default as DynamicBranding } from './DynamicBranding';
export { default as AnnouncementBanner } from './AnnouncementBanner';
export { default as GlobalSettingsPanel } from './GlobalSettingsPanel';
export { default as AdminPageHeader } from './AdminPageHeader';
```

## 优化效果

### Before (重复布局包装)
```tsx
<Route path="/admin" element={<RequireAdmin><AdminLayout><AdminDashboard /></AdminLayout></RequireAdmin>} />
<Route path="/admin-users" element={<RequireAdmin><AdminLayout><AdminUsers /></AdminLayout></RequireAdmin>} />
<Route path="/admin-review" element={<RequireAdmin><AdminLayout><AdminReview /></AdminLayout></RequireAdmin>} />
// ... 每个页面都要重复
```

### After (嵌套路由)
```tsx
<Route path="/admin" element={<RequireAdmin><AdminPageWrapper /></RequireAdmin>}>
  <Route index element={<AdminDashboard />} />
  <Route path="users" element={<AdminUsers />} />
  <Route path="review" element={<AdminReview />} />
</Route>
```

## 优势

1. **代码简洁** - 减少重复的布局包装代码
2. **统一管理** - 布局在父路由统一处理
3. **易于维护** - 添加新页面只需在嵌套中添加
4. **更好的 URL 结构** - `/admin/users` 而不是 `/admin-users`
5. **布局状态保持** - 侧边栏选中状态在页面切换时保持
6. **路由过渡动画** - 更流畅的页面切换体验

## 注意事项

1. **Outlet 组件** - 嵌套布局必须使用 `<Outlet />` 来渲染子路由
2. **布局组件必须支持 children** - 确保布局可以正常工作
3. **路径前缀** - 子路由路径会自动继承父路由前缀
4. **向后兼容** - 保留旧路径的重定向以确保兼容性
