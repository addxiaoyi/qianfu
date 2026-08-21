#!/bin/bash
# =============================================================================
# 组件目录重构迁移脚本
# =============================================================================
# 功能: 将 qianfu-liandeng/src/components/ 下的组件迁移到新的目录结构
# 执行前请务必阅读 docs/COMPONENT_REFACTOR_GUIDE.md

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 项目根目录
PROJECT_ROOT="D:/qwq/项目/千服/qianfu-liandeng"
COMPONENTS_DIR="$PROJECT_ROOT/src/components"

# 备份目录
BACKUP_DIR="$PROJECT_ROOT/src/components.backup.$(date +%Y%m%d_%H%M%S)"

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  组件目录重构迁移脚本 v1.0${NC}"
echo -e "${BLUE}============================================${NC}"

# 检查是否在 git 管理下
if [ ! -d ".git" ]; then
    echo -e "${YELLOW}警告: 当前不在 git 仓库中，建议先提交当前更改${NC}"
fi

# ============================================================================
# 第一步: 创建备份
# ============================================================================
echo ""
echo -e "${YELLOW}[1/5] 创建备份...${NC}"

if [ -d "$BACKUP_DIR" ]; then
    echo -e "${RED}错误: 备份目录已存在${NC}"
    exit 1
fi

cp -r "$COMPONENTS_DIR" "$BACKUP_DIR"
echo -e "${GREEN}备份已创建: $BACKUP_DIR${NC}"

# ============================================================================
# 第二步: 创建目标目录结构
# ============================================================================
echo ""
echo -e "${YELLOW}[2/5] 创建目标目录结构...${NC}"

mkdir -p "$COMPONENTS_DIR/layout"
mkdir -p "$COMPONENTS_DIR/business"
mkdir -p "$COMPONENTS_DIR/form"
mkdir -p "$COMPONENTS_DIR/ui"
mkdir -p "$COMPONENTS_DIR/skeleton"

echo -e "${GREEN}目录结构已创建${NC}"

# ============================================================================
# 第三步: 迁移组件
# ============================================================================
echo ""
echo -e "${YELLOW}[3/5] 开始迁移组件...${NC}"

# --- Layout 组件 ---
echo "迁移布局组件..."
mv "$COMPONENTS_DIR/Navbar.tsx" "$COMPONENTS_DIR/layout/"
mv "$COMPONENTS_DIR/Footer.tsx" "$COMPONENTS_DIR/layout/"
mv "$COMPONENTS_DIR/Breadcrumb.tsx" "$COMPONENTS_DIR/layout/"
mv "$COMPONENTS_DIR/AdminLayout.tsx" "$COMPONENTS_DIR/layout/"
mv "$COMPONENTS_DIR/AdminSidebar.tsx" "$COMPONENTS_DIR/layout/"
mv "$COMPONENTS_DIR/AdminTableShell.tsx" "$COMPONENTS_DIR/layout/"
mv "$COMPONENTS_DIR/PageTransition.tsx" "$COMPONENTS_DIR/layout/"
mv "$COMPONENTS_DIR/admin/AdminLayout.tsx" "$COMPONENTS_DIR/layout/"
mv "$COMPONENTS_DIR/admin/AdminSidebar.tsx" "$COMPONENTS_DIR/layout/"
rmdir "$COMPONENTS_DIR/admin" 2>/dev/null || true

# --- UI 基础组件 ---
echo "迁移 UI 基础组件..."
mv "$COMPONENTS_DIR/AdminActionButton.tsx" "$COMPONENTS_DIR/ui/"
mv "$COMPONENTS_DIR/AdminPageHeader.tsx" "$COMPONENTS_DIR/ui/"
mv "$COMPONENTS_DIR/AdminStatCard.tsx" "$COMPONENTS_DIR/ui/"
mv "$COMPONENTS_DIR/StatusWrapper.tsx" "$COMPONENTS_DIR/ui/"
mv "$COMPONENTS_DIR/PageSeo.tsx" "$COMPONENTS_DIR/ui/"
mv "$COMPONENTS_DIR/SeoHead.tsx" "$COMPONENTS_DIR/ui/"
mv "$COMPONENTS_DIR/GlobalProgress.tsx" "$COMPONENTS_DIR/ui/"
mv "$COMPONENTS_DIR/LanternLogo.tsx" "$COMPONENTS_DIR/ui/"
mv "$COMPONENTS_DIR/icons/GeometricLantern.tsx" "$COMPONENTS_DIR/ui/"
rmdir "$COMPONENTS_DIR/icons" 2>/dev/null || true

