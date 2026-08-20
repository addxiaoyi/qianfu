# 优化项 491: Prompt 管理 - 版本控制

## 概述

为 AI Prompt 模板提供完整的版本控制系统，支持：
1. Prompt 模板的 CRUD 操作
2. 版本历史记录与回滚
3. 版本差异对比
4. 模板变量管理
5. Prompt 性能追踪

## 背景

随着 AI 功能在系统中的广泛应用，Prompt 模板数量增加：
- 需要追踪 Prompt 的变更历史
- 需要支持不同场景的 Prompt 变体
- 需要 A/B 测试不同 Prompt 版本
- 需要快速回滚到稳定版本

## 当前代码基础

### 已实现（优化项 489）
- `server/services/llmService.ts` - LLM 服务
- `server/services/ragService.ts` - RAG 问答服务
- `server/routes/rag.ts` - RAG API

### 现有问题
- Prompt 硬编码在代码中
- 无法追踪 Prompt 变更
- 无法快速切换不同版本
- 缺少 Prompt 性能分析

## 数据模型

### Prompt 模板 (PromptTemplate)

```typescript
interface PromptTemplate {
  id: string;
  name: string;                    // 模板名称 (如 "qa-system-prompt")
  description?: string;            // 模板描述
  category: string;               // 分类 (如 "rag", "chat", "classification")
  currentVersion: number;         // 当前激活版本号
  isActive: boolean;              // 是否启用
  variables: PromptVariable[];     // 模板变量定义
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  tags?: string[];                // 标签
}

interface PromptVariable {
  name: string;                   // 变量名
  type: 'string' | 'number' | 'boolean' | 'select';
  defaultValue?: string;          // 默认值
  description?: string;           // 变量说明
  options?: string[];             // select 类型的选项
  required: boolean;              // 是否必填
}
```

### Prompt 版本 (PromptVersion)

```typescript
interface PromptVersion {
  id: string;
  templateId: string;             // 关联的模板 ID
  version: number;                // 版本号 (自增)
  content: string;                // Prompt 内容 (支持变量占位符 {{variable}})
  variables?: Record<string, any>; // 本版本的默认变量值
  
  // 版本元数据
  changelog: string;              // 变更说明
  createdAt: Date;
  createdBy: string;
  
  // 性能指标
  usageStats?: PromptUsageStats;  // 使用统计
  
  // 状态
  status: 'draft' | 'published' | 'archived';
}

interface PromptUsageStats {
  totalInvocations: number;       // 总调用次数
  avgLatency: number;            // 平均延迟 (ms)
  successRate: number;           // 成功率
  avgTokens: number;             // 平均 Token 消耗
  feedback?: {
    thumbsUp: number;
    thumbsDown: number;
  };
}
```

### Prompt 调用记录 (PromptInvocation)

```typescript
interface PromptInvocation {
  id: string;
  templateId: string;
  version: number;
  input: {
    variables: Record<string, any>;
    rawPrompt: string;           // 渲染后的完整 Prompt
  };
  output?: {
    response: string;
    tokens: {
      prompt: number;
      completion: number;
      total: number;
    };
    latency: number;             // 响应时间 (ms)
  };
  feedback?: {
    rating?: 'positive' | 'negative' | 'neutral';
    comment?: string;
  };
  metadata: {
    userId?: string;
    sessionId?: string;
    timestamp: Date;
    source: string;              // 调用来源
  };
}
```

## 实现计划

### Phase 1: 数据库层

**文件**: `server/prisma/schema.prisma` (扩展)

```prisma
model PromptTemplate {
  id             String          @id @default(cuid())
  name           String          @unique
  description    String?
  category       String
  currentVersion Int             @default(1)
  isActive       Boolean         @default(true)
  variables      Json?          // PromptVariable[]
  tags           String[]
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt
  createdBy      String
  versions       PromptVersion[]
  invocations    PromptInvocation[]
}

model PromptVersion {
  id             String    @id @default(cuid())
  templateId     String
  template       PromptTemplate @relation(fields: [templateId], references: [id])
  version        Int
  content        String    @db.Text
  variables      Json?
  changelog      String    @default("")
  status         String    @default("draft") // draft, published, archived
  usageStats     Json?
  createdAt      DateTime  @default(now())
  createdBy      String
  invocations    PromptInvocation[]
  
  @@unique([templateId, version])
}

model PromptInvocation {
  id             String    @id @default(cuid())
  templateId     String
  template       PromptTemplate @relation(fields: [templateId], references: [id])
  version        Int
  inputVariables Json
  rawPrompt      String    @db.Text
  outputResponse String?   @db.Text
  tokens         Json?
  latencyMs      Int?
  feedback       Json?
  userId         String?
  sessionId      String?
  timestamp      DateTime  @default(now())
  source         String
}
```

