import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(path.resolve('server/routes/events.ts'), 'utf8');

describe('metrics SSE lifecycle', () => {
  it('does not write after the response is closed or destroyed', () => {
    expect(source).toContain('res.writableEnded || res.destroyed');
  });

  it('uses a one-shot close handler for the stream timer', () => {
    expect(source).toContain("req.once('close'");
    expect(source).toMatch(/clearInterval\(timer\)/);
  });
});
