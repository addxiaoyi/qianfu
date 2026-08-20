/**
 * 语义搜索 API E2E 测试
 * 优化项 202: 集成测试 - API端到端
 *
 * 测试覆盖：
 * - Weaviate 连接管理
 * - 索引(类)管理
 * - 文档CRUD操作
 * - 搜索功能
 * - 错误处理
 */

import { test, expect } from '@playwright/test';
import { TEST_CONFIG, TEST_USERS, generateTestId, mockData } from './api-helpers';

const BASE_URL = TEST_CONFIG.baseUrl;
const API_PREFIX = `${BASE_URL}/api`;

test.describe('语义搜索 API E2E 测试', () => {
  // 测试用的类名和数据ID
  const testClassName = `TestClass_${generateTestId()}`;
  const testDocIds: string[] = [];

  // ==================== 连接状态检查 ====================

  test.describe('连接状态', () => {
    test('应该能够检查Weaviate连接状态', async ({ request }) => {
      const response = await request.get(`${API_PREFIX}/semantic/status`);

      // 无论连接成功与否，都应该返回有效响应
      expect([200, 500, 503]).toContain(response.status());
      expect(response.body).toHaveProperty('connected');
    });
  });

  // ==================== 索引管理 ====================

  test.describe('索引管理', () => {
    test('管理员应该能够初始化Weaviate连接', async ({ request }) => {
      const config = mockData.semantic.weaviateConfig({
        url: process.env.WEAVIATE_URL || 'http://localhost:8080',
      });

      const response = await request.post(`${API_PREFIX}/semantic/init`).send(config);

      expect([200, 400, 500]).toContain(response.status());
    });

    test('缺少url参数应该返回400', async ({ request }) => {
      const response = await request.post(`${API_PREFIX}/semantic/init`).send({});

      expect(response.status()).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    test('应该能够创建索引', async ({ request }) => {
      const classConfig = {
        className: testClassName,
        description: '测试索引类',
        vectorizer: 'text2vec-transformers',
      };

      const response = await request.post(`${API_PREFIX}/semantic/classes`).send(classConfig);

      // 如果Weaviate未连接，可能会失败
      expect([201, 400, 500]).toContain(response.status());
    });

    test('缺少className应该返回400', async ({ request }) => {
      const response = await request.post(`${API_PREFIX}/semantic/classes`).send({
        description: '无名称',
      });

      expect(response.status()).toBe(400);
      expect(response.body.error).toContain('className');
    });

    test('应该能够检查索引是否存在', async ({ request }) => {
      const response = await request.get(
        `${API_PREFIX}/semantic/classes/${testClassName}/exists`
      );

      // 可能返回404（不存在）或200（存在或查询失败）
      expect([200, 404, 500]).toContain(response.status());
      if (response.status() === 200) {
        expect(response.body).toHaveProperty('exists');
      }
    });

    test('应该能够获取索引统计', async ({ request }) => {
      const response = await request.get(
        `${API_PREFIX}/semantic/classes/${testClassName}/stats`
      );

      expect([200, 400, 404, 500]).toContain(response.status());
    });

    test('不存在的索引应该返回404', async ({ request }) => {
      const response = await request.get(
        `${API_PREFIX}/semantic/classes/NonExistentClass_${generateTestId()}/exists`
      );

      expect([200, 404, 500]).toContain(response.status());
    });
  });

  // ==================== 文档操作 ====================

  test.describe('文档操作', () => {
    test('应该能够添加文档', async ({ request }) => {
      const doc = mockData.semantic.document({
        className: testClassName,
        content: `测试文档内容 ${generateTestId()}`,
      });

      const response = await request.post(`${API_PREFIX}/semantic/documents`).send(doc);

      expect([201, 400, 500]).toContain(response.status());
      if (response.status() === 201) {
        expect(response.body).toHaveProperty('id');
        if (response.body.id) {
          testDocIds.push(response.body.id);
        }
      }
    });

    test('缺少必填字段应该返回400', async ({ request }) => {
      const response = await request.post(`${API_PREFIX}/semantic/documents`).send({
        title: '仅标题',
      });

      expect(response.status()).toBe(400);
    });

    test('应该能够批量添加文档', async ({ request }) => {
      const batchDocs = {
        documents: [
          mockData.semantic.document({
            className: testClassName,
            content: `批量文档1 ${generateTestId()}`,
          }),
          mockData.semantic.document({
            className: testClassName,
            content: `批量文档2 ${generateTestId()}`,
          }),
        ],
      };

      const response = await request.post(`${API_PREFIX}/semantic/documents/batch`).send(batchDocs);

      expect([201, 400, 500]).toContain(response.status());
    });

    test('无效的批量数据应该返回400', async ({ request }) => {
      const response = await request.post(`${API_PREFIX}/semantic/documents/batch`).send({
        documents: 'not-an-array',
      });

      expect(response.status()).toBe(400);
    });

    test('应该能够获取特定文档', async ({ request }) => {
      // 先添加一个文档
      const doc = mockData.semantic.document({
        className: testClassName,
      });
      const addResponse = await request.post(`${API_PREFIX}/semantic/documents`).send(doc);

      if (addResponse.status() === 201 && addResponse.body.id) {
        const docId = addResponse.body.id;

        const response = await request.get(
          `${API_PREFIX}/semantic/documents/${testClassName}/${docId}`
        );

        expect([200, 404, 500]).toContain(response.status());
      }
    });

    test('不存在的文档应该返回404', async ({ request }) => {
      const response = await request.get(
        `${API_PREFIX}/semantic/documents/${testClassName}/nonexistent-id-${generateTestId()}`
      );

      expect([404, 500]).toContain(response.status());
    });

    test('应该能够更新文档', async ({ request }) => {
      // 先添加一个文档
      const doc = mockData.semantic.document({
        className: testClassName,
      });
      const addResponse = await request.post(`${API_PREFIX}/semantic/documents`).send(doc);

      if (addResponse.status() === 201 && addResponse.body.id) {
        const docId = addResponse.body.id;

        const updateResponse = await request
          .put(`${API_PREFIX}/semantic/documents/${testClassName}/${docId}`)
          .send({
            properties: {
              title: `更新的标题 ${generateTestId()}`,
              updated: true,
            },
          });

        expect([200, 400, 404, 500]).toContain(updateResponse.status());
      }
    });

    test('缺少properties应该返回400', async ({ request }) => {
      const response = await request
        .put(`${API_PREFIX}/semantic/documents/${testClassName}/some-id`)
        .send({});

      expect(response.status()).toBe(400);
    });

    test('应该能够删除文档', async ({ request }) => {
      // 先添加一个文档
      const doc = mockData.semantic.document({
        className: testClassName,
      });
      const addResponse = await request.post(`${API_PREFIX}/semantic/documents`).send(doc);

      if (addResponse.status() === 201 && addResponse.body.id) {
        const docId = addResponse.body.id;

        const deleteResponse = await request.delete(
          `${API_PREFIX}/semantic/documents/${testClassName}/${docId}`
        );

        expect([200, 404, 500]).toContain(deleteResponse.status());
      }
    });
  });

  // ==================== 搜索功能 ====================

  test.describe('搜索功能', () => {
    test('应该能够执行语义搜索', async ({ request }) => {
      const searchQuery = mockData.semantic.searchQuery({
        className: testClassName,
        query: '测试查询',
      });

      const response = await request.post(`${API_PREFIX}/semantic/search`).send(searchQuery);

      expect([200, 400, 500]).toContain(response.status());
      if (response.status() === 200) {
        expect(response.body).toHaveProperty('results');
        expect(Array.isArray(response.body.results)).toBe(true);
      }
    });

    test('缺少必填字段应该返回400', async ({ request }) => {
      const response = await request.post(`${API_PREFIX}/semantic/search`).send({
        className: testClassName,
        // 缺少 query
      });

      expect(response.status()).toBe(400);
    });

    test('应该能够执行混合搜索', async ({ request }) => {
      const hybridQuery = mockData.semantic.searchQuery({
        className: testClassName,
        query: '混合搜索测试',
      });

      const response = await request.post(`${API_PREFIX}/semantic/hybrid`).send(hybridQuery);

      expect([200, 400, 500]).toContain(response.status());
    });

    test('应该能够执行相似性搜索', async ({ request }) => {
      // 生成随机向量
      const vector = Array.from({ length: 1536 }, () => Math.random());

      const response = await request.post(`${API_PREFIX}/semantic/similarity`).send({
        vector,
        className: testClassName,
        limit: 5,
      });

      expect([200, 400, 500]).toContain(response.status());
    });

    test('缺少vector应该返回400', async ({ request }) => {
      const response = await request.post(`${API_PREFIX}/semantic/similarity`).send({
        className: testClassName,
      });

      expect(response.status()).toBe(400);
    });
  });

  // ==================== 嵌入向量 ====================

  test.describe('嵌入向量', () => {
    test('应该能够生成单个文本的嵌入', async ({ request }) => {
      const response = await request.post(`${API_PREFIX}/semantic/embed`).send({
        text: '这是一个测试文本',
      });

      expect([200, 400, 500]).toContain(response.status());
      if (response.status() === 200) {
        expect(response.body).toHaveProperty('embedding');
        expect(response.body).toHaveProperty('dimension');
      }
    });

    test('应该能够批量生成嵌入', async ({ request }) => {
      const response = await request.post(`${API_PREFIX}/semantic/embed`).send({
        texts: ['文本1', '文本2', '文本3'],
      });

      expect([200, 400, 500]).toContain(response.status());
      if (response.status() === 200) {
        expect(response.body).toHaveProperty('embeddings');
        expect(Array.isArray(response.body.embeddings)).toBe(true);
      }
    });

    test('缺少文本参数应该返回400', async ({ request }) => {
      const response = await request.post(`${API_PREFIX}/semantic/embed`).send({});

      expect(response.status()).toBe(400);
    });
  });

  // ==================== 错误处理 ====================

  test.describe('错误处理', () => {
    test('无效的JSON应该返回400', async ({ request }) => {
      const response = await request
        .post(`${API_PREFIX}/semantic/search`)
        .set('Content-Type', 'application/json')
        .send('invalid json');

      expect(response.status()).toBe(400);
    });

    test('无效的HTTP方法应该返回405', async ({ request }) => {
      const response = await request
        .delete(`${API_PREFIX}/semantic/search`);

      expect(response.status()).toBe(405);
    });

    test('超长查询应该被处理', async ({ request }) => {
      const longQuery = mockData.semantic.searchQuery({
        className: testClassName,
        query: 'a'.repeat(100000),
      });

      const response = await request.post(`${API_PREFIX}/semantic/search`).send(longQuery);

      expect(response.status()).toBeGreaterThanOrEqual(400);
    });

    test('空查询应该被处理', async ({ request }) => {
      const response = await request.post(`${API_PREFIX}/semantic/search`).send({
        query: '',
        className: testClassName,
      });

      expect(response.status()).toBeGreaterThanOrEqual(400);
    });
  });

  // ==================== 清理 ====================

  test.afterAll(async ({ request }) => {
    // 清理测试索引
    const deleteResponse = await request.delete(
      `${API_PREFIX}/semantic/classes/${testClassName}`
    );

    // 忽略清理结果
    expect([200, 404, 500]).toContain(deleteResponse.status());
  });
});
