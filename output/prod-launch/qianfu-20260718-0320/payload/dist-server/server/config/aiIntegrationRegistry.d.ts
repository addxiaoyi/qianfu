/**
 * 全站 AI 对接能力点注册表（58 项）
 * — 供系统提示词引用，便于模型按模块回答；后续可在对应业务中逐项接入工具调用或埋点。
 */
export type AiIntegrationEntry = {
    readonly id: number;
    readonly code: string;
    readonly area: string;
    readonly hint: string;
};
export declare const AI_INTEGRATION_REGISTRY: readonly AiIntegrationEntry[];
export declare function formatAiRegistryForPrompt(maxChars?: number): string;
/** 仅注入本次请求激活的编号对应说明，降低无关条目干扰与 token */
export declare function formatAiRegistrySubsetForPrompt(ids: readonly number[], maxChars?: number): string;
//# sourceMappingURL=aiIntegrationRegistry.d.ts.map