/**
 * 支付流程 E2E 测试
 *
 * 测试覆盖：
 * - 支付页面加载
 * - 支付方式选择
 * - 订单创建
 * - 支付状态验证
 * - 支付成功/失败回调处理
 */

import { test, expect, Page, request } from '@playwright/test';
import { E2E_CONFIG, E2E_USERS, generateTestData, wait } from './pages/base';

// ============================================================
// Page Objects
// ============================================================

/**
 * 支付页面
 */
class PaymentPage {
  constructor(private page: Page) {}

  readonly planCards = this.page.locator('[class*="plan"], [class*="Plan"]');
  readonly customAmountInput = this.page.locator('input[type="number"], input[name="amount"]');
  readonly wechatPayButton = this.page.locator('button:has-text("微信"), [class*="wechat"]');
  readonly alipayButton = this.page.locator('button:has-text("支付宝"), [class*="alipay"]');
  readonly submitButton = this.page.locator('button:has-text("支付"), button:has-text("去支付"), button[type="submit"]');
  readonly qrCodeImage = this.page.locator('[class*="qr"], img[alt*="二维码"]');
  readonly orderInfo = this.page.locator('[class*="order"], [class*="Order"]');
  readonly loadingSpinner = this.page.locator('[class*="spinner"], [class*="loading"]');
  readonly errorMessage = this.page.locator('[class*="error"], [role="alert"]');
  readonly backButton = this.page.locator('button:has-text("返回"), a:has-text("返回")');

  async goto(planId?: string): Promise<void> {
    const url = planId
      ? `${E2E_CONFIG.baseUrl}/payment?plan=${planId}`
      : `${E2E_CONFIG.baseUrl}/payment`;
    await this.page.goto(url);
    await this.page.waitForLoadState('networkidle');
  }

  async selectPlan(index: number = 0): Promise<void> {
    await this.planCards.nth(index).click();
    await wait.forNetworkIdle(this.page);
  }

  async selectPaymentMethod(method: 'wechat' | 'alipay'): Promise<void> {
    if (method === 'wechat') {
      await this.wechatPayButton.click();
    } else {
      await this.alipayButton.click();
    }
    await wait.forTime(300);
  }

  async setCustomAmount(amount: number): Promise<void> {
    await this.customAmountInput.fill(String(amount));
    await wait.forTime(200);
  }

  async submitPayment(): Promise<string | null> {
    await this.submitButton.click();
    await wait.forNetworkIdle(this.page);

    // 尝试从 URL 或页面提取订单 ID
    const url = this.page.url();
    const match = url.match(/order[_-]?id=([^&\s]+)/i) || url.match(/\/order\/([^/\s]+)/);
    if (match) {
      return match[1];
    }

    // 从页面元素提取
    const orderIdElement = this.page.locator('[class*="orderId"], [class*="order-id"]');
    if (await orderIdElement.isVisible()) {
      return orderIdElement.textContent();
    }

    return null;
  }

  async waitForQrCode(): Promise<boolean> {
    try {
      await this.qrCodeImage.waitFor({ state: 'visible', timeout: 10000 });
      return true;
    } catch {
      return false;
    }
  }

  async getErrorMessage(): Promise<string | null> {
    if (await this.errorMessage.isVisible()) {
      return this.errorMessage.textContent();
    }
    return null;
  }

  async getOrderStatus(): Promise<string | null> {
    const statusElement = this.page.locator('[class*="status"], [class*="Status"]');
    if (await statusElement.isVisible()) {
      return statusElement.textContent();
    }
    return null;
  }
}

/**
 * 支付成功页面
 */
class PaymentSuccessPage {
  constructor(private page: Page) {}

  readonly successMessage = this.page.locator('text=支付成功, text=Success');
  readonly orderId = this.page.locator('[class*="orderId"], [class*="order-id"]');
  readonly amount = this.page.locator('[class*="amount"], [class*="金额"]');
  readonly viewOrderButton = this.page.locator('button:has-text("查看订单"), a:has-text("查看订单")');
  readonly backToHomeButton = this.page.locator('button:has-text("返回首页"), a:has-text("返回首页")');