# --- Form 表单组件 ---
echo "迁移表单组件..."
mv "$COMPONENTS_DIR/MatrixTagInput.tsx" "$COMPONENTS_DIR/form/"
mv "$COMPONENTS_DIR/MatrixImageUpload.tsx" "$COMPONENTS_DIR/form/"
mv "$COMPONENTS_DIR/RichTextEditor.tsx" "$COMPONENTS_DIR/form/"
mv "$COMPONENTS_DIR/RichTextEditorToolbar.tsx" "$COMPONENTS_DIR/form/"
mv "$COMPONENTS_DIR/GlobalSettingsPanel.tsx" "$COMPONENTS_DIR/form/"

# --- Business 业务组件 ---
echo "迁移业务组件..."
mv "$COMPONENTS_DIR/ServerCard.tsx" "$COMPONENTS_DIR/business/"
mv "$COMPONENTS_DIR/TicketCard.tsx" "$COMPONENTS_DIR/business/"
mv "$COMPONENTS_DIR/HomeFeatureCard.tsx" "$COMPONENTS_DIR/business/"
mv "$COMPONENTS_DIR/HomeStatCard.tsx" "$COMPONENTS_DIR/business/"
mv "$COMPONENTS_DIR/AnnouncementBanner.tsx" "$COMPONENTS_DIR/business/"
mv "$COMPONENTS_DIR/DynamicBranding.tsx" "$COMPONENTS_DIR/business/"
mv "$COMPONENTS_DIR/ThreeDHeadShowcase.tsx" "$COMPONENTS_DIR/business/"
mv "$COMPONENTS_DIR/MatrixDialog.tsx" "$COMPONENTS_DIR/business/"
mv "$COMPONENTS_DIR/tags/TagSelector.tsx" "$COMPONENTS_DIR/business/"
mv "$COMPONENTS_DIR/tags/index.ts" "$COMPONENTS_DIR/business/tags/index.ts"
rmdir "$COMPONENTS_DIR/tags" 2>/dev/null || true

# --- Skeleton 骨架屏组件 ---
echo "迁移骨架屏组件..."
# 合并重复的 Skeleton 组件
# 保留 ui/Skeleton.tsx (通用基础组件) 作为入口
# 将 business 相关的 skeleton 移到 skeleton/ 目录
mv "$COMPONENTS_DIR/skeleton/AdminStatsSkeleton.tsx" "$COMPONENTS_DIR/skeleton/"
mv "$COMPONENTS_DIR/skeleton/ServerCardSkeleton.tsx" "$COMPONENTS_DIR/skeleton/"
mv "$COMPONENTS_DIR/Skeleton.tsx" "$COMPONENTS_DIR/skeleton/BaseSkeleton.tsx"
mv "$COMPONENTS_DIR/mobile/MobileSkeleton.tsx" "$COMPONENTS_DIR/skeleton/MobileSkeleton.tsx"

# 创建统一的 skeleton 入口文件
cat > "$COMPONENTS_DIR/skeleton/index.ts" << 'EOF'
/**
 * 骨架屏组件统一导出
 * 优化项23: 骨架屏缓存 - Loading状态
 */
export * from './BaseSkeleton';
export * from './MobileSkeleton';
export * from './AdminStatsSkeleton';
export * from './ServerCardSkeleton';
export * from './skeletons'; // 完整骨架屏库
EOF

# --- Mobile 组件保持原位置 ---
echo "迁移移动端组件..."
# Mobile 组件保持独立目录结构

# ============================================================================
# 第四步: 更新导入路径 (需要手动验证)
# ============================================================================
echo ""
echo -e "${YELLOW}[4/5] 生成导入路径更新指南...${NC}"

# 生成需要更新的导入路径列表
cat > "$PROJECT_ROOT/scripts/import-updates-needed.txt" << 'EOF'
# 需要更新的导入路径列表
# 格式: 原路径 -> 新路径

# Layout 组件
src/components/Navbar -> src/components/layout/Navbar
src/components/Footer -> src/components/layout/Footer
src/components/Breadcrumb -> src/components/layout/Breadcrumb
src/components/AdminLayout -> src/components/layout/AdminLayout
src/components/AdminSidebar -> src/components/layout/AdminSidebar
src/components/AdminTableShell -> src/components/layout/AdminTableShell
src/components/PageTransition -> src/components/layout/PageTransition

