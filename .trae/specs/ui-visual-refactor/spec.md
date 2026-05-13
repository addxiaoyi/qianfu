# UI 视觉重构 Spec

## Why
从截图中可以看到多个 UI 元素存在视觉问题：
1. 搜索框样式过于简陋，缺乏视觉层次
2. 标签按钮（生存、创造、PVP等）间距和样式不协调
3. 命令面板（Command Palette）毛玻璃效果过度，文字可读性差
4. 导航菜单视觉混乱，选中状态不明显
5. 整体缺乏一致的设计语言和视觉层级

## What Changes
- 重构搜索框组件，增加图标、圆角、阴影和聚焦状态
- 重新设计标签过滤按钮，统一间距、圆角和悬停效果
- 优化命令面板，降低毛玻璃模糊度，提高文字对比度
- 重构导航菜单，明确选中状态和层级关系
- 统一整体视觉风格，建立一致的设计规范

## Impact
- 提升用户体验和界面美观度
- 提高文字可读性和交互反馈
- 建立可维护的 UI 组件规范

## ADDED Requirements

### Requirement: 搜索框视觉重构
The system SHALL provide a visually appealing search input with clear affordances.

#### Scenario: 搜索框显示
- **WHEN** 用户看到搜索框
- **THEN** 应有搜索图标、合适的圆角、微妙的阴影
- **AND** 聚焦时应有明显的边框高亮

### Requirement: 标签按钮视觉重构
The system SHALL provide consistent and visually distinct tag/filter buttons.

#### Scenario: 标签按钮显示
- **WHEN** 用户看到标签过滤按钮
- **THEN** 按钮应有统一的间距、圆角和 padding
- **AND** 悬停和选中状态应有清晰的视觉反馈

### Requirement: 命令面板视觉重构
The system SHALL provide a command palette with good readability.

#### Scenario: 命令面板打开
- **WHEN** 用户打开命令面板
- **THEN** 背景模糊度应适中，不影响文字阅读
- **AND** 文字对比度应满足可读性标准
- **AND** 选项高亮状态应清晰

### Requirement: 导航菜单视觉重构
The system SHALL provide a navigation menu with clear hierarchy.

#### Scenario: 导航菜单显示
- **WHEN** 用户看到导航菜单
- **THEN** 当前选中项应有明显的视觉标识
- **AND** 菜单项层级关系应清晰
- **AND** 悬停状态应有反馈
