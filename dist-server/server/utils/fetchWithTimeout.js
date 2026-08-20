export async function fetchWithTimeout(input, init = {}, timeoutMs = 10_000, fetcher = fetch, callerSignal) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const abortCaller = () => controller.abort();
    if (callerSignal?.aborted) {
        controller.abort();
    }
    else {
        callerSignal?.addEventListener('abort', abortCaller, { once: true });
    }
    try {
        return await fetcher(input, {
            ...init,
            signal: controller.signal,
        });
    }
    finally {
        clearTimeout(timeout);
        callerSignal?.removeEventListener('abort', abortCaller);
    }
}
//# sourceMappingURL=fetchWithTimeout.js.map