# 移动端前端设计 Spec

## Why
当前项目拥有完整的功能体系（服务器列表、用户中心、编辑器、支付、工单、审核等），但移动端体验存在以下问题：
1. 功能在移动端可用但体验不佳，部分功能难以操作
2. 移动端导航层级深，用户难以快速找到功能
3. 触控目标过小，不符合移动端可用性标准（最小44px）
4. 复杂页面（如编辑器、审核面板）在移动端显示拥挤
5. 缺乏移动端优化的交互模式（手势、底部导航、下拉刷新等）

## What Changes
- **完整功能映射**：移动端支持所有电脑端功能（首页、服务器列表、详情、编辑器、用户中心、支付、工单、审核等）
- **移动端优先的导航系统**：底部Tab导航 + 顶部次级导航，替代侧边栏菜单
- **响应式布局重构**：所有页面适配移动端屏幕，保持功能完整性
- **触控优化**：所有可交互元素最小48x48px触控区域
- **手势交互**：支持滑动返回、下拉刷新、左右滑动切换
- **性能优化**：图片懒加载、骨架屏、代码分割
- **PWA支持**：离线访问、添加到主屏幕

## Impact
- 移动端用户可完整使用所有功能
- 大幅提升移动端UX体验
- 提高移动端用户留存和转化率

## 功能对照表

| 电脑端功能 | 移动端实现方案 | 优先级 |
|-----------|---------------|--------|
| 首页/服务器列表 | 单列卡片列表 + 下拉刷新 | P0 |
| 服务器详情 | 折叠面板展示信息 + 滑动切换标签 | P0 |
| 编辑器 | 简化工具栏 + 全屏编辑模式 | P0 |
| 用户中心 | 表单分组 + 底部固定保存按钮 | P0 |
| 支付页面 | 步骤指示器 + 大按钮 | P0 |
| 工单系统 | 列表 + 详情页 + 底部输入框 | P1 |
| 审核面板 | 卡片式审批 + 滑动操作 | P1 |
| 用户管理 | 搜索 + 列表 + 详情抽屉 | P1 |
| 数据分析 | 图表简化 + 关键指标突出 | P2 |
| 设置页面 | 分组列表 + 开关控件 | P2 |

## ADDED Requirements

### Requirement: 移动端设备检测与路由
The system SHALL automatically detect mobile devices and serve optimized mobile UI.

#### Scenario: 设备检测
- **WHEN** 用户访问网站
- **THEN** 系统检测用户代理或屏幕尺寸
- **AND** 移动端用户看到移动优化界面
- **AND** 桌面端用户看到桌面界面
- **AND** 支持手动切换视图模式

### Requirement: 移动端底部导航
The system SHALL provide a bottom tab navigation for mobile users.

#### Scenario: 主导航
- **WHEN** 用户在移动端浏览
- **THEN** 底部显示固定导航栏（首页、发现、发布、消息、我的）
- **AND** 当前页面图标高亮显示
- **AND** 点击图标切换页面
- **AND** 导航栏高度56px，适合拇指操作

#### Scenario: 次级导航
- **WHEN** 页面有多个子功能
- **THEN** 顶部显示次级导航标签
- **AND** 支持左右滑动切换标签

### Requirement: 移动端首页
The system SHALL provide a mobile-optimized home page with full server browsing capabilities.

#### Scenario: 服务器列表
- **WHEN** 用户访问首页
- **THEN** 显示单列服务器卡片列表
- **AND** 支持下拉刷新
- **AND** 支持上拉加载更多
- **AND** 卡片包含：图标、名称、描述、标签、在线人数

#### Scenario: 搜索和筛选
- **WHEN** 用户点击搜索
- **THEN** 进入全屏搜索页面
- **AND** 支持关键词搜索
- **AND** 支持标签筛选（生存、创造、PVP等）
- **AND** 显示搜索历史

### Requirement: 移动端服务器详情
The system SHALL provide a mobile-optimized server detail page.

#### Scenario: 信息展示
- **WHEN** 用户查看服务器详情
- **THEN** 使用折叠面板分组展示信息
- **AND** 基本信息（名称、图标、描述）始终可见
- **AND** 详细信息（配置、规则、统计）可展开

