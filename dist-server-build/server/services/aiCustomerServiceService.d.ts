export type CustomerChatMessage = {
    role: 'user' | 'assistant';
    content: string;
};
export type WikiResult = {
    title: string;
    excerpt: string;
    url?: string;
};
export declare function normalizeWikiQuery(query: string): string;
export declare function buildMinecraftWikiUrl(query: string, language: 'zh' | 'en'): string;
export declare function normalizeWikiResults(payload: unknown): WikiResult[];
export declare function parseOpenAiSseEvent(line: string): {
    text: string;
    done: boolean;
};
export declare function searchMinecraftWiki(query: string, language: 'zh' | 'en'): Promise<WikiResult[]>;
export declare function streamCustomerAnswer(input: {
    message: string;
    history: CustomerChatMessage[];
    language: 'zh' | 'en';
    page?: string;
    signal?: AbortSignal;
    onDelta: (text: string) => void;
}): Promise<{
    sources: WikiResult[];
    provider: string;
}>;
//# sourceMappingURL=aiCustomerServiceService.d.ts.map