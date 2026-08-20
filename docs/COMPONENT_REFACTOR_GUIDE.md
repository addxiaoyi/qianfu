# 组件目录重构指南

> 优化项: 组件结构规范化 - 提升代码可维护性与团队协作效率

## 1. 背景与目标

### 1.1 当前问题

当前 `qianfu-liandeng/src/components/` 目录存在以下问题:

- **结构混乱**: 组件平铺在根目录,缺少层级组织
- **重复组件**: 存在多个 Skeleton 组件实现(3处)
- **命名不一致**: 部分组件带有特定前缀(如 `Matrix*`, `Admin*`)
- **导入复杂**: 深层嵌套组件(如 `admin/`, `mobile/`, `skeleton/`, `tags/`)与扁平组件混杂
- **职责不清**: UI 基础组件与业务组件混合在一起

### 1.2 重构目标

```
components/
├── layout/        # 布局组件 (Navbar, Footer, Sidebar 等)
├── business/      # 业务组件 (ServerCard, TicketCard 等)
├── form/          # 表单组件 (输入、上传、编辑器等)
├── ui/            # UI 基础组件 (按钮、卡片、状态等)
├── skeleton/      # 骨架屏组件 (加载占位)
└── mobile/        # 移动端组件 (保持独立)
```

## 2. 当前组件结构分析

### 2.1 现有组件清单

