import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');

describe('background service lifecycle cleanup', () => {
  it('closes the intelligent probe server and its local database on shutdown', () => {
    const source = read('server/intelligent-probe/index.ts');

    expect(source).toContain('let intelligentProbeServer');
    expect(source).toContain('export const stopIntelligentProbeService');
    expect(source).toContain('await new Promise<void>((resolve, reject)');
    expect(source).toContain('await prisma.$disconnect()');
  });

  it('cancels the delayed activity run when the service stops', () => {
    const source = read('server/services/activityService.ts');

    expect(source).toContain('private static initialRun');
    expect(source).toContain('clearTimeout(this.initialRun)');
  });

  it('keeps and clears the database optimizer interval', () => {
    const source = read('server/services/dbOptimizer.ts');

    expect(source).toContain('let optimizerInterval');
    expect(source).toContain('optimizerInterval = setInterval');
    expect(source).toContain('clearInterval(optimizerInterval)');
  });

  it('stops every background processor owned by the main process', () => {
    const source = read('server/index.ts');

    expect(source).toContain('stopIntelligentProbeService');
    expect(source).toContain("import { callbackQueue }");
    expect(source).toContain("import { stopCacheCleanup }");
    expect(source).toContain('await stopIntelligentProbeService()');
    expect(source).toContain('callbackQueue.stopProcessor()');
    expect(source).toContain('stopCacheCleanup()');
  });

  it('stops the Redis memory fallback cleanup timer during disconnect', () => {
    const source = read('server/services/redisService.ts');

    expect(source).toContain('this.memoryFallback.stopCleanup()');
  });

  it('stops the metrics synchronization timer during process shutdown', () => {
    const source = read('server/index.ts');

    expect(source).toContain('metricsService.stop()');
  });

  it('does not keep the process alive only for periodic cleanup', () => {
    const source = read('server/services/cleanupService.ts');

    expect(source).toMatch(/const timer = setInterval\(async \(\) =>/);
    expect(source).toContain('timer.unref?.()');
  });
});