### Phase 2: Prompt 版本服务

**文件**: `server/services/promptVersionService.ts`

```typescript
import { logger } from '../lib/logger';

export interface PromptTemplateInput {
  name: string;
  description?: string;
  category: string;
  variables?: PromptVariable[];
  tags?: string[];
}

export interface PromptVersionInput {
  content: string;
  variables?: Record<string, any>;
  changelog?: string;
  status?: 'draft' | 'published' | 'archived';
}

export interface PromptSearchFilter {
  category?: string;
  tags?: string[];
  isActive?: boolean;
  name?: string;
}

export interface VersionDiff {
  versionA: number;
  versionB: number;
  additions: string[];   // 新增的行
  deletions: string[];    // 删除的行
  modifications: Array<{
    oldLine: string;
    newLine: string;
    lineNumber: number;
  }>;
}

export class PromptVersionService {
  // ==================== 模板管理 ====================
  
  /**
   * 创建新的 Prompt 模板
   */
  async createTemplate(
    input: PromptTemplateInput,
    initialVersion: PromptVersionInput,
    createdBy: string
  ): Promise<{ template: PromptTemplate; version: PromptVersion }> {
    // 1. 创建模板
    const template = await prisma.promptTemplate.create({
      data: {
        name: input.name,
        description: input.description,
        category: input.category,
        variables: input.variables,
        tags: input.tags || [],
        createdBy,
        currentVersion: 1,
      },
    });

    // 2. 创建第一个版本
    const version = await this.createVersion(
      template.id,
      { ...initialVersion, status: 'published' },
      createdBy
    );

    logger.info(`Prompt template created: ${template.name} v${version.version}`);
    return { template, version };
  }

  /**
   * 获取模板列表
   */
  async listTemplates(filter?: PromptSearchFilter): Promise<PromptTemplate[]> {
    return prisma.promptTemplate.findMany({
      where: {
        ...(filter?.category && { category: filter.category }),
        ...(filter?.isActive !== undefined && { isActive: filter.isActive }),
        ...(filter?.name && { name: { contains: filter.name } }),
        ...(filter?.tags?.length && {
          tags: { hasSome: filter.tags },
        }),
      },
      include: {
        _count: {
          select: { versions: true, invocations: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * 获取模板详情
   */
  async getTemplate(id: string): Promise<PromptTemplate & { versions: PromptVersion[] }> {
    return prisma.promptTemplate.findUnique({
      where: { id },
      include: {
        versions: {
          orderBy: { version: 'desc' },
        },
      },
    });
  }

  /**
   * 更新模板元数据
   */
  async updateTemplate(
    id: string,
    updates: Partial<PromptTemplateInput>
  ): Promise<PromptTemplate> {
    return prisma.promptTemplate.update({
      where: { id },
      data: {
        ...updates,
        updatedAt: new Date(),
      },
    });
  }

  // ==================== 版本管理 ====================

  /**
   * 创建新版本
   */
  async createVersion(
    templateId: string,
    input: PromptVersionInput,
    createdBy: string
  ): Promise<PromptVersion> {
    // 获取当前最新版本号
    const latestVersion = await prisma.promptVersion.findFirst({
      where: { templateId },
      orderBy: { version: 'desc' },
    });

    const newVersionNumber = (latestVersion?.version || 0) + 1;

    // 验证 Prompt 内容中的变量
    const template = await prisma.promptTemplate.findUnique({
      where: { id: templateId },
    });
    this.validateVariables(template.variables, input.variables);

    const version = await prisma.promptVersion.create({
      data: {
        templateId,
        version: newVersionNumber,
        content: input.content,
        variables: input.variables,
        changelog: input.changelog || '',
        status: input.status || 'draft',
        createdBy,
      },
    });

    // 如果是发布状态，更新模板的当前版本
    if (input.status === 'published') {
      await prisma.promptTemplate.update({
        where: { id: templateId },
        data: { currentVersion: newVersionNumber, updatedAt: new Date() },
      });
    }

    logger.info(`Prompt version created: ${templateId} v${version.version}`);
    return version;
  }

  /**
   * 获取特定版本
   */
  async getVersion(templateId: string, version: number): Promise<PromptVersion | null> {
    return prisma.promptVersion.findUnique({
      where: {
        templateId_version: { templateId, version },
      },
    });
  }

  /**
   * 获取当前激活版本
   */
  async getCurrentVersion(templateId: string): Promise<PromptVersion | null> {
    const template = await prisma.promptTemplate.findUnique({
      where: { id: templateId },
    });
    if (!template) return null;

    return this.getVersion(templateId, template.currentVersion);
  }

  /**
   * 发布版本（设为当前激活版本）
   */
  async publishVersion(templateId: string, version: number): Promise<PromptVersion> {
    const versionRecord = await prisma.promptVersion.findUnique({
      where: { templateId_version: { templateId, version } },
    });

    if (!versionRecord) {
      throw new Error(`Version ${version} not found`);
    }

    // 将之前发布的版本标记为 archived
    await prisma.promptVersion.updateMany({
      where: {
        templateId,
        status: 'published',
        version: { not: version },
      },
      data: { status: 'archived' },
    });

    // 发布新版本
    await prisma.promptVersion.update({
      where: { templateId_version: { templateId, version } },
      data: { status: 'published' },
    });

    // 更新模板的当前版本
    await prisma.promptTemplate.update({
      where: { id: templateId },
      data: { currentVersion: version, updatedAt: new Date() },
    });

    logger.info(`Prompt version published: ${templateId} v${version}`);
    return versionRecord;
  }

  /**
   * 回滚到指定版本
   */
  async rollback(templateId: string, targetVersion: number): Promise<PromptVersion> {
    const target = await this.getVersion(templateId, targetVersion);
    if (!target) {
      throw new Error(`Version ${targetVersion} not found`);
    }

    // 创建新版本，内容复制自目标版本
    const latestVersion = await prisma.promptVersion.findFirst({
      where: { templateId },
      orderBy: { version: 'desc' },
    });

    return this.createVersion(
      templateId,
      {
        content: target.content,
        variables: target.variables as Record<string, any>,
        changelog: `Rollback to v${targetVersion}`,
        status: 'published',
      },
      'system'
    );
  }

  /**
   * 比较两个版本的差异
   */
  async diff(templateId: string, versionA: number, versionB: number): Promise<VersionDiff> {
    const [verA, verB] = await Promise.all([
      this.getVersion(templateId, versionA),
      this.getVersion(templateId, versionB),
    ]);

    if (!verA || !verB) {
      throw new Error('One or both versions not found');
    }

    const linesA = verA.content.split('\n');
    const linesB = verB.content.split('\n');

    return this.computeLineDiff(linesA, linesB, versionA, versionB);
  }

  private computeLineDiff(linesA: string[], linesB: string[], verA: number, verB: number): VersionDiff {
    const additions: string[] = [];
    const deletions: string[] = [];
    const modifications: VersionDiff['modifications'] = [];

    // 简单的行比较（生产环境建议使用 diff 库）
    const maxLen = Math.max(linesA.length, linesB.length);
    const seenB = new Set(linesB);

    for (let i = 0; i < linesA.length; i++) {
      if (!seenB.has(linesA[i])) {
        deletions.push(linesA[i]);
      }
    }

    const seenA = new Set(linesA);
    for (let i = 0; i < linesB.length; i++) {
      if (!seenA.has(linesB[i])) {
        if (linesA.includes(linesB[i])) {
          // 可能是修改的行
          const lineNumA = linesA.findIndex(l => l === linesB[i]);
          modifications.push({
            oldLine: linesA[lineNumA],
            newLine: linesB[i],
            lineNumber: i + 1,
          });
        } else {
          additions.push(linesB[i]);
        }
      }
    }

    return { versionA: verA, versionB: verB, additions, deletions, modifications };
  }

  // ==================== Prompt 渲染 ====================

  /**
   * 渲染 Prompt（替换变量）
   */
  renderPrompt(templateId: string, variables?: Record<string, any>): string | null {
    const version = this.versionCache.get(templateId);
    if (!version) return null;

    let content = version.content;

    // 替换 {{variable}} 格式的变量
    content = content.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
      if (variables && varName in variables) {
        return String(variables[varName]);
      }
      // 使用默认值
      if (version.variables && varName in (version.variables as Record<string, any>)) {
        return String((version.variables as Record<string, any>)[varName]);
      }
      return match; // 保留原占位符
    });

    return content;
  }

  // ==================== 使用统计 ====================

  /**
   * 记录 Prompt 调用
   */
  async recordInvocation(
    templateId: string,
    version: number,
    invocation: Omit<PromptInvocation, 'id' | 'templateId' | 'version'>
  ): Promise<PromptInvocation> {
    const record = await prisma.promptInvocation.create({
      data: {
        templateId,
        version,
        inputVariables: invocation.inputVariables,
        rawPrompt: invocation.rawPrompt,
        outputResponse: invocation.output?.response,
        tokens: invocation.output?.tokens,
        latencyMs: invocation.output?.latency,
        feedback: invocation.feedback,
        userId: invocation.metadata.userId,
        sessionId: invocation.metadata.sessionId,
        source: invocation.metadata.source,
      },
    });

    // 更新版本统计
    await this.updateUsageStats(templateId, version, invocation);

    return record;
  }

  private async updateUsageStats(
    templateId: string,
    version: number,
    invocation: PromptInvocation
  ): Promise<void> {
    const current = await prisma.promptVersion.findUnique({
      where: { templateId_version: { templateId, version } },
    });

    if (!current?.usageStats) return;

    const stats = current.usageStats as PromptUsageStats;
    const newStats: PromptUsageStats = {
      totalInvocations: stats.totalInvocations + 1,
      avgLatency: ((stats.avgLatency * stats.totalInvocations) + (invocation.latencyMs || 0)) / (stats.totalInvocations + 1),
      successRate: invocation.output ? (stats.successRate * stats.totalInvocations + 1) / (stats.totalInvocations + 1) : stats.successRate,
      avgTokens: invocation.tokens ? 
        ((stats.avgTokens * stats.totalInvocations) + ((invocation.tokens as any).total || 0)) / (stats.totalInvocations + 1) : stats.avgTokens,
    };

    await prisma.promptVersion.update({
      where: { templateId_version: { templateId, version } },
      data: { usageStats: newStats },
    });
  }

  /**
   * 获取使用统计
   */
  async getUsageStats(
    templateId: string,
    version?: number
  ): Promise<PromptUsageStats | null> {
    if (version !== undefined) {
      const v = await this.getVersion(templateId, version);
      return (v?.usageStats as PromptUsageStats) || null;
    }

    // 汇总所有版本
    const versions = await prisma.promptVersion.findMany({
      where: { templateId },
      select: { version: true, usageStats: true },
    });

    let totalInvocations = 0;
    let totalLatency = 0;
    let totalTokens = 0;
    let successCount = 0;

    for (const v of versions) {
      if (v.usageStats) {
        const stats = v.usageStats as PromptUsageStats;
        totalInvocations += stats.totalInvocations;
        totalLatency += stats.avgLatency * stats.totalInvocations;
        totalTokens += stats.avgTokens * stats.totalInvocations;
      }
    }

    return {
      totalInvocations,
      avgLatency: totalInvocations > 0 ? totalLatency / totalInvocations : 0,
      successRate: successCount / totalInvocations || 0,
      avgTokens: totalInvocations > 0 ? totalTokens / totalInvocations : 0,
    };
  }

  // ==================== 辅助方法 ====================

  private validateVariables(
    templateVariables: any,
    inputVariables?: Record<string, any>
  ): void {
    if (!templateVariables) return;

    const vars = templateVariables as PromptVariable[];
    for (const v of vars) {
      if (v.required && (!inputVariables || !(v.name in inputVariables))) {
        if (!v.defaultValue) {
          throw new Error(`Required variable "${v.name}" is missing`);
        }
      }
    }
  }

  // 版本缓存
  private versionCache = new Map<string, PromptVersion>();

  /**
   * 预加载模板版本到缓存
   */
  async warmCache(templateId: string): Promise<void> {
    const current = await this.getCurrentVersion(templateId);
    if (current) {
      this.versionCache.set(templateId, current);
    }
  }

  /**
   * 清除缓存
   */
  clearCache(templateId?: string): void {
    if (templateId) {
      this.versionCache.delete(templateId);
    } else {
      this.versionCache.clear();
    }
  }
}

// 单例
let promptServiceInstance: PromptVersionService | null = null;

export function initPromptVersionService(): PromptVersionService {
  promptServiceInstance = new PromptVersionService();
  return promptServiceInstance;
}

export function getPromptService(): PromptVersionService | null {
  return promptServiceInstance;
}
```

