# Tasks

## Phase 1: 基础架构 (必须优先完成)

- [x] Task 1: 移动端设备检测与路由系统
  - [x] SubTask 1.1: 创建设备检测工具函数 (isMobileDevice)
  - [x] SubTask 1.2: 创建移动端路由配置 (mobileRoutes)
  - [x] SubTask 1.3: 实现路由自动切换逻辑
  - [x] SubTask 1.4: 添加手动切换视图模式功能

- [x] Task 2: 移动端样式系统
  - [x] SubTask 2.1: 创建移动端 CSS 变量 (--mobile-*)
  - [x] SubTask 2.2: 定义移动端间距规范 (8px 基准)
  - [x] SubTask 2.3: 创建移动端断点配置 (sm: 640px, md: 768px)
  - [x] SubTask 2.4: 创建移动端动画库 (手势动画)

- [x] Task 3: 移动端底部导航组件
  - [x] SubTask 3.1: 创建 MobileBottomNav 组件
  - [x] SubTask 3.2: 设计导航图标 (首页、发现、发布、消息、我的)
  - [x] SubTask 3.3: 实现选中状态动画
  - [x] SubTask 3.4: 处理导航权限 (根据用户角色显示不同导航项)

## Phase 2: 核心页面 (P0 优先级)

- [x] Task 4: 移动端首页
  - [x] SubTask 4.1: 创建 MobileHomePage 组件
  - [x] SubTask 4.2: 设计移动端服务器卡片 (单列布局)
  - [x] SubTask 4.3: 实现下拉刷新功能 (PullToRefresh)
  - [x] SubTask 4.4: 实现上拉加载更多 (InfiniteScroll)
  - [x] SubTask 4.5: 创建移动端搜索页面 (全屏)
  - [x] SubTask 4.6: 实现标签筛选功能

- [x] Task 5: 移动端服务器详情页
  - [x] SubTask 5.1: 创建 MobileServerDetailPage 组件
  - [x] SubTask 5.2: 实现折叠面板展示信息
  - [x] SubTask 5.3: 创建标签切换组件 (滑动切换)
  - [x] SubTask 5.4: 实现底部固定操作栏 (复制IP、收藏)
  - [x] SubTask 5.5: 添加滑动返回手势支持

- [x] Task 6: 移动端编辑器
  - [x] SubTask 6.1: 创建 MobileEditorPage 组件
  - [x] SubTask 6.2: 设计简化工具栏 (粗体、斜体、链接、图片)
  - [x] SubTask 6.3: 实现全屏编辑模式
  - [x] SubTask 6.4: 创建底部固定操作栏 (保存、预览、发布)
  - [x] SubTask 6.5: 实现图片上传 (支持相机/相册)

- [x] Task 7: 移动端用户中心
  - [x] SubTask 7.1: 创建 MobileProfilePage 组件
  - [x] SubTask 7.2: 设计个人信息展示区 (头像、昵称、等级)
  - [x] SubTask 7.3: 创建功能入口网格 (我的服务器、钱包、工单等)
  - [x] SubTask 7.4: 实现表单编辑页面
  - [x] SubTask 7.5: 添加底部固定保存按钮

- [x] Task 8: 移动端支付页面
  - [x] SubTask 8.1: 创建 MobilePaymentPage 组件
  - [x] SubTask 8.2: 实现步骤指示器组件
  - [x] SubTask 8.3: 设计金额选择网格 (大按钮)
  - [x] SubTask 8.4: 创建支付方式选择器
  - [x] SubTask 8.5: 实现确认支付页面

## Phase 3: 功能页面 (P1 优先级)

- [x] Task 9: 移动端工单系统
  - [x] SubTask 9.1: 创建 MobileTicketPage 组件 (列表)
  - [x] SubTask 9.2: 创建 MobileTicketDetailPage 组件 (详情)
  - [x] SubTask 9.3: 实现卡片式工单列表
  - [x] SubTask 9.4: 创建对话式消息展示
  - [x] SubTask 9.5: 实现底部固定输入框

- [x] Task 10: 移动端审核面板
  - [x] SubTask 10.1: 创建 MobileReviewPanel 组件
  - [x] SubTask 10.2: 实现卡片式待审核列表
  - [x] SubTask 10.3: 添加左滑快捷操作 (通过/拒绝)
  - [x] SubTask 10.4: 创建审核详情页面
  - [x] SubTask 10.5: 实现底部固定操作栏

- [x] Task 11: 移动端用户管理
  - [x] SubTask 11.1: 创建 MobileUserManagementPage 组件
  - [x] SubTask 11.2: 实现用户搜索功能
  - [x] SubTask 11.3: 创建用户列表卡片
  - [x] SubTask 11.4: 实现用户详情抽屉

- [x] Task 12: 移动端管理页面
  - [x] SubTask 12.1: 创建 MobileAdminDashboard 组件
  - [x] SubTask 12.2: 简化数据图表展示
  - [x] SubTask 12.3: 创建关键指标卡片
  - [x] SubTask 12.4: 实现管理功能入口

## Phase 4: 优化与增强 (P2 优先级)

- [x] Task 13: 触控优化
  - [x] SubTask 13.1: 创建 TouchButton 组件 (48x48px 最小)
  - [x] SubTask 13.2: 实现滑动返回手势 (SwipeBack)
  - [x] SubTask 13.3: 实现下拉刷新组件 (PullToRefresh)
  - [x] SubTask 13.4: 实现列表项左滑操作 (SwipeableItem)
  - [x] SubTask 13.5: 添加手势提示引导

- [x] Task 14: 性能优化
  - [x] SubTask 14.1: 实现图片懒加载组件 (LazyImage)
  - [x] SubTask 14.2: 创建骨架屏组件 (Skeleton)
  - [x] SubTask 14.3: 实现虚拟列表 (VirtualList) - 长列表优化
  - [x] SubTask 14.4: 添加页面预加载逻辑
  - [x] SubTask 14.5: 优化首屏加载时间

- [x] Task 15: PWA 支持
  - [x] SubTask 15.1: 创建 manifest.json 配置
  - [x] SubTask 15.2: 设计应用图标 (192x192, 512x512)
  - [x] SubTask 15.3: 创建启动画面
  - [x] SubTask 15.4: 实现 Service Worker
  - [x] SubTask 15.5: 配置离线缓存策略
  - [x] SubTask 15.6: 添加"添加到主屏幕"提示

## Phase 5: 测试与完善

- [ ] Task 16: 移动端测试
  - [ ] SubTask 16.1: 测试所有页面在 iOS Safari 的表现
  - [ ] SubTask 16.2: 测试所有页面在 Android Chrome 的表现
  - [ ] SubTask 16.3: 测试触控目标尺寸合规性
  - [ ] SubTask 16.4: 测试手势操作流畅性
  - [ ] SubTask 16.5: 测试性能指标 (首屏加载 < 3s)

# Task Dependencies
- Phase 2 所有任务依赖于 Task 1, 2, 3
- Phase 3 所有任务依赖于 Phase 2
- Phase 4 所有任务依赖于 Phase 2
- Phase 5 依赖于所有前置任务
- Task 13 (触控优化) 被所有页面任务依赖
- Task 14 (性能优化) 被所有页面任务依赖
