import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');

describe('administrator AI configuration entry', () => {
  it('exposes protected readable and writable AI configuration routes', () => {
    const routes = read('server/routes/ai.ts');
    const controller = read('server/controllers/aiController.ts');
    expect(routes).toContain("router.get('/admin/config'");
    expect(routes).toContain("router.put('/admin/config'");
    expect(routes).toContain('authenticate, hasPermission([\'system_config\']), csrfProtection');
    expect(routes).toContain('hasPermission([\'system_config\'])');
    expect(routes).toContain('getAiAdminConfig');
    expect(routes).toContain('updateAiAdminConfig');
    expect(controller).toContain('AI_BASE_URL');
    expect(controller).toContain('AI_MODERATION_ENABLED');
    expect(controller).toContain('AI_ENABLED');
    expect(controller).toContain('AI_CUSTOMER_SERVICE_ENABLED');
    expect(controller).toContain('AI_STREAMING_ENABLED');
    expect(controller).toContain('readStoredOrEnv(AI_CONFIG_KEYS.customerServiceEnabled');
    const configService = read('server/services/configService.ts');
    expect(configService).toContain("logger.error('[ConfigService] Failed to read configuration'");
    expect(configService).toContain("logger.error('[ConfigService] Failed to write configuration'");
    expect(configService).toContain('throw error;');
    expect(controller).toContain('NVIDIA_API_KEY');
    expect(controller).toContain('ZHIPU_BASE_URL');
    expect(controller).toContain('AI_CONFIG_KEYS.nvidiaKey');
    expect(controller).toContain('isSecret');
    expect(controller).toContain('setConfig(key, value, true');
    expect(controller).toContain('留空保持原密钥');
    for (const key of [
      'AI_API_KEY',
      'AI_BASE_URL',
      'AI_MODEL',
      'ZHIPU_API_KEY',
      'ZHIPU_MODEL',
      'AI_MODERATION_ENABLED',
      'AI_MODERATION_MODEL',
    ]) {
      expect(controller).toContain(key);
    }
  });

  it('connects the AI configuration page to the admin shell', () => {
    const layout = read('qianfu-liandeng/src/components/layout/AdminLayout.tsx');
    const app = read('qianfu-liandeng/src/App.tsx');
    const page = read('qianfu-liandeng/src/pages/admin/AdminAiConfig.tsx');

    expect(layout).toContain("path: '/admin-ai'");
    expect(app).toContain("path=\"/admin-ai\"");
    expect(app.match(/path=\"\/admin-ai\"/g)?.length).toBe(2);
    expect(page).toContain("api.get<AiAdminConfig>('/ai/admin/config')");
    expect(page).toContain('密钥只保留在服务端');
    expect(page).toContain('内容审核');
    expect(page).toContain('接口地址');
    expect(page).toContain("api.put('/ai/admin/config'");
    expect(page).toContain('保存配置');
    expect(page).toContain('留空保持原密钥');
    expect(page).toContain('NVIDIA');
    expect(page).toContain('智谱接口地址');
    expect(page).toContain('启用 AI 总开关');
    expect(page).toContain('启用 AI 客服');
    expect(page).toContain('启用流式输出');
  });
});