### Phase 3: Prompt API 路由

**文件**: `server/routes/promptVersion.ts`

```typescript
import { Router, Request, Response, NextFunction } from 'express';
import { getPromptService } from '../services/promptVersionService';

const router = Router();

const asyncHandler = (fn: any) => (req: Request, res: Response, next: NextFunction) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// ==================== 模板管理 ====================

// 创建模板
router.post('/templates', asyncHandler(async (req, res) => {
  const service = getPromptService();
  if (!service) {
    res.status(503).json({ error: 'Prompt service not initialized' });
    return;
  }

  const { template, version } = await service.createTemplate(
    {
      name: req.body.name,
      description: req.body.description,
      category: req.body.category,
      variables: req.body.variables,
      tags: req.body.tags,
    },
    {
      content: req.body.content,
      variables: req.body.variables,
      changelog: req.body.changelog || 'Initial version',
      status: 'published',
    },
    req.user?.id || 'system'
  );

  res.status(201).json({ template, version });
}));

// 模板列表
router.get('/templates', asyncHandler(async (req, res) => {
  const service = getPromptService();
  if (!service) {
    res.status(503).json({ error: 'Prompt service not initialized' });
    return;
  }

  const templates = await service.listTemplates({
    category: req.query.category as string,
    tags: req.query.tags ? (req.query.tags as string).split(',') : undefined,
    isActive: req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined,
    name: req.query.name as string,
  });

  res.json({ templates });
}));

// 获取模板详情
router.get('/templates/:id', asyncHandler(async (req, res) => {
  const service = getPromptService();
  if (!service) {
    res.status(503).json({ error: 'Prompt service not initialized' });
    return;
  }

  const template = await service.getTemplate(req.params.id);
  if (!template) {
    res.status(404).json({ error: 'Template not found' });
    return;
  }

  res.json({ template });
}));

// 更新模板
router.patch('/templates/:id', asyncHandler(async (req, res) => {
  const service = getPromptService();
  if (!service) {
    res.status(503).json({ error: 'Prompt service not initialized' });
    return;
  }

  const template = await service.updateTemplate(req.params.id, req.body);
  res.json({ template });
}));

// 删除模板
router.delete('/templates/:id', asyncHandler(async (req, res) => {
  await prisma.promptTemplate.delete({
    where: { id: req.params.id },
  });
  res.json({ success: true });
}));

// ==================== 版本管理 ====================

// 创建新版本
router.post('/templates/:id/versions', asyncHandler(async (req, res) => {
  const service = getPromptService();
  if (!service) {
    res.status(503).json({ error: 'Prompt service not initialized' });
    return;
  }

  const version = await service.createVersion(
    req.params.id,
    {
      content: req.body.content,
      variables: req.body.variables,
      changelog: req.body.changelog,
      status: req.body.status || 'draft',
    },
    req.user?.id || 'system'
  );

  res.status(201).json({ version });
}));

// 获取版本
router.get('/templates/:id/versions/:version', asyncHandler(async (req, res) => {
  const service = getPromptService();
  if (!service) {
    res.status(503).json({ error: 'Prompt service not initialized' });
    return;
  }

  const version = await service.getVersion(
    req.params.id,
    parseInt(req.params.version)
  );

  if (!version) {
    res.status(404).json({ error: 'Version not found' });
    return;
  }

  res.json({ version });
}));

// 发布版本
router.post('/templates/:id/versions/:version/publish', asyncHandler(async (req, res) => {
  const service = getPromptService();
  if (!service) {
    res.status(503).json({ error: 'Prompt service not initialized' });
    return;
  }

  const version = await service.publishVersion(
    req.params.id,
    parseInt(req.params.version)
  );

  res.json({ version });
}));

// 版本对比
router.get('/templates/:id/diff', asyncHandler(async (req, res) => {
  const service = getPromptService();
  if (!service) {
    res.status(503).json({ error: 'Prompt service not initialized' });
    return;
  }

  const versionA = parseInt(req.query.from as string);
  const versionB = parseInt(req.query.to as string);

  if (isNaN(versionA) || isNaN(versionB)) {
    res.status(400).json({ error: 'Missing from or to query parameters' });
    return;
  }

  const diff = await service.diff(req.params.id, versionA, versionB);
  res.json({ diff });
}));

// 回滚
router.post('/templates/:id/rollback', asyncHandler(async (req, res) => {
  const service = getPromptService();
  if (!service) {
    res.status(503).json({ error: 'Prompt service not initialized' });
    return;
  }

  const version = await service.rollback(
    req.params.id,
    parseInt(req.body.targetVersion)
  );

  res.json({ version, message: `Rolled back to v${version.version}` });
}));

// ==================== 使用统计 ====================

// 获取统计
router.get('/templates/:id/stats', asyncHandler(async (req, res) => {
  const service = getPromptService();
  if (!service) {
    res.status(503).json({ error: 'Prompt service not initialized' });
    return;
  }

  const stats = await service.getUsageStats(
    req.params.id,
    req.query.version ? parseInt(req.query.version as string) : undefined
  );

  res.json({ stats });
}));

// 记录调用
router.post('/templates/:id/invoke', asyncHandler(async (req, res) => {
  const service = getPromptService();
  if (!service) {
    res.status(503).json({ error: 'Prompt service not initialized' });
    return;
  }

  // 获取当前版本
  const version = await service.getCurrentVersion(req.params.id);
  if (!version) {
    res.status(404).json({ error: 'No active version found' });
    return;
  }

  // 渲染 Prompt
  const renderedPrompt = service.renderPrompt(req.params.id, req.body.variables);

  const startTime = Date.now();

  // TODO: 调用实际的 LLM 服务
  // 这里简化处理，实际应该调用 llmService

  const invocation = await service.recordInvocation(
    req.params.id,
    version.version,
    {
      inputVariables: req.body.variables || {},
      rawPrompt: renderedPrompt || '',
      output: req.body.response ? {
        response: req.body.response,
        tokens: req.body.tokens,
        latency: Date.now() - startTime,
      } : undefined,
      metadata: {
        userId: req.user?.id,
        sessionId: req.body.sessionId,
        source: req.body.source || 'api',
        timestamp: new Date(),
      },
    }
  );

  res.json({
    invocation,
    renderedPrompt,
    version: version.version,
  });
}));

// 用户反馈
router.post('/templates/:id/feedback', asyncHandler(async (req, res) => {
  await prisma.promptInvocation.update({
    where: { id: req.body.invocationId },
    data: {
      feedback: {
        rating: req.body.rating,
        comment: req.body.comment,
      },
    },
  });

  res.json({ success: true });
}));

// 渲染预览
router.post('/templates/:id/render', asyncHandler(async (req, res) => {
  const service = getPromptService();
  if (!service) {
    res.status(503).json({ error: 'Prompt service not initialized' });
    return;
  }

  const rendered = service.renderPrompt(req.params.id, req.body.variables);

  res.json({ rendered });
}));

export default router;
```