#### Scenario: 交互操作
- **WHEN** 用户与详情页交互
- **THEN** 支持左右滑动切换标签页
- **AND** 支持从左侧边缘滑动返回
- **AND** 重要操作（复制IP、收藏）固定在底部

### Requirement: 移动端编辑器
The system SHALL provide a mobile-optimized editor with full editing capabilities.

#### Scenario: 编辑界面
- **WHEN** 用户进入编辑器
- **THEN** 提供简化工具栏（最常用的格式化按钮）
- **AND** 支持全屏编辑模式
- **AND** 底部固定操作栏（保存、预览、发布）

#### Scenario: 富文本编辑
- **WHEN** 用户编辑内容
- **THEN** 支持基本的文本格式化
- **AND** 支持图片上传（调用相机或相册）
- **AND】支持链接插入

### Requirement: 移动端用户中心
The system SHALL provide a mobile-optimized user profile page.

#### Scenario: 个人信息
- **WHEN** 用户查看个人中心
- **THEN】显示头像、昵称、等级、余额
- **AND** 功能入口以图标网格形式展示
- **AND** 设置项分组列表展示

#### Scenario: 表单编辑
- **WHEN** 用户编辑资料
- **THEN** 表单字段分组显示
- **AND** 输入框高度适合触控
- **AND** 保存按钮固定在底部

### Requirement: 移动端支付
The system SHALL provide a mobile-optimized payment flow.

#### Scenario: 支付流程
- **WHEN** 用户进行支付
- **THEN** 显示步骤指示器（选择金额 -> 选择方式 -> 确认）
- **AND** 金额选择使用大按钮网格
- **AND** 支付方式显示图标和名称
- **AND** 确认按钮固定在底部，高度56px

### Requirement: 移动端工单系统
The system SHALL provide a mobile-optimized ticket system.

#### Scenario: 工单列表
- **WHEN** 用户查看工单
- **THEN** 显示卡片式工单列表
- **AND** 显示状态标签（待处理、处理中、已解决）
- **AND** 支持下拉刷新

#### Scenario: 工单详情
- **WHEN** 用户查看工单详情
- **THEN** 对话形式展示消息记录
- **AND** 底部固定输入框和发送按钮
- **AND** 支持上传图片

### Requirement: 移动端审核面板
The system SHALL provide a mobile-optimized review panel for admins.

#### Scenario: 待审核列表
- **WHEN** 管理员查看待审核内容
- **THEN** 显示卡片式列表
- **AND** 左滑显示快捷操作（通过、拒绝）
- **AND** 点击进入详情

#### Scenario: 审核详情
- **WHEN** 管理员查看审核详情
- **THEN** 完整展示待审核内容
- **AND** 底部固定操作栏（通过/拒绝按钮）
- **AND** 支持填写审核备注

### Requirement: 触控优化
The system SHALL provide touch-optimized interactions throughout the mobile UI.

#### Scenario: 触控目标
- **WHEN** 用户与界面交互
- **THEN** 所有可点击元素最小尺寸48x48px
- **AND** 相邻元素间距至少8px
- **AND** 重要操作按钮高度56px

#### Scenario: 手势支持
- **WHEN** 用户使用手势
- **THEN** 支持从左侧边缘右滑返回上一页
- **AND** 支持下拉刷新列表
- **AND** 支持左右滑动切换标签页
- **AND】支持列表项左滑显示操作按钮

### Requirement: 性能优化
The system SHALL provide optimized performance for mobile devices.

#### Scenario: 加载优化
- **WHEN** 页面加载
- **THEN** 首屏内容优先加载
- **AND** 图片懒加载（进入视口才加载）
- **AND** 显示骨架屏提升感知性能

#### Scenario: 代码分割
- **WHEN** 应用运行
- **THEN** 按路由分割代码
- **AND】移动端组件按需加载
- **AND** 预加载下一页资源

### Requirement: PWA支持
The system SHALL provide Progressive Web App capabilities for mobile.

#### Scenario: 添加到主屏幕
- **WHEN** 用户访问网站
- **THEN** 提示添加到主屏幕
- **AND】提供应用图标（多种尺寸）
- **AND** 提供启动画面

#### Scenario: 离线访问
- **WHEN** 用户离线
- **THEN】缓存的页面可正常访问
- **AND** 显示离线状态提示
- **AND** 联网后自动同步数据
