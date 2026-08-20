import { buildDnsRecordInputs } from './freeDomainDnsPolicy.js';
const RETRY_DELAY_MS = 60_000;
const MAX_ERROR_LENGTH = 500;
function redactError(error) {
    const message = error instanceof Error ? error.message : String(error);
    return message
        .replace(/(token|secret|access[_-]?key)\s*[:=]\s*[^\s,;]+/gi, '$1=[redacted]')
        .slice(0, MAX_ERROR_LENGTH);
}
function desiredRecords(task) {
    return buildDnsRecordInputs({
        domain: task.domain,
        target: task.target,
        port: task.port,
        ttl: task.ttl,
    });
}
export async function executeDnsTask(task, dependencies) {
    try {
        if (task.action === 'DELETE') {
            for (const record of task.records) {
                if (record.providerRecordId) {
                    await dependencies.provider.deleteRecord({ recordId: record.providerRecordId });
                }
            }
            await dependencies.repository.markCompleted(task.id);
            return;
        }
        const existing = new Set(task.records
            .filter((record) => record.providerRecordId)
            .map((record) => `${record.type}:${record.name}:${record.content}`));
        for (const record of desiredRecords(task)) {
            const key = `${record.type}:${record.name}:${record.content}`;
            if (existing.has(key))
                continue;
            const created = await dependencies.provider.ensureRecord({
                ...record,
                idempotencyKey: `dns-task:${task.id}:${record.type}:${record.name}`,
            });
            await dependencies.repository.saveRecord(task.id, record, created.recordId);
        }
        await dependencies.repository.markCompleted(task.id);
    }
    catch (error) {
        await dependencies.repository.markFailed(task.id, redactError(error), new Date(Date.now() + RETRY_DELAY_MS));
    }
}
//# sourceMappingURL=freeDomainDnsTask.js.map