### Phase 4: LLM 服务集成

**文件**: `server/services/llmService.ts` (扩展)

```typescript
// 在 LLMService 中添加 Prompt 版本支持

export class LLMService {
  // ... 现有代码 ...

  /**
   * 使用 Prompt 版本进行对话
   */
  async chatWithPromptVersion(
    templateId: string,
    variables: Record<string, any>,
    options?: {
      temperature?: number;
      maxTokens?: number;
      stream?: boolean;
    }
  ): Promise<ChatCompletionResponse> {
    const promptService = getPromptService();
    if (!promptService) {
      throw new Error('Prompt service not initialized');
    }

    const version = await promptService.getCurrentVersion(templateId);
    if (!version) {
      throw new Error(`No active version for template ${templateId}`);
    }

    const renderedPrompt = promptService.renderPrompt(templateId, variables);
    if (!renderedPrompt) {
      throw new Error('Failed to render prompt');
    }

    const startTime = Date.now();

    const response = await this.chat({
      messages: [{ role: 'user', content: renderedPrompt }],
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
    });

    // 记录调用
    const latency = Date.now() - startTime;
    await promptService.recordInvocation(templateId, version.version, {
      inputVariables: variables,
      rawPrompt: renderedPrompt,
      output: {
        response: response.content,
        tokens: response.usage || { prompt: 0, completion: 0, total: 0 },
        latency,
      },
      metadata: {
        source: 'llm-service',
        timestamp: new Date(),
      },
    });

    return response;
  }
}
```