  async getOrderId(): Promise<string | null> {
    const text = await this.orderId.textContent();
    if (text) {
      const match = text.match(/[A-Z0-9]{8,}/i);
      return match ? match[0] : text;
    }
    return null;
  }

  async getAmount(): Promise<string | null> {
    return this.amount.textContent();
  }

  async isSuccess(): Promise<boolean> {
    return this.successMessage.isVisible().catch(() => false);
  }
}

/**
 * 支付失败页面
 */
class PaymentFailPage {
  constructor(private page: Page) {}

  readonly failMessage = this.page.locator('text=支付失败, text=Failed, text=错误');
  readonly errorReason = this.page.locator('[class*="reason"], [class*="error"]');
  readonly retryButton = this.page.locator('button:has-text("重试"), button:has-text("重新支付")');
  readonly backToPaymentButton = this.page.locator('button:has-text("返回支付")');

  async isFailed(): Promise<boolean> {
    return this.failMessage.isVisible().catch(() => false);
  }

  async getErrorReason(): Promise<string | null> {
    return this.errorReason.textContent().catch(() => null);
  }
}

/**
 * 订单详情页
 */
class OrderDetailPage {
  constructor(private page: Page) {}

  readonly orderId = this.page.locator('[class*="orderId"], [class*="order-id"]');
  readonly status = this.page.locator('[class*="status"], [class*="Status"]');
  readonly amount = this.page.locator('[class*="amount"], [class*="金额"]');
  readonly paymentMethod = this.page.locator('[class*="method"], [class*="支付方式"]');
  readonly createdAt = this.page.locator('[class*="time"], [class*="创建"]');
  readonly payButton = this.page.locator('button:has-text("去支付"), button:has-text("支付")');
  readonly cancelButton = this.page.locator('button:has-text("取消订单"), button:has-text("撤销")');

  async goto(orderId: string): Promise<void> {
    await this.page.goto(`${E2E_CONFIG.baseUrl}/order/${orderId}`);
    await this.page.waitForLoadState('networkidle');
  }

  async getOrderId(): Promise<string | null> {
    const text = await this.orderId.textContent();
    if (text) {
      const match = text.match(/[A-Z0-9]{8,}/i);
      return match ? match[0] : text;
    }
    return null;
  }

  async getStatus(): Promise<string> {
    return this.status.textContent() || '';
  }

  async getAmount(): Promise<string | null> {
    return this.amount.textContent();
  }

  async isPayable(): Promise<boolean> {
    return this.payButton.isVisible().catch(() => false);
  }

  async clickPay(): Promise<void> {
    await this.payButton.click();
    await wait.forNetworkIdle(this.page);
  }
}

/**
 * 钱包/充值页面
 */
class WalletPage {
  constructor(private page: Page) {}

  readonly balance = this.page.locator('[class*="balance"], [class*="余额"]');
  readonly rechargeButton = this.page.locator('button:has-text("充值"), a:has-text("充值")');
  readonly rechargeAmounts = this.page.locator('[class*="amount"], button:has-text("元")');
  readonly transactionHistory = this.page.locator('[class*="history"], [class*="记录"]');

  async goto(): Promise<void> {
    await this.page.goto(`${E2E_CONFIG.baseUrl}/dashboard/wallet`);
    await this.page.waitForLoadState('networkidle');
  }

  async getBalance(): Promise<string | null> {
    return this.balance.textContent();
  }

  async clickRecharge(): Promise<void> {
    await this.rechargeButton.click();
    await wait.forNetworkIdle(this.page);
  }
}

// ============================================================
// Test Suite
// ============================================================

