# 千服联灯 - 管理后台 架构文档

## 项目结构

```
admin/
├── index.html              # 入口页面（未使用）
├── panel.html              # 管理面板主页面（约98行，精简后）
├── login.html              # 登录页面（约261行）
│
├── css/                    # 样式模块
│   ├── theme.css           # 主题系统（6种颜色主题）
│   └── panel.css           # 面板样式（约400行）
│
├── js/                     # JavaScript 模块
│   ├── api.js              # API 封装
│   ├── store.js            # 状态管理
│   ├── components.js       # 可复用组件
│   ├── app.js              # 应用入口控制器
│   │
│   └── pages/              # 页面模块
│       ├── site-info.js    # 站点信息页面
│       ├── server.js       # 服务器管理页面
│       ├── team.js         # 管理团队页面
│       ├── content.js      # 内容管理页面
│       ├── style.js        # 风格设置页面
│       └── social.js       # 社交链接页面
│
├── data/                   # 数据存储
│   ├── config.json         # 账号配置
│   └── content.json        # 站点内容
│
├── api.php                 # 内容管理 API
├── login.php               # 登录验证
├── logout.php             # 退出登录
└── system.php              # 系统设置 API
```

## 架构说明

### 模块职责

| 模块 | 职责 |
|------|------|
| `css/theme.css` | 定义 6 种主题颜色系统，与主站完全一致 |
| `css/panel.css` | 管理面板通用样式（侧边栏、卡片、表单等） |
| `js/api.js` | 封装所有后端 API 调用 |
| `js/store.js` | 状态管理，支持订阅变更通知 |
| `js/components.js` | 可复用 UI 组件（Toast、头像等） |
| `js/app.js` | 主控制器，管理路由和页面切换 |
| `js/pages/*.js` | 各页面独立模块，包含渲染和数据获取 |

### 扩展指南

#### 新增标签页

1. 在 `js/pages/` 创建新页面模块（如 `custom.js`）
2. 在 `js/app.js` 的 `tabs` 数组添加定义
3. 在 `panel.html` 添加对应的 `<script>` 引用
4. 在 `app.js` 的 `renderPage()` 添加 switch case

示例：
```javascript
// js/pages/custom.js
const CustomPage = {
    render(data, onSave) { ... },
    getData() { ... }
};

// js/app.js - tabs 数组
{ id: 'custom', name: '自定义', icon: 'star', page: 'custom' }

// panel.html - 添加脚本
<script src="js/pages/custom.js"></script>
```

#### 新增主题

在 `css/theme.css` 中添加新主题：
```css
[data-accent="custom"] {
    --ui-accent: #自定义颜色;
    --ui-accent-light: #浅色;
    /* ... 其他变量 */
}
```

### 与主站共享资源

- **主题系统**: `data-accent` 属性 + CSS 变量
- **图标**: Lucide Icons CDN
- **字体**: Inter (Google Fonts)

### 数据流

```
用户操作 → App.switchTab() → Page.render() → 用户编辑
    ↓
Page.getData() → Store.saveContent() → API.saveContent()
    ↓
后端保存 → Store 更新 → 页面刷新
```

## 迁移说明

要迁移到其他项目：

1. 复制 `admin/` 目录
2. 修改 PHP 文件中的数据存储路径
3. 根据需要修改品牌名称（"千服联灯"）
4. 按需添加/删除页面模块

所有样式和交互逻辑已模块化，便于单独更新和维护。
