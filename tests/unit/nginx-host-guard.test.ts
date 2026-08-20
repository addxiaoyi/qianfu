import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('production Nginx host guard', () => {
  it('rejects unknown hosts in both HTTP and HTTPS server blocks', () => {
    const config = readFileSync(
      resolve(process.cwd(), 'deploy/nginx/mc-u.top.conf.example'),
      'utf8',
    );
    const guards = config.match(/if \(\$host != "mc-u\.top"\) \{ return 400; \}/g) ?? [];

    expect(guards).toHaveLength(2);
  });
});