### Phase 5: 前端组件

**文件**: `src/components/PromptManager/`

```
PromptManager.tsx         # Prompt 管理主组件
TemplateList.tsx          # 模板列表
TemplateEditor.tsx         # 模板编辑器
VersionHistory.tsx         # 版本历史
VersionDiff.tsx           # 版本对比
StatsPanel.tsx            # 统计面板
```

```tsx
// src/components/PromptManager/PromptManager.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../lib/api-client';
import { TemplateList } from './TemplateList';
import { TemplateEditor } from './TemplateEditor';
import { VersionHistory } from './VersionHistory';
import { VersionDiff } from './VersionDiff';
import { StatsPanel } from './StatsPanel';

interface PromptTemplate {
  id: string;
  name: string;
  description?: string;
  category: string;
  currentVersion: number;
  isActive: boolean;
  variables?: any[];
  tags?: string[];
  versions?: PromptVersion[];
}

interface PromptVersion {
  id: string;
  version: number;
  content: string;
  changelog: string;
  status: string;
  usageStats?: any;
  createdAt: string;
  createdBy: string;
}

export function PromptManager() {
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<PromptTemplate | null>(null);
  const [activeTab, setActiveTab] = useState<'list' | 'editor' | 'history' | 'diff' | 'stats'>('list');
  const [filter, setFilter] = useState({ category: '', search: '' });
  const [loading, setLoading] = useState(false);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter.category) params.set('category', filter.category);
      if (filter.search) params.set('name', filter.search);
      
      const { data } = await apiClient.get(`/prompt/templates?${params}`);
      setTemplates(data.templates);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const handleCreateTemplate = async (templateData: any) => {
    const { data } = await apiClient.post('/prompt/templates', templateData);
    await loadTemplates();
    setSelectedTemplate(data.template);
    setActiveTab('editor');
  };

  const handleSelectTemplate = async (template: PromptTemplate) => {
    const { data } = await apiClient.get(`/prompt/templates/${template.id}`);
    setSelectedTemplate(data.template);
  };

  const handleSaveVersion = async (content: string, changelog: string) => {
    if (!selectedTemplate) return;
    
    await apiClient.post(`/prompt/templates/${selectedTemplate.id}/versions`, {
      content,
      changelog,
    });
    await loadTemplates();
  };

  const handlePublishVersion = async (version: number) => {
    if (!selectedTemplate) return;
    
    await apiClient.post(`/prompt/templates/${selectedTemplate.id}/versions/${version}/publish`);
    await loadTemplates();
  };

  const handleRollback = async (targetVersion: number) => {
    if (!selectedTemplate) return;
    
    await apiClient.post(`/prompt/templates/${selectedTemplate.id}/rollback`, {
      targetVersion,
    });
    await loadTemplates();
  };

  const renderDiff = async (from: number, to: number) => {
    if (!selectedTemplate) return null;
    
    const { data } = await apiClient.get(
      `/prompt/templates/${selectedTemplate.id}/diff?from=${from}&to=${to}`
    );
    return data.diff;
  };

  return (
    <div className="prompt-manager">
      <header className="manager-header">
        <h1>Prompt 管理</h1>
        <div className="header-actions">
          <button onClick={() => setActiveTab('list')}>模板列表</button>
          <button onClick={() => setActiveTab('editor')}>新建模板</button>
        </div>
      </header>

      <div className="manager-filters">
        <input
          type="text"
          placeholder="搜索模板..."
          value={filter.search}
          onChange={(e) => setFilter(f => ({ ...f, search: e.target.value }))}
        />
        <select
          value={filter.category}
          onChange={(e) => setFilter(f => ({ ...f, category: e.target.value }))}
        >
          <option value="">全部分类</option>
          <option value="rag">RAG</option>
          <option value="chat">对话</option>
          <option value="classification">分类</option>
        </select>
      </div>

      <main className="manager-content">
        {activeTab === 'list' && (
          <TemplateList
            templates={templates}
            onSelect={handleSelectTemplate}
            onCreate={() => setActiveTab('editor')}
          />
        )}

        {activeTab === 'editor' && selectedTemplate && (
          <TemplateEditor
            template={selectedTemplate}
            onSave={handleSaveVersion}
            onPublish={handlePublishVersion}
            onBack={() => setActiveTab('list')}
          />
        )}

        {activeTab === 'history' && selectedTemplate && (
          <VersionHistory
            versions={selectedTemplate.versions || []}
            onSelect={(v) => setSelectedTemplate({
              ...selectedTemplate,
              currentVersion: v.version,
            })}
            onPublish={handlePublishVersion}
            onRollback={handleRollback}
            onCompare={() => setActiveTab('diff')}
          />
        )}

        {activeTab === 'diff' && selectedTemplate && (
          <VersionDiff
            templateId={selectedTemplate.id}
            versions={selectedTemplate.versions || []}
            onCompare={renderDiff}
          />
        )}

        {activeTab === 'stats' && selectedTemplate && (
          <StatsPanel
            templateId={selectedTemplate.id}
            currentVersion={selectedTemplate.currentVersion}
          />
        )}
      </main>

      {selectedTemplate && (
        <aside className="template-sidebar">
          <h3>{selectedTemplate.name}</h3>
          <div className="sidebar-actions">
            <button onClick={() => setActiveTab('editor')}>编辑</button>
            <button onClick={() => setActiveTab('history')}>历史</button>
            <button onClick={() => setActiveTab('diff')}>对比</button>
            <button onClick={() => setActiveTab('stats')}>统计</button>
          </div>
          <div className="template-meta">
            <p>分类: {selectedTemplate.category}</p>
            <p>当前版本: v{selectedTemplate.currentVersion}</p>
            <p>状态: {selectedTemplate.isActive ? '启用' : '禁用'}</p>
          </div>
        </aside>
      )}
    </div>
  );
}
```