| 组件名 | 类型 | 迁移目标 |
|--------|------|----------|
| Navbar.tsx | 布局 | layout/ |
| Footer.tsx | 布局 | layout/ |
| Breadcrumb.tsx | 布局 | layout/ |
| AdminLayout.tsx | 布局 | layout/ |
| AdminSidebar.tsx | 布局 | layout/ |
| AdminTableShell.tsx | 布局 | layout/ |
| PageTransition.tsx | 布局 | layout/ |
| AdminActionButton.tsx | UI | ui/ |
| AdminPageHeader.tsx | UI | ui/ |
| AdminStatCard.tsx | UI | ui/ |
| StatusWrapper.tsx | UI | ui/ |
| PageSeo.tsx | UI | ui/ |
| SeoHead.tsx | UI | ui/ |
| GlobalProgress.tsx | UI | ui/ |
| LanternLogo.tsx | UI | ui/ |
| icons/GeometricLantern.tsx | UI | ui/ |
| MatrixTagInput.tsx | 表单 | form/ |
| MatrixImageUpload.tsx | 表单 | form/ |
| RichTextEditor.tsx | 表单 | form/ |
| RichTextEditorToolbar.tsx | 表单 | form/ |
| GlobalSettingsPanel.tsx | 表单 | form/ |
| ServerCard.tsx | 业务 | business/ |
| TicketCard.tsx | 业务 | business/ |
| HomeFeatureCard.tsx | 业务 | business/ |
| HomeStatCard.tsx | 业务 | business/ |
| AnnouncementBanner.tsx | 业务 | business/ |
| DynamicBranding.tsx | 业务 | business/ |
| ThreeDHeadShowcase.tsx | 业务 | business/ |
| MatrixDialog.tsx | 业务 | business/ |
| tags/TagSelector.tsx | 业务 | business/tags/ |
| Skeleton.tsx | 骨架屏 | skeleton/BaseSkeleton.tsx |
| skeleton/AdminStatsSkeleton.tsx | 骨架屏 | skeleton/ |
| skeleton/ServerCardSkeleton.tsx | 骨架屏 | skeleton/ |
| mobile/MobileSkeleton.tsx | 骨架屏 | skeleton/MobileSkeleton.tsx |
| mobile/* | 移动端 | 保持原位置 |

### 2.2 重复组件合并策略

发现 **3 个 Skeleton 组件实现**:

1. **`ui/Skeleton.tsx`** - 最完善,包含 AvatarSkeleton, CardSkeleton, Shimmer 等
2. **`Skeleton.tsx`** - 简单实现,仅支持基础 className 和 count
3. **`mobile/MobileSkeleton.tsx`** - 完整移动端骨架屏库

**合并策略**:

```typescript
// skeleton/index.ts - 统一导出
export * from './BaseSkeleton';        // 原 ui/Skeleton.tsx
export * from './MobileSkeleton';      // 移动端专用
export * from './AdminStatsSkeleton';  // 管理员统计专用
export * from './ServerCardSkeleton';  // 服务器卡片专用
```

## 3. 目标目录结构

```
src/components/
├── layout/                    # 布局组件
│   ├── index.ts              # 统一导出
│   ├── Navbar.tsx
│   ├── Footer.tsx
│   ├── Breadcrumb.tsx
│   ├── AdminLayout.tsx
│   ├── AdminSidebar.tsx
│   ├── AdminTableShell.tsx
│   └── PageTransition.tsx
│
├── business/                  # 业务组件
│   ├── index.ts              # 统一导出
│   ├── ServerCard.tsx
│   ├── TicketCard.tsx
│   ├── HomeFeatureCard.tsx
│   ├── HomeStatCard.tsx
│   ├── AnnouncementBanner.tsx
│   ├── DynamicBranding.tsx
│   ├── ThreeDHeadShowcase.tsx
│   ├── MatrixDialog.tsx
│   └── tags/
│       └── index.ts
│
├── form/                      # 表单组件
│   ├── index.ts              # 统一导出
│   ├── MatrixTagInput.tsx
│   ├── MatrixImageUpload.tsx
│   ├── RichTextEditor.tsx
│   ├── RichTextEditorToolbar.tsx
│   └── GlobalSettingsPanel.tsx
│
├── ui/                        # UI 基础组件
│   ├── index.ts              # 统一导出
│   ├── AdminActionButton.tsx
│   ├── AdminPageHeader.tsx
│   ├── AdminStatCard.tsx
│   ├── StatusWrapper.tsx
│   ├── PageSeo.tsx
│   ├── SeoHead.tsx
│   ├── GlobalProgress.tsx
│   ├── LanternLogo.tsx
│   ├── GeometricLantern.tsx
│   └── Skeleton.tsx
│
├── skeleton/                  # 骨架屏组件
│   ├── index.ts              # 统一导出
│   ├── BaseSkeleton.tsx      # 基础骨架屏 (原 ui/Skeleton.tsx)
│   ├── MobileSkeleton.tsx    # 移动端骨架屏
│   ├── AdminStatsSkeleton.tsx
│   └── ServerCardSkeleton.tsx
│
└── mobile/                    # 移动端组件 (保持独立)
    ├── index.ts              # 统一导出
    ├── MobileLayout.tsx
    ├── MobileAdminDashboard.tsx
    ├── MobileBottomNav.tsx
    ├── MobileEditor.tsx
    ├── MobileLazyImage.tsx
    ├── MobileMessages.tsx
    ├── MobileNotifications.tsx
    ├── MobilePayment.tsx
    ├── MobileSearch.tsx
    ├── MobileServerDetail.tsx
    ├── MobileSettings.tsx
    ├── MobileTicketCreate.tsx
    ├── MobileTicketDetail.tsx
    ├── MobileTicketList.tsx
    ├── MobileUserCenter.tsx
    ├── MobileWrapperPage.tsx
    ├── SwipeableItem.tsx
    ├── TouchButton.tsx
    └── VirtualList.tsx
```

## 4. 迁移步骤

### 4.1 自动迁移 (使用脚本)

```bash
# 1. 进入项目目录
cd qianfu-liandeng

# 2. 确保脚本有执行权限
chmod +x scripts/refactor-components.sh

# 3. 执行迁移脚本
./scripts/refactor-components.sh
```

### 4.2 手动验证

```bash
# 1. 检查目录结构
find src/components -type f -name "*.tsx" | sort

# 2. 检查导入路径
grep -r "from.*components/" src/ --include="*.tsx" --include="*.ts"

# 3. 运行类型检查
npm run type-check

# 4. 运行测试
npm test
```

### 4.3 导入路径更新

迁移后需要更新所有导入路径。推荐使用 IDE 的全局搜索替换:

**VS Code 快捷键**: `Ctrl + Shift + H`

| 原路径 | 新路径 |
|--------|--------|
| `@/components/Navbar` | `@/components/layout/Navbar` |
| `@/components/ServerCard` | `@/components/business/ServerCard` |
| `@/components/Skeleton` | `@/components/skeleton/BaseSkeleton` |

## 5. 命名规范

### 5.1 目录命名

- 使用 **kebab-case**: `layout`, `business`, `form`, `ui`, `skeleton`
- 使用 **PascalCase** 内部目录: `tags/`, `icons/`

### 5.2 组件命名

- 文件名使用 **PascalCase**: `ServerCard.tsx`, `MatrixTagInput.tsx`
- 组件名使用 **PascalCase**: `export const ServerCard`
- Hooks 使用 **camelCase**: `useServerCard`, `useFormState`

### 5.3 索引文件

每个目录必须包含 `index.ts` 统一导出:

```typescript
// components/layout/index.ts
export * from './Navbar';
export * from './Footer';
export * from './Breadcrumb';
// ...
```

## 6. 导入规范

### 6.1 优先使用路径别名

```typescript
// 推荐
import { ServerCard } from '@/components/business/ServerCard';
import { Navbar, Footer } from '@/components/layout';

// 允许从 index 导入
import { ServerCard } from '@/components/business';
```

### 6.2 禁止相对路径过深

```typescript
// 不推荐
import ServerCard from '../../../components/business/ServerCard';

// 推荐
import ServerCard from '@/components/business/ServerCard';
```

## 7. 回滚方案

如迁移出现问题,可从备份恢复:

```bash
# 1. 停止开发服务器
# Ctrl + C

# 2. 恢复备份
rm -rf src/components
mv src/components.backup.20240101_120000 src/components

# 3. 验证恢复
ls src/components/
```

## 8. 预估工作量

| 阶段 | 任务 | 时间 |
|------|------|------|
| 准备 | 创建备份 | 5 分钟 |
| 执行 | 运行迁移脚本 | 2 分钟 |
| 验证 | 更新导入路径 | 30-60 分钟 |
| 测试 | 功能测试 | 30 分钟 |
| 清理 | 删除备份 | 5 分钟 |
| **总计** | | **1.5-2 小时** |

## 9. 注意事项

1. **先备份**: 始终在执行迁移前创建完整备份
2. **小步提交**: 迁移完成后立即提交,不要与其他更改混合
3. **充分测试**: 确保所有页面和功能正常
4. **团队通知**: 告知团队成员导入路径变更
5. **文档更新**: 更新相关文档中的导入示例

## 10. 相关文档

- [组件开发规范](./COMPONENT_DEVELOPMENT_GUIDE.md)
- [目录结构说明](./DIRECTORY_STRUCTURE.md)
- [TypeScript 规范](./TYPESCRIPT_GUIDE.md)
