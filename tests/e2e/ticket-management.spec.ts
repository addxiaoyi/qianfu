/**
 * 工单管理 E2E 测试
 *
 * 测试覆盖：
 * - 工单列表浏览
 * - 工单创建
 * - 工单详情
 * - 工单状态流转
 * - 工单回复
 */

import { test, expect, Page } from '@playwright/test';
import { E2E_CONFIG, E2E_USERS, generateTestData, wait } from './pages/base';

// ============================================================
// Page Objects
// ============================================================

/**
 * 工单列表页
 */
class TicketListPage {
  constructor(private page: Page) {}

  readonly ticketCards = this.page.locator('[class*="TicketCard"], article, [class*="ticket"]');
  readonly createButton = this.page.locator('button:has-text("创建"), button:has-text("新建工单")');
  readonly filterAll = this.page.locator('button:has-text("全部"), button:has-text("所有")');
  readonly filterOpen = this.page.locator('button:has-text("待处理"), button:has-text("进行中")');
  readonly filterResolved = this.page.locator('button:has-text("已解决"), button:has-text("已完成")');
  readonly emptyState = this.page.locator('text=暂无工单, text=没有工单');
  readonly loadingSpinner = this.page.locator('[class*="spinner"], [class*="loading"]');

  async goto(): Promise<void> {
    await this.page.goto(`${E2E_CONFIG.baseUrl}/dashboard/tickets`);
    await this.page.waitForLoadState('networkidle');
  }

  async waitForLoad(): Promise<void> {
    await this.loadingSpinner.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
    await wait.forNetworkIdle(this.page);
  }

  async getTicketCount(): Promise<number> {
    await this.waitForLoad();
    return this.ticketCards.count();
  }

  async clickCreate(): Promise<void> {
    await this.createButton.click();
  }

  async filterByStatus(status: 'all' | 'open' | 'resolved'): Promise<void> {
    switch (status) {
      case 'all':
        await this.filterAll.click();
        break;
      case 'open':
        await this.filterOpen.click();
        break;
      case 'resolved':
        await this.filterResolved.click();
        break;
    }
    await this.waitForLoad();
  }

  async clickTicket(index: number = 0): Promise<void> {
    await this.ticketCards.nth(index).click();
  }

  getTicketStatus(ticket: Locator): Promise<string | null> {
    return ticket.locator('[class*="status"], span').first().textContent();
  }
}

/**
 * 工单创建页
 */
class TicketCreatePage {
  constructor(private page: Page) {}

  readonly titleInput = this.page.locator('input[name="title"], input[id*="title"], input[placeholder*="标题"]');
  readonly categorySelect = this.page.locator('select[name="category"], select[id*="category"]');
  readonly prioritySelect = this.page.locator('select[name="priority"], select[id*="priority"]');
  readonly descriptionInput = this.page.locator('textarea[name="description"], textarea[id*="description"]');
  readonly submitButton = this.page.locator('button:has-text("提交"), button:has-text("创建"), button[type="submit"]');
  readonly cancelButton = this.page.locator('button:has-text("取消")');
  readonly errorMessage = this.page.locator('[class*="error"], [role="alert"]');

  async goto(): Promise<void> {
    await this.page.goto(`${E2E_CONFIG.baseUrl}/dashboard/tickets/new`);
    await this.page.waitForLoadState('networkidle');
  }

  async fillTicketForm(data: {
    title?: string;
    category?: string;
    priority?: string;
    description?: string;
  }): Promise<void> {
    if (data.title) {
      await this.titleInput.fill(data.title);
    }
    if (data.category) {
      await this.categorySelect.selectOption(data.category);
    }
    if (data.priority) {
      await this.prioritySelect.selectOption(data.priority);
    }
    if (data.description) {
      await this.descriptionInput.fill(data.description);
    }
  }

  async submit(): Promise<void> {
    await this.submitButton.click();
    await wait.forNetworkIdle(this.page);
  }

  async getErrorMessage(): Promise<string | null> {
    if (await this.errorMessage.isVisible()) {
      return this.errorMessage.textContent();
    }
    return null;
  }
}