# UI 组件
src/components/AdminActionButton -> src/components/ui/AdminActionButton
src/components/AdminPageHeader -> src/components/ui/AdminPageHeader
src/components/AdminStatCard -> src/components/ui/AdminStatCard
src/components/StatusWrapper -> src/components/ui/StatusWrapper
src/components/PageSeo -> src/components/ui/PageSeo
src/components/SeoHead -> src/components/ui/SeoHead
src/components/GlobalProgress -> src/components/ui/GlobalProgress
src/components/LanternLogo -> src/components/ui/LanternLogo
src/components/icons/GeometricLantern -> src/components/ui/GeometricLantern

# Form 组件
src/components/MatrixTagInput -> src/components/form/MatrixTagInput
src/components/MatrixImageUpload -> src/components/form/MatrixImageUpload
src/components/RichTextEditor -> src/components/form/RichTextEditor
src/components/RichTextEditorToolbar -> src/components/form/RichTextEditorToolbar
src/components/GlobalSettingsPanel -> src/components/form/GlobalSettingsPanel

# Business 组件
src/components/ServerCard -> src/components/business/ServerCard
src/components/TicketCard -> src/components/business/TicketCard
src/components/HomeFeatureCard -> src/components/business/HomeFeatureCard
src/components/HomeStatCard -> src/components/business/HomeStatCard
src/components/AnnouncementBanner -> src/components/business/AnnouncementBanner
src/components/DynamicBranding -> src/components/business/DynamicBranding
src/components/ThreeDHeadShowcase -> src/components/business/ThreeDHeadShowcase
src/components/MatrixDialog -> src/components/business/MatrixDialog
src/components/tags -> src/components/business/tags

# Skeleton 组件
src/components/Skeleton -> src/components/skeleton/BaseSkeleton
src/components/mobile/MobileSkeleton -> src/components/skeleton/MobileSkeleton
src/components/skeleton/AdminStatsSkeleton -> src/components/skeleton/AdminStatsSkeleton
src/components/skeleton/ServerCardSkeleton -> src/components/skeleton/ServerCardSkeleton
EOF

echo -e "${GREEN}导入路径更新指南已生成${NC}"

# ============================================================================
# 第五步: 创建索引文件
# ============================================================================
echo ""
echo -e "${YELLOW}[5/5] 创建索引文件...${NC}"

# Layout 索引
cat > "$COMPONENTS_DIR/layout/index.ts" << 'EOF'
/**
 * 布局组件统一导出
 */
export * from './Navbar';
export * from './Footer';
export * from './Breadcrumb';
export * from './AdminLayout';
export * from './AdminSidebar';
export * from './AdminTableShell';
export * from './PageTransition';
EOF

# UI 索引
cat > "$COMPONENTS_DIR/ui/index.ts" << 'EOF'
/**
 * UI 基础组件统一导出
 */
export * from './AdminActionButton';
export * from './AdminPageHeader';
export * from './AdminStatCard';
export * from './StatusWrapper';
export * from './PageSeo';
export * from './SeoHead';
export * from './GlobalProgress';
export * from './LanternLogo';
export * from './GeometricLantern';
export * from './Skeleton'; // 通用骨架屏基础组件
EOF

# Form 索引
cat > "$COMPONENTS_DIR/form/index.ts" << 'EOF'
/**
 * 表单组件统一导出
 */
export * from './MatrixTagInput';
export * from './MatrixImageUpload';
export * from './RichTextEditor';
export * from './RichTextEditorToolbar';
export * from './GlobalSettingsPanel';
EOF

# Business 索引
cat > "$COMPONENTS_DIR/business/index.ts" << 'EOF'
/**
 * 业务组件统一导出
 */
export * from './ServerCard';
export * from './TicketCard';
export * from './HomeFeatureCard';
export * from './HomeStatCard';
export * from './AnnouncementBanner';
export * from './DynamicBranding';
export * from './ThreeDHeadShowcase';
export * from './MatrixDialog';
export * from './tags';
EOF

echo -e "${GREEN}索引文件已创建${NC}"

# ============================================================================
# 完成
# ============================================================================
echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  迁移完成!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo -e "${YELLOW}后续步骤:${NC}"
echo "1. 检查 $PROJECT_ROOT/scripts/import-updates-needed.txt"
echo "2. 使用 IDE 的全局搜索替换功能更新导入路径"
echo "3. 运行测试确保功能正常"
echo "4. 如有问题，从 $BACKUP_DIR 恢复"
echo "5. 确认无误后删除备份目录"
echo ""
echo -e "${BLUE}备份位置: $BACKUP_DIR${NC}"