## API 总结

### 模板管理
| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/prompt/templates` | 创建模板 |
| GET | `/prompt/templates` | 列表查询 |
| GET | `/prompt/templates/:id` | 获取详情 |
| PATCH | `/prompt/templates/:id` | 更新模板 |
| DELETE | `/prompt/templates/:id` | 删除模板 |

### 版本管理
| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/prompt/templates/:id/versions` | 创建版本 |
| GET | `/prompt/templates/:id/versions/:v` | 获取版本 |
| POST | `/prompt/templates/:id/versions/:v/publish` | 发布版本 |
| GET | `/prompt/templates/:id/diff` | 版本对比 |
| POST | `/prompt/templates/:id/rollback` | 回滚 |

### 使用追踪
| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/prompt/templates/:id/stats` | 获取统计 |
| POST | `/prompt/templates/:id/invoke` | 记录调用 |
| POST | `/prompt/templates/:id/feedback` | 用户反馈 |
| POST | `/prompt/templates/:id/render` | 渲染预览 |

## 环境变量

```env
# =================== Prompt 版本控制 ===================
PROMPT_CACHE_ENABLED=true
PROMPT_CACHE_TTL=3600
```

## 里程碑

- [ ] Phase 1: 数据库层扩展
- [ ] Phase 2: Prompt 版本服务
- [ ] Phase 3: API 路由
- [ ] Phase 4: LLM 服务集成
- [ ] Phase 5: 前端组件
- [ ] 缓存优化
- [ ] 测试覆盖
