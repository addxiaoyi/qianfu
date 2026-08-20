/** 安全与回答骨架（与智谱对接共用） */
export declare const AI_CORE_INSTRUCTIONS: string;
/** 与品牌、路由相关的静态知识（注入系统提示） */
export declare const AI_PRODUCT_STATIC: string;
export declare function buildAiSystemPromptBase(language: 'zh' | 'en', activeIntegrationIds?: readonly number[] | null): string;
/** 单次请求完整 system 内容；传入 activeIntegrationIds 时使用子集索引以聚焦当前页 */
export declare function buildFullAiSystemPrompt(language: 'zh' | 'en', activeIntegrationIds?: readonly number[] | null): string;
//# sourceMappingURL=aiProductKnowledge.d.ts.map