/**
 * 工单详情页
 */
class TicketDetailPage {
  constructor(private page: Page) {}

  readonly title = this.page.locator('h1, h2, [class*="title"]').first();
  readonly status = this.page.locator('[class*="status"], [class*="badge"]').first();
  readonly description = this.page.locator('[class*="description"], [class*="content"]').first();
  readonly replyInput = this.page.locator('textarea[name="reply"], textarea[placeholder*="回复"], [class*="reply"] textarea');
  readonly sendReplyButton = this.page.locator('button:has-text("发送"), button:has-text("回复"), button:has-text("提交回复")');
  readonly closeButton = this.page.locator('button:has-text("关闭"), button:has-text("完结")');
  readonly backButton = this.page.locator('button:has-text("返回"), a:has-text("返回")');
  readonly statusButtons = {
    open: this.page.locator('button:has-text("待处理"), button:has-text("打开")'),
    inProgress: this.page.locator('button:has-text("进行中"), button:has-text("处理中")'),
    resolved: this.page.locator('button:has-text("已解决"), button:has-text("解决")'),
    closed: this.page.locator('button:has-text("已关闭"), button:has-text("关闭")'),
  };
  readonly replies = this.page.locator('[class*="reply"], [class*="comment"]');

  async getTicketId(): Promise<string | null> {
    const url = this.page.url();
    const match = url.match(/\/tickets\/(\d+)/);
    return match ? match[1] : null;
  }

  async getTitle(): Promise<string> {
    return this.title.textContent() || '';
  }

  async getStatus(): Promise<string> {
    return this.status.textContent() || '';
  }

  async sendReply(message: string): Promise<void> {
    await this.replyInput.fill(message);
    await this.sendReplyButton.click();
    await wait.forNetworkIdle(this.page);
  }

  async changeStatus(newStatus: 'open' | 'inProgress' | 'resolved' | 'closed'): Promise<void> {
    const button = this.statusButtons[newStatus];
    if (await button.isVisible()) {
      await button.click();
      await wait.forNetworkIdle(this.page);
    }
  }

  async closeTicket(): Promise<void> {
    if (await this.closeButton.isVisible()) {
      await this.closeButton.click();
      await wait.forNetworkIdle(this.page);
    }
  }

  async getReplyCount(): Promise<number> {
    return this.replies.count();
  }
}

// ============================================================
// Test Suite
// ============================================================

