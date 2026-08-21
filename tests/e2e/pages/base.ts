/**
 * E2E 测试基础页面对象
 * 提供通用的页面交互方法和辅助函数
 */

import { Page, Locator, expect } from '@playwright/test';

// 测试配置
export const E2E_CONFIG = {
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',
  defaultTimeout: 10000,
  navigationTimeout: 30000,
  retryCount: 3,
};

// 测试用户凭据
export const E2E_USERS = {
  admin: {
    username: 'test-admin',
    password: 'Test@123456',
    role: 'admin',
  },
  user: {
    username: 'test-user',
    password: 'Test@123456',
    role: 'user',
  },
};

/**
 * 通用页面基类
 */
export abstract class BasePage {
  constructor(
    protected page: Page,
    protected path: string
  ) {}

  /**
   * 导航到页面
   */
  async goto(): Promise<void> {
    await this.page.goto(`${E2E_CONFIG.baseUrl}${this.path}`);
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * 等待页面加载完成
   */
  async waitForLoad(): Promise<void> {
    await this.page.waitForLoadState('domcontentloaded');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * 点击元素并等待导航
   */
  async clickAndWaitForNavigation(locator: Locator, timeout?: number): Promise<void> {
    await Promise.all([
      this.page.waitForNavigation({ timeout: timeout || E2E_CONFIG.navigationTimeout }),
      locator.click(),
    ]);
  }

  /**
   * 等待元素可见
   */
  async waitForSelector(selector: string, timeout?: number): Promise<Locator> {
    return this.page.locator(selector).first();
  }

  /**
   * 获取当前 URL
   */
  getUrl(): string {
    return this.page.url();
  }

  /**
   * 截图保存
   */
  async screenshot(name: string): Promise<void> {
    await this.page.screenshot({ path: `coverage/screenshots/${name}.png` });
  }
}

/**
 * 认证页面对象
 */
export class LoginPage extends BasePage {
  constructor(page: Page) {
    super(page, '/login');
  }

  async login(username: string, password: string): Promise<void> {
    await this.goto();
    await this.page.getByLabel('用户名').fill(username);
    await this.page.getByLabel('密码').fill(password);
    await this.page.getByRole('button', { name: '登录' }).click();
    await this.page.waitForURL('**/admin/**', { timeout: E2E_CONFIG.navigationTimeout });
  }

  async loginAsAdmin(): Promise<void> {
    await this.login(E2E_USERS.admin.username, E2E_USERS.admin.password);
  }

  async loginAsUser(): Promise<void> {
    await this.login(E2E_USERS.user.username, E2E_USERS.user.password);
  }

  async getErrorMessage(): Promise<string | null> {
    const errorLocator = this.page.locator('[role="alert"], .text-red-500, .error');
    if (await errorLocator.isVisible()) {
      return errorLocator.textContent();
    }
    return null;
  }
}

/**
 * 等待辅助函数
 */
export const wait = {
  /**
   * 等待指定时间
   */
  async forTime(ms: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, ms));
  },

  /**
   * 等待元素出现
   */
  async forSelector(page: Page, selector: string, timeout?: number): Promise<void> {
    await page.waitForSelector(selector, { timeout: timeout || E2E_CONFIG.defaultTimeout });
  },

  /**
   * 等待元素消失
   */
  async forSelectorToDisappear(page: Page, selector: string, timeout?: number): Promise<void> {
    await page.waitForSelector(selector, { state: 'hidden', timeout: timeout || E2E_CONFIG.defaultTimeout });
  },

  /**
   * 等待网络请求完成
   */
  async forNetworkIdle(page: Page, timeout?: number): Promise<void> {
    await page.waitForLoadState('networkidle', { timeout: timeout || E2E_CONFIG.navigationTimeout });
  },
};

/**
 * 断言辅助函数
 */
export const assert = {
  /**
   * 验证页面包含文本
   */
  async containsText(page: Page, text: string): Promise<void> {
    await expect(page.getByText(text)).toBeVisible();
  },

  /**
   * 验证元素存在
   */
  async elementExists(page: Page, selector: string): Promise<void> {
    await expect(page.locator(selector).first()).toBeVisible();
  },

  /**
   * 验证 URL 匹配
   */
  async urlMatches(page: Page, pattern: string | RegExp): Promise<void> {
    await expect(page).toHaveURL(pattern);
  },

  /**
   * 验证元素数量
   */
  async elementCount(page: Page, selector: string, expectedCount: number): Promise<void> {
    await expect(page.locator(selector)).toHaveCount(expectedCount);
  },
};

/**
 * 测试数据生成器
 */
export function generateTestData(prefix: string = 'TEST'): {
  id: string;
  email: string;
  name: string;
  description: string;
} {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);

  return {
    id: `${prefix}-${timestamp}-${random}`,
    email: `test-${timestamp}-${random}@example.com`,
    name: `测试${prefix}-${timestamp}`,
    description: `这是测试${prefix}的描述信息 - ${random}`,
  };
}

/**
 * 清理辅助函数
 */
export async function cleanupTestData(page: Page, apiEndpoint: string, dataId: string): Promise<void> {
  try {
    await page.request.delete(`${E2E_CONFIG.baseUrl}${apiEndpoint}/${dataId}`);
  } catch (error) {
    console.warn(`清理测试数据失败: ${apiEndpoint}/${dataId}`, error);
  }
}

/**
 * 模拟支付回调 (用于测试)
 */
export async function simulatePaymentCallback(
  page: Page,
  orderId: string,
  status: 'COMPLETED' | 'FAILED'
): Promise<void> {
  await page.goto(`${E2E_CONFIG.baseUrl}/api/v1/test/payment/callback`);
  await page.fill('input[name="orderId"]', orderId);
  await page.fill('select[name="status"]', status);
  await page.click('button[type="submit"]');
  await wait.forNetworkIdle(page);
}
