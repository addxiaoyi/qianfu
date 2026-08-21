/**
 * E2E 测试文件概览
 *
 * 创建时间: 2026-07-07
 * 项目: 千服平台前端
 * 目录: qianfu-liandeng
 */

// ============================================================
// 测试文件列表
// ============================================================

/**
 * 1. tests/e2e/pages/base.ts
 *    - 基础 Page Objects 和辅助函数
 *    - 提供通用的页面交互方法和测试工具
 *
 * 2. tests/e2e/server-management.spec.ts
 *    - 服务器管理 E2E 测试 (13 个测试用例)
 *    - 覆盖服务器列表、详情、创建/编辑功能
 *
 * 3. tests/e2e/ticket-management.spec.ts
 *    - 工单管理 E2E 测试 (14 个测试用例)
 *    - 覆盖工单列表、创建、详情、状态流转
 *
 * 4. tests/e2e/payment-flow.spec.ts
 *    - 支付流程 E2E 测试 (21 个测试用例)
 *    - 覆盖支付页面、订单创建、支付状态、回调处理
 */

// ============================================================
// 测试用例统计
// ============================================================

export const TEST_SUMMARY = {
  totalTestFiles: 3,
  totalTestCases: 48,
  pageObjectFiles: 1,
  breakdown: {
    serverManagement: {
      file: 'tests/e2e/server-management.spec.ts',
      testCases: 13,
      testSuites: [
        '服务器列表浏览 (5 tests)',
        '服务器详情页 (3 tests)',
        '服务器创建/编辑 (3 tests)',
        '我的服务器管理 (2 tests)',
      ],
    },
    ticketManagement: {
      file: 'tests/e2e/ticket-management.spec.ts',
      testCases: 14,
      testSuites: [
        '工单列表 (4 tests)',
        '工单创建 (4 tests)',
        '工单详情与状态流转 (5 tests)',
        '管理员工单管理 (1 test)',
      ],
    },
    paymentFlow: {
      file: 'tests/e2e/payment-flow.spec.ts',
      testCases: 21,
      testSuites: [
        '支付页面加载 (3 tests)',
        '支付方式选择 (3 tests)',
        '订单创建 (2 tests)',
        '支付状态验证 (3 tests)',
        '支付回调处理 (4 tests)',
        '钱包功能 (4 tests)',
        '支付 API 测试 (2 tests)',
      ],
    },
  },
};

// ============================================================
// 测试执行命令
// ============================================================

/**
 * 运行所有 E2E 测试:
 * pnpm exec playwright test
 *
 * 运行特定测试文件:
 * pnpm exec playwright test tests/e2e/server-management.spec.ts
 * pnpm exec playwright test tests/e2e/ticket-management.spec.ts
 * pnpm exec playwright test tests/e2e/payment-flow.spec.ts
 *
 * 运行特定测试套件:
 * pnpm exec playwright test --grep "服务器列表"
 * pnpm exec playwright test --grep "工单创建"
 * pnpm exec playwright test --grep "支付流程"
 *
 * 使用 UI 模式运行:
 * pnpm exec playwright test --ui
 *
 * 使用调试模式:
 * pnpm exec playwright test --debug
 */

// ============================================================
// 测试环境要求
// ============================================================

/**
 * 1. 启动测试服务:
 *    pnpm start
 *
 * 2. 环境变量:
 *    BASE_URL=http://localhost:3000
 *
 * 3. 测试用户 (需要在数据库中创建):
 *    - test-admin / Test@123456 (管理员)
 *    - test-user / Test@123456 (普通用户)
 *
 * 4. 浏览器支持:
 *    - Chromium (主要)
 *    - Firefox (次要)
 *    - Mobile Chrome
 */

// ============================================================
// 测试覆盖的场景
// ============================================================

/**
 * 服务器管理测试覆盖:
 * - [x] 服务器列表页面加载
 * - [x] 服务器搜索功能
 * - [x] 服务器分类筛选
 * - [x] 服务器列表刷新
 * - [x] 服务器状态指示器显示
 * - [x] 服务器详情页基本信息
 * - [x] 服务器收藏/取消收藏
 * - [x] 返回列表页导航
 * - [x] 服务器创建表单
 * - [x] 服务器必填字段验证
 * - [x] 我的服务器列表
 * - [x] 创建服务器入口
 *
 * 工单管理测试覆盖:
 * - [x] 工单列表页面加载
 * - [x] 工单列表/空状态显示
 * - [x] 工单状态筛选
 * - [x] 创建工单入口
 * - [x] 工单创建表单
 * - [x] 工单必填字段验证
 * - [x] 工单取消创建
 * - [x] 工单详情查看
 * - [x] 工单回复发送
 * - [x] 工单状态变更
 * - [x] 工单关闭
 * - [x] 返回工单列表
 * - [x] 管理员工单管理页面
 *
 * 支付流程测试覆盖:
 * - [x] 支付页面加载
 * - [x] 支付方案选项显示
 * - [x] 自定义金额输入
 * - [x] 微信支付选项
 * - [x] 支付宝选项
 * - [x] 支付方式选择
 * - [x] 充值订单创建
 * - [x] 支付金额验证
 * - [x] 待支付订单状态
 * - [x] 订单详情查看
 * - [x] 待支付订单取消
 * - [x] 支付成功页面
 * - [x] 支付失败页面
 * - [x] 支付成功返回入口
 * - [x] 支付失败重试入口
 * - [x] 钱包页面访问
 * - [x] 钱包余额显示
 * - [x] 充值入口
 * - [x] 充值跳转到支付页
 * - [x] API 查询订单状态
 * - [x] 未认证用户订单接口访问
 */