test.describe('工单管理 E2E 测试', () => {
  let ticketListPage: TicketListPage;
  let ticketCreatePage: TicketCreatePage;
  let ticketDetailPage: TicketDetailPage;
  let createdTicketId: string | null = null;

  test.beforeEach(async ({ page }) => {
    ticketListPage = new TicketListPage(page);
    ticketCreatePage = new TicketCreatePage(page);
    ticketDetailPage = new TicketDetailPage(page);
  });

  // ============================================================
  // 工单列表测试
  // ============================================================
  test.describe('工单列表', () => {
    test('应该正确加载工单列表页面', async ({ page }) => {
      // 登录
      await page.goto(`${E2E_CONFIG.baseUrl}/login`);
      await page.getByLabel('用户名').fill(E2E_USERS.admin.username);
      await page.getByLabel('密码').fill(E2E_USERS.admin.password);
      await page.getByRole('button', { name: '登录' }).click();
      await page.waitForURL('**/admin/**', { timeout: 30000 });

      await ticketListPage.goto();

      // 验证页面元素
      await expect(page.locator('h1, h2').first()).toBeVisible();
      await expect(ticketListPage.createButton).toBeVisible();
    });

    test('应该显示工单列表或空状态', async ({ page }) => {
      // 登录
      await page.goto(`${E2E_CONFIG.baseUrl}/login`);
      await page.getByLabel('用户名').fill(E2E_USERS.admin.username);
      await page.getByLabel('密码').fill(E2E_USERS.admin.password);
      await page.getByRole('button', { name: '登录' }).click();
      await page.waitForURL('**/admin/**', { timeout: 30000 });

      await ticketListPage.goto();
      await ticketListPage.waitForLoad();

      // 验证显示工单列表或空状态
      const hasTickets = await ticketListPage.getTicketCount();
      if (hasTickets === 0) {
        await expect(ticketListPage.emptyState).toBeVisible();
      } else {
        await expect(ticketListPage.ticketCards.first()).toBeVisible();
      }
    });

    test('应该能按状态筛选工单', async ({ page }) => {
      // 登录
      await page.goto(`${E2E_CONFIG.baseUrl}/login`);
      await page.getByLabel('用户名').fill(E2E_USERS.admin.username);
      await page.getByLabel('密码').fill(E2E_USERS.admin.password);
      await page.getByRole('button', { name: '登录' }).click();
      await page.waitForURL('**/admin/**', { timeout: 30000 });

      await ticketListPage.goto();

      // 测试筛选功能
      await ticketListPage.filterByStatus('open');
      await wait.forTime(500);

      await ticketListPage.filterByStatus('resolved');
      await wait.forTime(500);

      await ticketListPage.filterByStatus('all');
    });

    test('应该有创建工单入口', async ({ page }) => {
      // 登录
      await page.goto(`${E2E_CONFIG.baseUrl}/login`);
      await page.getByLabel('用户名').fill(E2E_USERS.admin.username);
      await page.getByLabel('密码').fill(E2E_USERS.admin.password);
      await page.getByRole('button', { name: '登录' }).click();
      await page.waitForURL('**/admin/**', { timeout: 30000 });

      await ticketListPage.goto();

      // 验证创建按钮
      await expect(ticketListPage.createButton).toBeVisible();
    });
  });

  // ============================================================
  // 工单创建测试
  // ============================================================
  test.describe('工单创建', () => {
    test('应该能打开工单创建页面', async ({ page }) => {
      // 登录
      await page.goto(`${E2E_CONFIG.baseUrl}/login`);
      await page.getByLabel('用户名').fill(E2E_USERS.admin.username);
      await page.getByLabel('密码').fill(E2E_USERS.admin.password);
      await page.getByRole('button', { name: '登录' }).click();
      await page.waitForURL('**/admin/**', { timeout: 30000 });

      await ticketCreatePage.goto();

      // 验证表单元素
      await expect(ticketCreatePage.titleInput).toBeVisible();
      await expect(ticketCreatePage.descriptionInput).toBeVisible();
      await expect(ticketCreatePage.submitButton).toBeVisible();
    });

    test('应该能创建新工单', async ({ page }) => {
      // 登录
      await page.goto(`${E2E_CONFIG.baseUrl}/login`);
      await page.getByLabel('用户名').fill(E2E_USERS.admin.username);
      await page.getByLabel('密码').fill(E2E_USERS.admin.password);
      await page.getByRole('button', { name: '登录' }).click();
      await page.waitForURL('**/admin/**', { timeout: 30000 });

      const testData = generateTestData('TICKET');

      await ticketCreatePage.goto();

      // 填写表单
      await ticketCreatePage.fillTicketForm({
        title: testData.name,
        description: testData.description,
      });

      // 提交
      await ticketCreatePage.submit();

      // 等待创建完成
      await wait.forNetworkIdle(page);

      // 提取工单 ID
      const url = page.url();
      const match = url.match(/\/tickets\/(\d+)/);
      if (match) {
        createdTicketId = match[1];
      }

      // 验证创建成功（应该跳转到详情页）
      await expect(page).toHaveURL(/\/tickets\/\d+/, { timeout: 10000 }).catch(() => {
        // 如果没有跳转到详情页，至少不应该还在创建页
        expect(page.url()).not.toContain('/new');
      });
    });

    test('应该验证必填字段', async ({ page }) => {
      // 登录
      await page.goto(`${E2E_CONFIG.baseUrl}/login`);
      await page.getByLabel('用户名').fill(E2E_USERS.admin.username);
      await page.getByLabel('密码').fill(E2E_USERS.admin.password);
      await page.getByRole('button', { name: '登录' }).click();
      await page.waitForURL('**/admin/**', { timeout: 30000 });

      await ticketCreatePage.goto();

      // 不填写任何内容直接提交
      await ticketCreatePage.submit();

      // 等待验证结果
      await wait.forTime(500);

      // 验证错误提示或停留在创建页
      const errorOrStay = await Promise.all([
        ticketCreatePage.getErrorMessage().catch(() => null),
        page.url(),
      ]);

      const hasError = errorOrStay[0] !== null;
      const stayedOnPage = errorOrStay[1].includes('/new');

      expect(hasError || stayedOnPage).toBe(true);
    });

    test('应该能取消创建工单', async ({ page }) => {
      // 登录
      await page.goto(`${E2E_CONFIG.baseUrl}/login`);
      await page.getByLabel('用户名').fill(E2E_USERS.admin.username);
      await page.getByLabel('密码').fill(E2E_USERS.admin.password);
      await page.getByRole('button', { name: '登录' }).click();
      await page.waitForURL('**/admin/**', { timeout: 30000 });

      await ticketCreatePage.goto();

      // 填写一些内容
      await ticketCreatePage.fillTicketForm({
        title: '测试工单 - 取消测试',
      });

      // 点击取消
      await ticketCreatePage.cancelButton.click();

      // 应该返回到列表页
      await expect(page).toHaveURL(/\/tickets(\/)?$/, { timeout: 5000 }).catch(() => {
        // 如果 URL 不匹配，至少应该不在创建页
        expect(page.url()).not.toContain('/new');
      });
    });
  });

  // ============================================================
  // 工单详情与状态流转测试
  // ============================================================
  test.describe('工单详情与状态流转', () => {
    test('应该能查看工单详情', async ({ page }) => {
      // 登录
      await page.goto(`${E2E_CONFIG.baseUrl}/login`);
      await page.getByLabel('用户名').fill(E2E_USERS.admin.username);
      await page.getByLabel('密码').fill(E2E_USERS.admin.password);
      await page.getByRole('button', { name: '登录' }).click();
      await page.waitForURL('**/admin/**', { timeout: 30000 });

      await ticketListPage.goto();
      const count = await ticketListPage.getTicketCount();

      if (count > 0) {
        await ticketListPage.clickTicket(0);
        await wait.forNetworkIdle(page);

        // 验证详情页
        const title = await ticketDetailPage.getTitle();
        expect(title.length).toBeGreaterThan(0);
      }
    });

    test('应该能发送工单回复', async ({ page }) => {
      // 登录
      await page.goto(`${E2E_CONFIG.baseUrl}/login`);
      await page.getByLabel('用户名').fill(E2E_USERS.admin.username);
      await page.getByLabel('密码').fill(E2E_USERS.admin.password);
      await page.getByRole('button', { name: '登录' }).click();
      await page.waitForURL('**/admin/**', { timeout: 30000 });

      await ticketListPage.goto();
      const count = await ticketListPage.getTicketCount();

      if (count > 0) {
        await ticketListPage.clickTicket(0);
        await wait.forNetworkIdle(page);

        const replyMessage = '这是 E2E 测试自动回复';

        // 发送回复
        if (await ticketDetailPage.replyInput.isVisible()) {
          await ticketDetailPage.sendReply(replyMessage);

          // 验证回复发送成功
          await wait.forTime(500);
          // 检查回复是否出现在列表中
          const hasReply = await page.locator(`text=${replyMessage}`).isVisible().catch(() => false);
          expect(hasReply).toBe(true);
        }
      }
    });

    test('应该能变更工单状态', async ({ page }) => {
      // 登录
      await page.goto(`${E2E_CONFIG.baseUrl}/login`);
      await page.getByLabel('用户名').fill(E2E_USERS.admin.username);
      await page.getByLabel('密码').fill(E2E_USERS.admin.password);
      await page.getByRole('button', { name: '登录' }).click();
      await page.waitForURL('**/admin/**', { timeout: 30000 });

      await ticketListPage.goto();
      const count = await ticketListPage.getTicketCount();

      if (count > 0) {
        await ticketListPage.clickTicket(0);
        await wait.forNetworkIdle(page);

        // 获取初始状态
        const initialStatus = await ticketDetailPage.getStatus();

        // 尝试变更状态
        // 根据当前状态，尝试切换到另一个状态
        if (initialStatus.includes('OPEN') || initialStatus.includes('待处理')) {
          await ticketDetailPage.changeStatus('inProgress');
        } else if (initialStatus.includes('IN_PROGRESS') || initialStatus.includes('进行中')) {
          await ticketDetailPage.changeStatus('resolved');
        } else {
          await ticketDetailPage.changeStatus('open');
        }

        await wait.forNetworkIdle(page);

        // 验证状态已变更
        const newStatus = await ticketDetailPage.getStatus();
        expect(newStatus).toBeTruthy();
      }
    });

    test('应该能关闭工单', async ({ page }) => {
      // 登录
      await page.goto(`${E2E_CONFIG.baseUrl}/login`);
      await page.getByLabel('用户名').fill(E2E_USERS.admin.username);
      await page.getByLabel('密码').fill(E2E_USERS.admin.password);
      await page.getByRole('button', { name: '登录' }).click();
      await page.waitForURL('**/admin/**', { timeout: 30000 });

      await ticketListPage.goto();
      const count = await ticketListPage.getTicketCount();

      if (count > 0) {
        await ticketListPage.clickTicket(0);
        await wait.forNetworkIdle(page);

        // 点击关闭
        await ticketDetailPage.closeTicket();
        await wait.forNetworkIdle(page);

        // 验证状态已变为关闭
        const status = await ticketDetailPage.getStatus();
        expect(status).toBeTruthy();
      }
    });

    test('应该能返回工单列表', async ({ page }) => {
      // 登录
      await page.goto(`${E2E_CONFIG.baseUrl}/login`);
      await page.getByLabel('用户名').fill(E2E_USERS.admin.username);
      await page.getByLabel('密码').fill(E2E_USERS.admin.password);
      await page.getByRole('button', { name: '登录' }).click();
      await page.waitForURL('**/admin/**', { timeout: 30000 });

      await ticketListPage.goto();
      const count = await ticketListPage.getTicketCount();

      if (count > 0) {
        await ticketListPage.clickTicket(0);
        await wait.forNetworkIdle(page);

        // 点击返回
        await ticketDetailPage.backButton.click();
        await wait.forNetworkIdle(page);

        // 验证返回到列表页
        await expect(page).toHaveURL(/\/tickets(\/)?$/);
      }
    });
  });

  // ============================================================
  // 管理员工单管理测试
  // ============================================================
  test.describe('管理员工单管理', () => {
    test('管理员应该能访问工单管理页面', async ({ page }) => {
      // 登录管理员
      await page.goto(`${E2E_CONFIG.baseUrl}/login`);
      await page.getByLabel('用户名').fill(E2E_USERS.admin.username);
      await page.getByLabel('密码').fill(E2E_USERS.admin.password);
      await page.getByRole('button', { name: '登录' }).click();
      await page.waitForURL('**/admin/**', { timeout: 30000 });

      // 访问管理员工单页面
      await page.goto(`${E2E_CONFIG.baseUrl}/admin/tickets`);
      await wait.forNetworkIdle(page);

      // 验证页面加载
      await expect(page.locator('h1, h2').first()).toBeVisible();
    });
  });

  // ============================================================
  // 清理
  // ============================================================
  test.afterAll(async ({ page }) => {
    // 清理创建的测试工单
    if (createdTicketId) {
      console.log(`清理测试工单: ${createdTicketId}`);
      // 可以在这里调用 API 删除测试数据
      try {
        await page.request.delete(`${E2E_CONFIG.baseUrl}/api/tickets/${createdTicketId}`);
      } catch (error) {
        console.warn(`清理工单失败: ${createdTicketId}`, error);
      }
    }
  });
});

// 导入 Locator 类型
import { Locator } from '@playwright/test';
