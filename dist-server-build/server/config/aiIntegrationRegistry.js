export const AI_INTEGRATION_REGISTRY = [
    { id: 1, code: 'route.hash_spa', area: '导航', hint: '站点为 Hash 路由，主要路径形如 #/、#/servers/:id、#/mobile、#/me。' },
    { id: 2, code: 'route.mobile_prefix', area: '导航', hint: '移动端路径常带 #/mobile 前缀，与桌面端路由可对照切换。' },
    { id: 3, code: 'route.level_rules', area: '导航', hint: '公开等级规则页：#/level-rules 与 #/mobile/level-rules，未登录可读。' },
    { id: 4, code: 'route.legal', area: '导航', hint: '隐私与条款：#/privacy、#/terms（移动端同路径兼容）。' },
    { id: 5, code: 'route.auth_callback', area: '导航', hint: 'OAuth 回调 #/auth/callback，异常时回首页。' },
    { id: 6, code: 'route.login', area: '导航', hint: '登录入口常用 #/login，未登录操作会引导登录。' },
    { id: 7, code: 'route.editor', area: '导航', hint: '服务器编辑 #/editor/:id 或 #/editor/me（简介）。' },
    { id: 8, code: 'route.admin_prefix', area: '导航', hint: '管理相关 #/admin* 需权限，含审核、用户、工单等。' },
    { id: 9, code: 'server.list_filters', area: '服务器', hint: '列表支持分类、版本、平台、在线、排序与分页筛选。' },
    { id: 10, code: 'server.detail_tabs', area: '服务器', hint: '详情含介绍、状态/图表、评论与点赞等 Tab。' },
    { id: 11, code: 'server.like_xp', area: '服务器', hint: '点赞已通过审核的服务器可获得成长经验（后端计次）。' },
    { id: 12, code: 'server.comment_gate', area: '服务器', hint: '评论需登录；未带评论权限的角色需等级达门槛后解锁。' },
    { id: 13, code: 'server.comment_tier', area: '服务器', hint: '评论列表展示作者称号角标（信赖/资深/精英，由等级换算）。' },
    { id: 14, code: 'server.status_probe', area: '服务器', hint: '在线状态与玩家数由探测服务更新，非实时保证。' },
    { id: 15, code: 'server.report', area: '服务器', hint: '详情可发起举报，进入审核/风控流程。' },
    { id: 16, code: 'server.search_mobile', area: '服务器', hint: '移动端独立搜索页支持标签与历史。' },
    { id: 17, code: 'editor.rich_text', area: '编辑器', hint: '服务器介绍支持富文本与图片，需过内容安全与审核。' },
    { id: 18, code: 'editor.tags_versions', area: '编辑器', hint: '可填标签、支持版本、网络环境、正版验证等字段。' },
    { id: 19, code: 'editor.review_flow', area: '编辑器', hint: '新服默认待审核，通过后在列表公开。' },
    { id: 20, code: 'editor.ip_dup_check', area: '编辑器', hint: '提交时校验 IP/域名，拒绝内网与重复未拒绝条目。' },
    { id: 21, code: 'editor.mobile', area: '编辑器', hint: '移动端编辑器与桌面共用后端 API。' },
    { id: 22, code: 'editor.owner_only', area: '编辑器', hint: '非管理员仅能编辑自有服务器。' },
    { id: 23, code: 'review.batch', area: '审核', hint: '管理端支持批量通过/拒绝与备注。' },
    { id: 24, code: 'review.history', area: '审核', hint: '审核历史可追溯，用于纠纷与复盘。' },
    { id: 25, code: 'user.profile', area: '用户', hint: '资料含头像、显示名、用户名、简介、邮箱等。' },
    { id: 26, code: 'user.role_groups', area: '用户', hint: '角色与身分组并存，权限由角色默认 + 数据库权限 + 等级解锁合并。' },
    { id: 27, code: 'user.wallet', area: '用户', hint: '钱包余额与充值入口，支付走独立订单流程。' },
    { id: 28, code: 'user.csrf_session', area: '用户', hint: '写操作需 CSRF 与登录会话，AI 不得代替用户执行写操作。' },
    { id: 29, code: 'user.oauth_sync', area: '用户', hint: '支持第三方登录后同步本地用户档案。' },
    { id: 30, code: 'user.preferences', area: '用户', hint: '主题与语言等偏好可持久化。' },
    { id: 31, code: 'payment.create', area: '支付', hint: '创建支付订单可跳转三方支付页，支持轮询订单状态。' },
    { id: 32, code: 'payment.currency', area: '支付', hint: '默认人民币 CNY，与钱包联动展示。' },
    { id: 33, code: 'payment.mobile_flow', area: '支付', hint: '移动端支付页为分步向导式 UI。' },
    { id: 34, code: 'payment.idempotency', area: '支付', hint: '创建订单支持幂等键，防重复提交。' },
    { id: 35, code: 'wallet.transactions', area: '支付', hint: '钱包流水类型含充值、支付、退款等枚举。' },
    { id: 36, code: 'ticket.list', area: '工单', hint: '用户可查看与自己相关的工单列表与状态 Tab。' },
    { id: 37, code: 'ticket.detail_chat', area: '工单', hint: '工单详情为对话式，支持通知业主。' },
    { id: 38, code: 'ticket.admin', area: '工单', hint: '管理端工单队列与处理入口独立路由。' },
    { id: 39, code: 'ticket.attach', area: '工单', hint: '工单消息可能含附件策略（以实际 API 为准）。' },
    { id: 40, code: 'ticket.mobile', area: '工单', hint: '移动端工单 UI 与桌面共用后端。' },
    { id: 41, code: 'level.xp_sources', area: '等级', hint: '经验来源：点赞、评论、每日签到（UTC 日限一次）。' },
    { id: 42, code: 'level.cap100', area: '等级', hint: '等级上限 100，曲线由后端统一公式计算。' },
    { id: 43, code: 'level.unlock_perms', area: '等级', hint: '达等级解锁评分/评论等能力与额外发布位（与角色权限合并）。' },
    { id: 44, code: 'level.tier_badges', area: '等级', hint: '35/60/85 级对应信赖/资深/精英展示策略。' },
    { id: 45, code: 'level.checkin_api', area: '等级', hint: '签到接口 POST /api/user/checkin，需登录与 CSRF。' },
    { id: 46, code: 'level.rules_public', area: '等级', hint: '规则页对访客公开，便于拉新与减少客服重复问题。' },
    { id: 47, code: 'admin.users_roles', area: '管理', hint: '用户管理可调整角色与权限集合。' },
    { id: 48, code: 'admin.moderation', area: '管理', hint: '内容审核配置与违规处理相关页。' },
    { id: 49, code: 'admin.audit', area: '管理', hint: '审计日志用于安全与合规追溯。' },
    { id: 50, code: 'admin.port5555', area: '管理', hint: '特定端口访问控制与日志（若部署启用）。' },
    { id: 51, code: 'admin.cms_intro', area: '管理', hint: '首页/介绍 CMS 流水线（草稿、审核、发布）。' },
    { id: 52, code: 'admin.reports', area: '管理', hint: '举报队列与处理状态。' },
    { id: 53, code: 'ai.chat_api', area: 'AI', hint: '对话接口 POST /api/ai/chat，接智谱 GLM，带速率限制与越狱关键词拦截。' },
    { id: 54, code: 'ai.context_injection', area: 'AI', hint: '前端上报路由哈希、移动端标记与登录摘要，用于页面级答疑。' },
    { id: 55, code: 'ai.no_write', area: 'AI', hint: '模型仅提供说明与引导，不得声称已代用户提交表单或支付。' },
    { id: 56, code: 'ai.rate_limit', area: 'AI', hint: '登录用户与访客按日配额限制，超限返回友好提示。' },
    { id: 57, code: 'ai.fallback_offline', area: 'AI', hint: '上游不可用或缺 KEY 时返回离线提示，不泄露配置。' },
    { id: 58, code: 'ai.registry', area: 'AI', hint: '本注册表共 58 项，回答「全站功能」类问题时按模块归纳引用，避免编造未实现能力。' },
];
const REGISTRY_BY_ID = new Map(AI_INTEGRATION_REGISTRY.map((e) => [e.id, e]));
export function formatAiRegistryForPrompt(maxChars = 12000) {
    const lines = AI_INTEGRATION_REGISTRY.map((e) => `[${e.id}] ${e.area} · ${e.code}: ${e.hint}`);
    const text = `站点能力索引（${AI_INTEGRATION_REGISTRY.length} 项）:\n${lines.join('\n')}`;
    return text.length <= maxChars ? text : `${text.slice(0, maxChars)}\n…(truncated)`;
}
/** 仅注入本次请求激活的编号对应说明，降低无关条目干扰与 token */
export function formatAiRegistrySubsetForPrompt(ids, maxChars = 9000) {
    const uniq = [...new Set(ids)]
        .filter((i) => Number.isInteger(i) && i >= 1 && i <= AI_INTEGRATION_REGISTRY.length)
        .sort((a, b) => a - b);
    const lines = uniq.map((id) => {
        const e = REGISTRY_BY_ID.get(id);
        return e ? `[${e.id}] ${e.area} · ${e.code}: ${e.hint}` : `[${id}]`;
    });
    const text = `当前激活能力点（${uniq.length} 项）:\n${lines.join('\n')}`;
    return text.length <= maxChars ? text : `${text.slice(0, maxChars)}\n…(truncated)`;
}
//# sourceMappingURL=aiIntegrationRegistry.js.map