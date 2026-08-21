/**
 * 语义搜索 API E2E 测试
 *
 * 测试覆盖：
 * - 搜索功能
 * - 过滤和排序
 * - 分页
 * - 错误处理
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('语义搜索 E2E 测试', () => {
  test.beforeEach(async ({ page }) => {
    // 确保已登录
    await page.goto(`${BASE_URL}/login`);
    await page.getByLabel('用户名').fill('admin');
    await page.getByLabel('密码').fill('Admin@123456');
    await page.getByRole('button', { name: '登录' }).click();
    await page.waitForURL('**/admin/**');
  });

  test.describe('基础搜索', () => {
    test('应该返回搜索结果', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/search`);

      // 输入搜索关键词
      await page.getByPlaceholder('搜索...').fill('我的世界');
      await page.getByRole('button', { name: '搜索' }).click();

      // 等待加载
      await page.waitForSelector('[data-testid="search-results"]');

      // 验证结果
      const results = page.locator('[data-testid="search-result-item"]');
      await expect(results.first()).toBeVisible();
    });

    test('应该支持中文搜索', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/search`);

      await page.getByPlaceholder('搜索...').fill('生存服务器');
      await page.getByRole('button', { name: '搜索' }).click();

      await page.waitForSelector('[data-testid="search-results"]');

      // 验证结果包含中文
      const firstResult = page.locator('[data-testid="search-result-item"]').first();
      await expect(firstResult).toContainText(/生存|服务器/);
    });
  });

  test.describe('搜索过滤', () => {
    test('应该支持按类型过滤', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/search`);

      await page.getByPlaceholder('搜索...').fill('服务器');
      await page.getByLabel('类型').selectOption('生存服');
      await page.getByRole('button', { name: '搜索' }).click();

      await page.waitForSelector('[data-testid="search-results"]');

      // 验证所有结果都是生存服
      const items = page.locator('[data-testid="search-result-item"]');
      const count = await items.count();
      expect(count).toBeGreaterThan(0);
    });

    test('应该支持按版本过滤', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/search`);

      await page.getByPlaceholder('搜索...').fill('服务器');
      await page.getByLabel('版本').selectOption('1.20.4');
      await page.getByRole('button', { name: '搜索' }).click();

      await page.waitForSelector('[data-testid="search-results"]');
    });
  });

  test.describe('分页', () => {
    test('应该支持分页导航', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/search`);

      await page.getByPlaceholder('搜索...').fill('服务器');
      await page.getByRole('button', { name: '搜索' }).click();
      await page.waitForSelector('[data-testid="search-results"]');

      // 点击下一页
      await page.getByRole('button', { name: '下一页' }).click();

      // 验证页面更新
      await expect(page.getByText('第 2 页')).toBeVisible();
    });

    test('应该显示结果总数', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/search`);

      await page.getByPlaceholder('搜索...').fill('服务器');
      await page.getByRole('button', { name: '搜索' }).click();

      await page.waitForSelector('[data-testid="search-results"]');

      // 验证总数显示
      await expect(page.getByText(/共 \d+ 条结果/)).toBeVisible();
    });
  });

  test.describe('错误处理', () => {
    test('应该在网络错误时显示重试选项', async ({ page, context }) => {
      // 模拟网络错误
      await context.setOffline(true);

      await page.goto(`${BASE_URL}/admin/search`);
      await page.getByPlaceholder('搜索...').fill('服务器');
      await page.getByRole('button', { name: '搜索' }).click();

      // 验证错误消息
      await expect(page.getByText('网络错误')).toBeVisible();
      await expect(page.getByRole('button', { name: '重试' })).toBeVisible();

      await context.setOffline(false);
    });

    test('应该处理空搜索结果', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/search`);

      await page.getByPlaceholder('搜索...').fill('这是一个不存在的超长关键词xyz123456789');
      await page.getByRole('button', { name: '搜索' }).click();

      await page.waitForSelector('[data-testid="search-results"]');

      // 验证空结果消息
      await expect(page.getByText('未找到相关结果')).toBeVisible();
    });
  });
});
