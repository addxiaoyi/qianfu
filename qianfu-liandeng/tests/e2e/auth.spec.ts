/**
 * 认证流程 E2E 测试
 *
 * 测试覆盖：
 * - 用户登录
 * - 登录失败处理
 * - 暴力破解防护
 * - 会话管理
 */

import { test, expect } from '@playwright/test';

// 测试配置
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TEST_USER = {
  username: 'test-admin',
  password: 'Test@123456',
};

test.describe('认证流程 E2E 测试', () => {
  test.beforeEach(async ({ page }) => {
    // 导航到登录页面
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle');
  });

  test.describe('用户登录', () => {
    test('应该成功登录并重定向到仪表板', async ({ page }) => {
      // 填写登录表单
      await page.getByLabel('用户名').fill(TEST_USER.username);
      await page.getByLabel('密码').fill(TEST_USER.password);

      // 提交表单
      await page.getByRole('button', { name: '登录' }).click();

      // 等待重定向到仪表板
      await page.waitForURL('**/admin/**');

      // 验证登录成功
      await expect(page.getByText('仪表板')).toBeVisible();
    });

    test('应该记住登录状态', async ({ page }) => {
      // 登录
      await page.getByLabel('用户名').fill(TEST_USER.username);
      await page.getByLabel('密码').fill(TEST_USER.password);
      await page.getByLabel('记住我').check();
      await page.getByRole('button', { name: '登录' }).click();

      // 刷新页面
      await page.reload();

      // 应该仍然登录
      await expect(page).not.toHaveURL('**/login**');
    });
  });

  test.describe('登录失败', () => {
    test('应该显示错误消息', async ({ page }) => {
      // 使用错误密码
      await page.getByLabel('用户名').fill(TEST_USER.username);
      await page.getByLabel('密码').fill('wrong-password');
      await page.getByRole('button', { name: '登录' }).click();

      // 验证错误消息
      await expect(page.getByText('用户名或密码错误')).toBeVisible();
    });

    test('不应该在错误消息中泄露具体原因', async ({ page }) => {
      // 测试不存在的用户
      await page.getByLabel('用户名').fill('nonexistent-user');
      await page.getByLabel('密码').fill('any-password');
      await page.getByRole('button', { name: '登录' }).click();

      // 错误消息不应该提示"用户不存在"
      await expect(page.getByText('用户不存在')).not.toBeVisible();
    });
  });

  test.describe('暴力破解防护', () => {
    test('应该在多次失败后显示验证码', async ({ page }) => {
      // 模拟多次失败登录
      for (let i = 0; i < 4; i++) {
        await page.getByLabel('用户名').fill(TEST_USER.username);
        await page.getByLabel('密码').fill('wrong-password');
        await page.getByRole('button', { name: '登录' }).click();
        await page.waitForTimeout(500);
      }

      // 应该显示验证码
      await expect(page.getByLabel('验证码')).toBeVisible();
    });

    test('应该在超限后锁定账户', async ({ page }) => {
      // 模拟超过限制次数的失败
      for (let i = 0; i < 10; i++) {
        await page.getByLabel('用户名').fill('locked-user');
        await page.getByLabel('密码').fill('wrong-password');
        await page.getByRole('button', { name: '登录' }).click();
        await page.waitForTimeout(500);
      }

      // 应该显示锁定消息
      await expect(page.getByText('账户已锁定')).toBeVisible();
    });
  });
});