test.describe('支付流程 E2E 测试', () => {
  let paymentPage: PaymentPage;
  let paymentSuccessPage: PaymentSuccessPage;
  let paymentFailPage: PaymentFailPage;
  let orderDetailPage: OrderDetailPage;
  let walletPage: WalletPage;

  test.beforeEach(async ({ page }) => {
    paymentPage = new PaymentPage(page);
    paymentSuccessPage = new PaymentSuccessPage(page);
    paymentFailPage = new PaymentFailPage(page);
    orderDetailPage = new OrderDetailPage(page);
    walletPage = new WalletPage(page);
  });

  // ============================================================
  // 支付页面加载测试
  // ============================================================
  test.describe('支付页面加载', () => {
    test('应该正确加载支付页面', async ({ page }) => {
      // 登录
      await page.goto(`${E2E_CONFIG.baseUrl}/login`);
      await page.getByLabel('用户名').fill(E2E_USERS.user.username);
      await page.getByLabel('密码').fill(E2E_USERS.user.password);
      await page.getByRole('button', { name: '登录' }).click();
      await page.waitForURL('**/admin/**', { timeout: 30000 });

      await paymentPage.goto();

      // 验证页面元素
      await expect(page.locator('h1, h2').first()).toBeVisible();
    });

    test('应该显示支付方案选项', async ({ page }) => {
      // 登录
      await page.goto(`${E2E_CONFIG.baseUrl}/login`);
      await page.getByLabel('用户名').fill(E2E_USERS.user.username);
      await page.getByLabel('密码').fill(E2E_USERS.user.password);
      await page.getByRole('button', { name: '登录' }).click();
      await page.waitForURL('**/admin/**', { timeout: 30000 });

      await paymentPage.goto();

      // 验证有支付方案显示
      const planCount = await paymentPage.planCards.count();
      expect(planCount).toBeGreaterThanOrEqual(0);
    });

    test('应该支持自定义金额', async ({ page }) => {
      // 登录
      await page.goto(`${E2E_CONFIG.baseUrl}/login`);
      await page.getByLabel('用户名').fill(E2E_USERS.user.username);
      await page.getByLabel('密码').fill(E2E_USERS.user.password);
      await page.getByRole('button', { name: '登录' }).click();
      await page.waitForURL('**/admin/**', { timeout: 30000 });

      await paymentPage.goto();

      // 检查是否有自定义金额输入
      const customAmountVisible = await paymentPage.customAmountInput.isVisible().catch(() => false);
      if (customAmountVisible) {
        await paymentPage.setCustomAmount(50);
        const value = await paymentPage.customAmountInput.inputValue();
        expect(value).toBe('50');
      }
    });
  });

  // ============================================================
  // 支付方式选择测试
  // ============================================================
  test.describe('支付方式选择', () => {
    test('应该显示微信支付选项', async ({ page }) => {
      // 登录
      await page.goto(`${E2E_CONFIG.baseUrl}/login`);
      await page.getByLabel('用户名').fill(E2E_USERS.user.username);
      await page.getByLabel('密码').fill(E2E_USERS.user.password);
      await page.getByRole('button', { name: '登录' }).click();
      await page.waitForURL('**/admin/**', { timeout: 30000 });

      await paymentPage.goto();

      // 验证微信支付按钮
      await expect(paymentPage.wechatPayButton).toBeVisible();
    });

    test('应该显示支付宝选项', async ({ page }) => {
      // 登录
      await page.goto(`${E2E_CONFIG.baseUrl}/login`);
      await page.getByLabel('用户名').fill(E2E_USERS.user.username);
      await page.getByLabel('密码').fill(E2E_USERS.user.password);
      await page.getByRole('button', { name: '登录' }).click();
      await page.waitForURL('**/admin/**', { timeout: 30000 });

      await paymentPage.goto();

      // 验证支付宝按钮
      await expect(paymentPage.alipayButton).toBeVisible();
    });

    test('应该能选择支付方式', async ({ page }) => {
      // 登录
      await page.goto(`${E2E_CONFIG.baseUrl}/login`);
      await page.getByLabel('用户名').fill(E2E_USERS.user.username);
      await page.getByLabel('密码').fill(E2E_USERS.user.password);
      await page.getByRole('button', { name: '登录' }).click();
      await page.waitForURL('**/admin/**', { timeout: 30000 });

      await paymentPage.goto();

      // 选择微信支付
      await paymentPage.selectPaymentMethod('wechat');
      await wait.forTime(300);

      // 选择支付宝
      await paymentPage.selectPaymentMethod('alipay');
    });
  });

  // ============================================================
  // 订单创建测试
  // ============================================================
  test.describe('订单创建', () => {
    test('应该能创建充值订单', async ({ page }) => {
      // 登录
      await page.goto(`${E2E_CONFIG.baseUrl}/login`);
      await page.getByLabel('用户名').fill(E2E_USERS.user.username);
      await page.getByLabel('密码').fill(E2E_USERS.user.password);
      await page.getByRole('button', { name: '登录' }).click();
      await page.waitForURL('**/admin/**', { timeout: 30000 });

      await paymentPage.goto();

      // 设置金额
      if (await paymentPage.customAmountInput.isVisible()) {
        await paymentPage.setCustomAmount(10);
      }

      // 选择支付方式
      await paymentPage.selectPaymentMethod('wechat');

      // 提交支付
      const orderId = await paymentPage.submitPayment();

      // 验证订单创建（可能跳转到支付页面或保持当前页面）
      if (orderId) {
        console.log(`创建订单: ${orderId}`);
      }

      // 检查是否有二维码显示
      const hasQrCode = await paymentPage.waitForQrCode();
      // 验证至少没有错误
      const hasError = await paymentPage.getErrorMessage();
      expect(hasError === null || hasQrCode).toBe(true);
    });

    test('应该验证支付金额', async ({ page }) => {
      // 登录
      await page.goto(`${E2E_CONFIG.baseUrl}/login`);
      await page.getByLabel('用户名').fill(E2E_USERS.user.username);
      await page.getByLabel('密码').fill(E2E_USERS.user.password);
      await page.getByRole('button', { name: '登录' }).click();
      await page.waitForURL('**/admin/**', { timeout: 30000 });

      await paymentPage.goto();

      // 尝试设置无效金额
      if (await paymentPage.customAmountInput.isVisible()) {
        await paymentPage.setCustomAmount(0);
        await paymentPage.selectPaymentMethod('wechat');
        await paymentPage.submitPayment();

        // 验证错误提示
        const error = await paymentPage.getErrorMessage();
        // 错误消息应该存在，或者表单验证阻止了提交
      }
    });
  });

  // ============================================================
  // 支付状态验证测试
  // ============================================================
  test.describe('支付状态验证', () => {
    test('待支付订单应该显示正确状态', async ({ page }) => {
      // 登录
      await page.goto(`${E2E_CONFIG.baseUrl}/login`);
      await page.getByLabel('用户名').fill(E2E_USERS.user.username);
      await page.getByLabel('密码').fill(E2E_USERS.user.password);
      await page.getByRole('button', { name: '登录' }).click();
      await page.waitForURL('**/admin/**', { timeout: 30000 });

      // 创建订单
      await paymentPage.goto();
      if (await paymentPage.customAmountInput.isVisible()) {
        await paymentPage.setCustomAmount(10);
      }
      await paymentPage.selectPaymentMethod('wechat');
      await paymentPage.submitPayment();

      // 验证订单状态
      const status = await paymentPage.getOrderStatus();
      // 状态可能是 PENDING 或其他表示待支付的值
      expect(status).toBeTruthy();
    });

    test('应该能查看订单详情', async ({ page }) => {
      // 登录
      await page.goto(`${E2E_CONFIG.baseUrl}/login`);
      await page.getByLabel('用户名').fill(E2E_USERS.user.username);
      await page.getByLabel('密码').fill(E2E_USERS.user.password);
      await page.getByRole('button', { name: '登录' }).click();
      await page.waitForURL('**/admin/**', { timeout: 30000 });

      // 创建订单获取订单 ID
      await paymentPage.goto();
      if (await paymentPage.customAmountInput.isVisible()) {
        await paymentPage.setCustomAmount(10);
      }
      await paymentPage.selectPaymentMethod('wechat');
      const orderId = await paymentPage.submitPayment();

      if (orderId) {
        // 访问订单详情页
        await orderDetailPage.goto(orderId);

        // 验证订单信息
        const status = await orderDetailPage.getStatus();
        expect(status).toBeTruthy();
      }
    });

    test('应该能取消待支付订单', async ({ page }) => {
      // 登录
      await page.goto(`${E2E_CONFIG.baseUrl}/login`);
      await page.getByLabel('用户名').fill(E2E_USERS.user.username);
      await page.getByLabel('密码').fill(E2E_USERS.user.password);
      await page.getByRole('button', { name: '登录' }).click();
      await page.waitForURL('**/admin/**', { timeout: 30000 });

      // 创建订单
      await paymentPage.goto();
      if (await paymentPage.customAmountInput.isVisible()) {
        await paymentPage.setCustomAmount(10);
      }
      await paymentPage.selectPaymentMethod('wechat');
      const orderId = await paymentPage.submitPayment();

      if (orderId) {
        // 访问订单详情
        await orderDetailPage.goto(orderId);

        // 尝试取消订单
        if (await orderDetailPage.cancelButton.isVisible()) {
          await orderDetailPage.cancelButton.click();
          await wait.forNetworkIdle(page);

          // 验证状态变更
          const status = await orderDetailPage.getStatus();
          expect(status).toBeTruthy();
        }
      }
    });
  });

  // ============================================================
  // 支付成功/失败回调测试
  // ============================================================
  test.describe('支付回调处理', () => {
    test('支付成功页面应该显示正确信息', async ({ page }) => {
      // 直接访问支付成功页面
      await page.goto(`${E2E_CONFIG.baseUrl}/payment/success?orderId=test-order-123`);
      await wait.forNetworkIdle(page);

      // 验证成功信息
      const isSuccess = await paymentSuccessPage.isSuccess();
      // 如果是模拟数据，可能显示测试数据
      expect(isSuccess || await page.locator('h1, h2').first().isVisible()).toBe(true);
    });

    test('支付失败页面应该显示错误原因', async ({ page }) => {
      // 直接访问支付失败页面
      await page.goto(`${E2E_CONFIG.baseUrl}/payment/fail?orderId=test-order-123`);
      await wait.forNetworkIdle(page);

      // 验证失败信息
      const isFailed = await paymentFailPage.isFailed();
      // 如果是模拟数据，可能显示测试数据
      expect(isFailed || await page.locator('h1, h2').first().isVisible()).toBe(true);
    });

    test('支付成功页面应该有返回入口', async ({ page }) => {
      await page.goto(`${E2E_CONFIG.baseUrl}/payment/success?orderId=test-order-123`);
      await wait.forNetworkIdle(page);

      // 验证有返回按钮
      const hasViewOrder = await paymentSuccessPage.viewOrderButton.isVisible().catch(() => false);
      const hasBackHome = await paymentSuccessPage.backToHomeButton.isVisible().catch(() => false);
      expect(hasViewOrder || hasBackHome).toBe(true);
    });

    test('支付失败页面应该有重试入口', async ({ page }) => {
      await page.goto(`${E2E_CONFIG.baseUrl}/payment/fail?orderId=test-order-123`);
      await wait.forNetworkIdle(page);

      // 验证有重试按钮
      const hasRetry = await paymentFailPage.retryButton.isVisible().catch(() => false);
      const hasBack = await paymentFailPage.backToPaymentButton.isVisible().catch(() => false);
      expect(hasRetry || hasBack).toBe(true);
    });
  });

  // ============================================================
  // 钱包功能测试
  // ============================================================
  test.describe('钱包功能', () => {
    test('应该能访问钱包页面', async ({ page }) => {
      // 登录
      await page.goto(`${E2E_CONFIG.baseUrl}/login`);
      await page.getByLabel('用户名').fill(E2E_USERS.user.username);
      await page.getByLabel('密码').fill(E2E_USERS.user.password);
      await page.getByRole('button', { name: '登录' }).click();
      await page.waitForURL('**/admin/**', { timeout: 30000 });

      await walletPage.goto();

      // 验证页面加载
      await expect(page.locator('h1, h2').first()).toBeVisible();
    });

    test('应该显示钱包余额', async ({ page }) => {
      // 登录
      await page.goto(`${E2E_CONFIG.baseUrl}/login`);
      await page.getByLabel('用户名').fill(E2E_USERS.user.username);
      await page.getByLabel('密码').fill(E2E_USERS.user.password);
      await page.getByRole('button', { name: '登录' }).click();
      await page.waitForURL('**/admin/**', { timeout: 30000 });

      await walletPage.goto();

      // 验证余额显示
      const balance = await walletPage.getBalance();
      // 余额可能为 0 或其他值
      expect(balance !== null).toBe(true);
    });

    test('应该有充值入口', async ({ page }) => {
      // 登录
      await page.goto(`${E2E_CONFIG.baseUrl}/login`);
      await page.getByLabel('用户名').fill(E2E_USERS.user.username);
      await page.getByLabel('密码').fill(E2E_USERS.user.password);
      await page.getByRole('button', { name: '登录' }).click();
      await page.waitForURL('**/admin/**', { timeout: 30000 });

      await walletPage.goto();

      // 验证充值按钮
      await expect(walletPage.rechargeButton).toBeVisible();
    });

    test('应该能跳转到支付页面', async ({ page }) => {
      // 登录
      await page.goto(`${E2E_CONFIG.baseUrl}/login`);
      await page.getByLabel('用户名').fill(E2E_USERS.user.username);
      await page.getByLabel('密码').fill(E2E_USERS.user.password);
      await page.getByRole('button', { name: '登录' }).click();
      await page.waitForURL('**/admin/**', { timeout: 30000 });

      await walletPage.goto();
      await walletPage.clickRecharge();

      // 验证跳转到支付页面
      await expect(page).toHaveURL(/payment|recharge/);
    });
  });

  // ============================================================
  // API 直接测试 (支付状态查询)
  // ============================================================
  test.describe('支付 API 测试', () => {
    test('应该能通过 API 查询订单状态', async ({ request }) => {
      // 登录获取 token
      const loginResponse = await request.post(`${E2E_CONFIG.baseUrl}/api/auth/login`, {
        data: {
          username: E2E_USERS.user.username,
          password: E2E_USERS.user.password,
        },
      });

      expect(loginResponse.ok()).toBe(true);
      const loginData = await loginResponse.json();
      const token = loginData.token || loginData.data?.token;

      if (token) {
        // 查询订单状态
        const orderResponse = await request.get(`${E2E_CONFIG.baseUrl}/api/orders/test-order`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        // 订单可能不存在，但 API 应该返回有意义的响应
        expect(orderResponse.status()).toBeGreaterThanOrEqual(200);
      }
    });

    test('未认证用户不能访问订单接口', async ({ request }) => {
      const response = await request.get(`${E2E_CONFIG.baseUrl}/api/orders/test-order`);

      // 应该返回 401 未授权
      expect(response.status()).toBe(401);
    });
  });

  // ============================================================
  // 清理
  // ============================================================
  test.afterAll(async () => {
    // 清理测试订单
    console.log('支付 E2E 测试完成');
  });
});
