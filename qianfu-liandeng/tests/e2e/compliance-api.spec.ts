/**
 * 合规 API E2E 测试
 * 优化项 202: 集成测试 - API端到端
 *
 * 测试覆盖：
 * - 合规报告生成
 * - 控制目标管理
 * - 安全事件管理
 * - 访问控制记录
 * - 变更管理
 * - 隐私保护
 * - 备份与恢复
 * - 数据资产管理
 */

import { test, expect, request } from '@playwright/test';
import { TEST_CONFIG, TEST_USERS, generateTestId, mockData, ApiClient, assert } from './api-helpers';

const BASE_URL = TEST_CONFIG.baseUrl;
const API_PREFIX = `${BASE_URL}/api`;

test.describe('合规 API E2E 测试', () => {
  // 认证token存储
  let adminToken: string;
  let userToken: string;

  // ==================== 认证与授权 ====================

  test.describe('认证与授权', () => {
    test('管理员应该能够登录并获取token', async () => {
      const response = await request(BASE_URL).post(`${API_PREFIX}/auth/login`).send({
        username: TEST_USERS.admin.username,
        password: TEST_USERS.admin.password,
      });

      expect(response.status()).toBe(200);
      expect(response.body).toHaveProperty('token');
      adminToken = response.body.token;
    });

    test('普通用户应该能够登录', async () => {
      const response = await request(BASE_URL).post(`${API_PREFIX}/auth/login`).send({
        username: TEST_USERS.user.username,
        password: TEST_USERS.user.password,
      });

      expect(response.status()).toBe(200);
      expect(response.body).toHaveProperty('token');
      userToken = response.body.token;
    });

    test('无效凭据应该返回401', async () => {
      const response = await request(BASE_URL).post(`${API_PREFIX}/auth/login`).send({
        username: 'nonexistent',
        password: 'wrong-password',
      });

      expect(response.status()).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    test('缺少必要字段应该返回400', async () => {
      const response = await request(BASE_URL).post(`${API_PREFIX}/auth/login`).send({
        username: 'test-user',
      });

      expect(response.status()).toBe(400);
    });
  });

  // ==================== 合规报告 ====================

  test.describe('合规报告', () => {
    test('管理员应该能够获取合规报告', async () => {
      const response = await request(BASE_URL)
        .get(`${API_PREFIX}/compliance/report`)
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ framework: 'SOC2_SECURITY' });

      expect(response.status()).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('framework');
      expect(response.body.data).toHaveProperty('generatedAt');
      expect(response.body.data).toHaveProperty('summary');
    });

    test('普通用户不应该能够获取合规报告', async () => {
      const response = await request(BASE_URL)
        .get(`${API_PREFIX}/compliance/report`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status()).toBe(403);
    });

    test('未认证请求应该返回401', async () => {
      const response = await request(BASE_URL).get(`${API_PREFIX}/compliance/report`);

      expect(response.status()).toBe(401);
    });

    test('应该支持指定报告时间范围', async () => {
      const start = '2024-01-01';
      const end = '2024-12-31';

      const response = await request(BASE_URL)
        .get(`${API_PREFIX}/compliance/report`)
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ start, end });

      expect(response.status()).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('应该能够生成审计证据', async () => {
      const response = await request(BASE_URL)
        .get(`${API_PREFIX}/compliance/audit-evidence`)
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ controls: 'CC1.1,CC1.2' });

      expect(response.status()).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('缺少controlIds参数应该返回400', async () => {
      const response = await request(BASE_URL)
        .get(`${API_PREFIX}/compliance/audit-evidence`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status()).toBe(400);
      expect(response.body.error).toBe('INVALID_REQUEST');
    });
  });

  // ==================== 控制目标管理 ====================

  test.describe('控制目标管理', () => {
    test('应该能够获取控制目标列表', async () => {
      const response = await request(BASE_URL).get(`${API_PREFIX}/compliance/controls`);

      expect(response.status()).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('controls');
      expect(Array.isArray(response.body.data.controls)).toBe(true);
    });

    test('应该能够按框架过滤控制目标', async () => {
      const response = await request(BASE_URL)
        .get(`${API_PREFIX}/compliance/controls`)
        .query({ framework: 'SOC2_SECURITY' });

      expect(response.status()).toBe(200);
      expect(response.body.data.controls.length).toBeGreaterThan(0);
    });

    test('应该能够按状态过滤控制目标', async () => {
      const response = await request(BASE_URL)
        .get(`${API_PREFIX}/compliance/controls`)
        .query({ status: 'compliant' });

      expect(response.status()).toBe(200);
    });

    test('应该能够获取特定控制目标详情', async () => {
      // 先获取列表
      const listResponse = await request(BASE_URL).get(`${API_PREFIX}/compliance/controls`);
      const controls = listResponse.body.data.controls;

      if (controls.length > 0) {
        const controlId = controls[0].id;
        const response = await request(BASE_URL).get(`${API_PREFIX}/compliance/controls/${controlId}`);

        expect(response.status()).toBe(200);
        expect(response.body.data).toHaveProperty('id');
        expect(response.body.data).toHaveProperty('name');
      }
    });

    test('不存在的控制目标应该返回404', async () => {
      const response = await request(BASE_URL).get(`${API_PREFIX}/compliance/controls/nonexistent-id`);

      expect(response.status()).toBe(404);
      expect(response.body.error).toBe('CONTROL_NOT_FOUND');
    });

    test('管理员应该能够更新控制目标', async () => {
      // 先获取一个控制目标
      const listResponse = await request(BASE_URL).get(`${API_PREFIX}/compliance/controls`);
      const controls = listResponse.body.data.controls;

      if (controls.length > 0) {
        const controlId = controls[0].id;
        const updateData = mockData.compliance.controlUpdate({
          findings: `测试发现 ${generateTestId()}`,
        });

        const response = await request(BASE_URL)
          .put(`${API_PREFIX}/compliance/controls/${controlId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send(updateData);

        expect(response.status()).toBe(200);
        expect(response.body.success).toBe(true);
      }
    });

    test('普通用户不应该能够更新控制目标', async () => {
      const updateData = mockData.compliance.controlUpdate();

      const response = await request(BASE_URL)
        .put(`${API_PREFIX}/compliance/controls/test-id`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateData);

      expect(response.status()).toBe(403);
    });
  });

  // ==================== 安全事件管理 ====================

  test.describe('安全事件管理', () => {
    test('应该能够获取安全事件列表', async () => {
      const response = await request(BASE_URL).get(`${API_PREFIX}/compliance/incidents`);

      expect(response.status()).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('incidents');
      expect(Array.isArray(response.body.data.incidents)).toBe(true);
    });

    test('应该能够按严重程度过滤', async () => {
      const response = await request(BASE_URL)
        .get(`${API_PREFIX}/compliance/incidents`)
        .query({ severity: 'critical' });

      expect(response.status()).toBe(200);
    });

    test('应该能够按状态过滤', async () => {
      const response = await request(BASE_URL)
        .get(`${API_PREFIX}/compliance/incidents`)
        .query({ status: 'open' });

      expect(response.status()).toBe(200);
    });

    test('应该能够创建安全事件', async () => {
      const incidentData = mockData.compliance.securityIncident({
        title: `安全事件测试-${generateTestId()}`,
      });

      const response = await request(BASE_URL)
        .post(`${API_PREFIX}/compliance/incidents`)
        .send(incidentData);

      expect(response.status()).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
    });

    test('缺少必填字段应该返回400', async () => {
      const response = await request(BASE_URL)
        .post(`${API_PREFIX}/compliance/incidents`)
        .send({ title: '仅标题' });

      expect(response.status()).toBe(400);
      expect(response.body.error).toBe('INVALID_REQUEST');
    });

    test('应该能够更新安全事件', async () => {
      // 先创建一个事件
      const createResponse = await request(BASE_URL)
        .post(`${API_PREFIX}/compliance/incidents`)
        .send(mockData.compliance.securityIncident());

      const incidentId = createResponse.body.data.id;

      // 更新事件
      const response = await request(BASE_URL)
        .put(`${API_PREFIX}/compliance/incidents/${incidentId}`)
        .send({ status: 'resolved', resolution: '问题已解决' });

      expect(response.status()).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('更新不存在的事件应该返回404', async () => {
      const response = await request(BASE_URL)
        .put(`${API_PREFIX}/compliance/incidents/nonexistent-id`)
        .send({ status: 'resolved' });

      expect(response.status()).toBe(404);
    });
  });

  // ==================== 访问控制记录 ====================

  test.describe('访问控制记录', () => {
    test('应该能够获取访问记录列表', async () => {
      const response = await request(BASE_URL).get(`${API_PREFIX}/compliance/access`);

      expect(response.status()).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('records');
    });

    test('应该能够按用户ID过滤', async () => {
      const response = await request(BASE_URL)
        .get(`${API_PREFIX}/compliance/access`)
        .query({ userId: 'test-user' });

      expect(response.status()).toBe(200);
    });

    test('管理员应该能够添加访问记录', async () => {
      const accessData = mockData.compliance.accessRecord();

      const response = await request(BASE_URL)
        .post(`${API_PREFIX}/compliance/access`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(accessData);

      expect(response.status()).toBe(201);
      expect(response.body.success).toBe(true);
    });

    test('普通用户不应该能够添加访问记录', async () => {
      const accessData = mockData.compliance.accessRecord();

      const response = await request(BASE_URL)
        .post(`${API_PREFIX}/compliance/access`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(accessData);

      expect(response.status()).toBe(403);
    });

    test('缺少必填字段应该返回400', async () => {
      const response = await request(BASE_URL)
        .post(`${API_PREFIX}/compliance/access`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId: 'test' });

      expect(response.status()).toBe(400);
    });
  });

  // ==================== 变更管理 ====================

  test.describe('变更管理', () => {
    test('应该能够获取变更请求列表', async () => {
      const response = await request(BASE_URL).get(`${API_PREFIX}/compliance/changes`);

      expect(response.status()).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('应该能够创建变更请求', async () => {
      const changeData = mockData.compliance.changeRequest({
        title: `变更请求-${generateTestId()}`,
      });

      const response = await request(BASE_URL)
        .post(`${API_PREFIX}/compliance/changes`)
        .send(changeData);

      expect(response.status()).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
    });

    test('缺少必填字段应该返回400', async () => {
      const response = await request(BASE_URL)
        .post(`${API_PREFIX}/compliance/changes`)
        .send({ title: '仅标题' });

      expect(response.status()).toBe(400);
    });

    test('应该能够更新变更请求', async () => {
      // 创建变更请求
      const createResponse = await request(BASE_URL)
        .post(`${API_PREFIX}/compliance/changes`)
        .send(mockData.compliance.changeRequest());

      const changeId = createResponse.body.data.id;

      // 更新
      const response = await request(BASE_URL)
        .put(`${API_PREFIX}/compliance/changes/${changeId}`)
        .send({ status: 'approved', approver: 'admin' });

      expect(response.status()).toBe(200);
    });

    test('更新不存在的变更应该返回404', async () => {
      const response = await request(BASE_URL)
        .put(`${API_PREFIX}/compliance/changes/nonexistent-id`)
        .send({ status: 'approved' });

      expect(response.status()).toBe(404);
    });
  });

  // ==================== 隐私保护 ====================

  test.describe('隐私保护', () => {
    test('应该能够获取隐私请求列表', async () => {
      const response = await request(BASE_URL).get(`${API_PREFIX}/compliance/privacy`);

      expect(response.status()).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('应该能够创建隐私请求', async () => {
      const privacyData = {
        type: 'data-access',
        requesterId: generateTestId('USER'),
      };

      const response = await request(BASE_URL)
        .post(`${API_PREFIX}/compliance/privacy`)
        .send(privacyData);

      expect(response.status()).toBe(201);
      expect(response.body.success).toBe(true);
    });

    test('应该能够获取同意记录', async () => {
      const response = await request(BASE_URL)
        .get(`${API_PREFIX}/compliance/consent`)
        .query({ userId: 'test-user' });

      expect(response.status()).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('应该能够记录用户同意', async () => {
      const consentData = {
        userId: generateTestId('USER'),
        consentType: 'terms-of-service',
        granted: true,
        version: '2.0',
        method: 'web',
      };

      const response = await request(BASE_URL)
        .post(`${API_PREFIX}/compliance/consent`)
        .send(consentData);

      expect(response.status()).toBe(201);
      expect(response.body.success).toBe(true);
    });

    test('记录同意缺少必填字段应该返回400', async () => {
      const response = await request(BASE_URL)
        .post(`${API_PREFIX}/compliance/consent`)
        .send({ userId: 'test' });

      expect(response.status()).toBe(400);
    });
  });

  // ==================== 备份与恢复 ====================

  test.describe('备份与恢复', () => {
    test('应该能够获取备份历史', async () => {
      const response = await request(BASE_URL).get(`${API_PREFIX}/compliance/backup`);

      expect(response.status()).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('backups');
    });

    test('管理员应该能够记录备份', async () => {
      const backupData = mockData.compliance.backupRecord({
        backupType: 'incremental',
      });

      const response = await request(BASE_URL)
        .post(`${API_PREFIX}/compliance/backup`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(backupData);

      expect(response.status()).toBe(201);
      expect(response.body.success).toBe(true);
    });

    test('普通用户不应该能够记录备份', async () => {
      const response = await request(BASE_URL)
        .post(`${API_PREFIX}/compliance/backup`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(mockData.compliance.backupRecord());

      expect(response.status()).toBe(403);
    });

    test('应该能够获取恢复测试历史', async () => {
      const response = await request(BASE_URL).get(`${API_PREFIX}/compliance/recovery`);

      expect(response.status()).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('管理员应该能够记录恢复测试', async () => {
      const testData = mockData.compliance.recoveryTest();

      const response = await request(BASE_URL)
        .post(`${API_PREFIX}/compliance/recovery`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(testData);

      expect(response.status()).toBe(201);
      expect(response.body.success).toBe(true);
    });
  });

  // ==================== 数据资产管理 ====================

  test.describe('数据资产管理', () => {
    test('应该能够获取数据资产列表', async () => {
      const response = await request(BASE_URL).get(`${API_PREFIX}/compliance/assets`);

      expect(response.status()).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('assets');
    });

    test('应该能够按分类过滤', async () => {
      const response = await request(BASE_URL)
        .get(`${API_PREFIX}/compliance/assets`)
        .query({ classification: 'confidential' });

      expect(response.status()).toBe(200);
    });

    test('管理员应该能够添加数据资产', async () => {
      const assetData = mockData.compliance.dataAsset({
        name: `数据资产-${generateTestId()}`,
      });

      const response = await request(BASE_URL)
        .post(`${API_PREFIX}/compliance/assets`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(assetData);

      expect(response.status()).toBe(201);
      expect(response.body.success).toBe(true);
    });

    test('普通用户不应该能够添加数据资产', async () => {
      const response = await request(BASE_URL)
        .post(`${API_PREFIX}/compliance/assets`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(mockData.compliance.dataAsset());

      expect(response.status()).toBe(403);
    });

    test('添加资产缺少必填字段应该返回400', async () => {
      const response = await request(BASE_URL)
        .post(`${API_PREFIX}/compliance/assets`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: '仅名称' });

      expect(response.status()).toBe(400);
    });
  });

  // ==================== 错误处理与边界情况 ====================

  test.describe('错误处理与边界情况', () => {
    test('无效的API路径应该返回404', async () => {
      const response = await request(BASE_URL).get(`${API_PREFIX}/compliance/nonexistent`);

      expect(response.status()).toBe(404);
    });

    test('无效的HTTP方法应该返回405', async () => {
      const response = await request(BASE_URL)
        .patch(`${API_PREFIX}/compliance/report`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status()).toBe(405);
    });

    test('无效的JSON应该返回400', async () => {
      const response = await request(BASE_URL)
        .post(`${API_PREFIX}/compliance/incidents`)
        .set('Content-Type', 'application/json')
        .send('invalid json');

      expect(response.status()).toBe(400);
    });

    test('超长输入应该被拒绝', async () => {
      const longString = 'a'.repeat(10000);

      const response = await request(BASE_URL)
        .post(`${API_PREFIX}/compliance/incidents`)
        .send({
          title: longString,
          description: longString,
          severity: 'high',
          reportedBy: 'test',
        });

      expect(response.status()).toBeGreaterThanOrEqual(400);
    });

    test('特殊字符应该被正确处理', async () => {
      const response = await request(BASE_URL)
        .post(`${API_PREFIX}/compliance/incidents`)
        .send({
          title: '测试 <script>alert("xss")</script>',
          description: "测试 'quotes' 和 \"double quotes\"",
          severity: 'low',
          reportedBy: 'test',
        });

      // 应该成功创建，特殊字符被转义或清理
      expect(response.status()).toBe(201);
    });

    test('并发请求应该正确处理', async () => {
      const requests = Array.from({ length: 5 }, () =>
        request(BASE_URL)
          .get(`${API_PREFIX}/compliance/controls`)
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status()).toBe(200);
      });
    });

    test('请求超时应该返回合适的错误', async () => {
      // 设置较短的超时
      const response = await request(BASE_URL)
        .get(`${API_PREFIX}/compliance/report`)
        .set('Authorization', `Bearer ${adminToken}`)
        .timeout(100); // 100ms超时

      expect([408, 200]).toContain(response.status());
    });
  });

  // ==================== 性能基准 ====================

  test.describe('性能基准', () => {
    test('合规报告API响应时间应该在可接受范围内', async () => {
      const start = Date.now();

      const response = await request(BASE_URL)
        .get(`${API_PREFIX}/compliance/report`)
        .set('Authorization', `Bearer ${adminToken}`);

      const duration = Date.now() - start;

      expect(response.status()).toBe(200);
      expect(duration).toBeLessThan(2000); // 2秒内响应
    });

    test('控制目标列表查询应该快速响应', async () => {
      const start = Date.now();

      const response = await request(BASE_URL)
        .get(`${API_PREFIX}/compliance/controls`);

      const duration = Date.now() - start;

      expect(response.status()).toBe(200);
      expect(duration).toBeLessThan(1000); // 1秒内响应
    });
  });
});
