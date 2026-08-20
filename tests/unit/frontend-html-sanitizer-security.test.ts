import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { sanitizeHtml } from '../../qianfu-liandeng/src/utils/htmlSanitizer';

describe('frontend rich HTML sanitizer', () => {
  it('removes active content, event handlers, inline CSS, and unsafe URLs', () => {
    const sanitized = sanitizeHtml(`
      <p id="clobber" style="position:fixed;inset:0" onclick="alert(1)">safe</p>
      <a href="javascript:alert(1)" onmouseover="alert(2)">bad link</a>
      <a href="data:text/html,<script>alert(3)</script>">data link</a>
      <svg><a href="javascript:alert(4)">svg link</a></svg>
      <math><mtext>math payload</mtext></math>
      <iframe src="https://attacker.example"></iframe>
      <script>alert(5)</script>
      <style>body{display:none}</style>
    `);

    expect(sanitized).toContain('<p>safe</p>');
    expect(sanitized).toContain('<a>bad link</a>');
    expect(sanitized).toContain('<a>data link</a>');
    expect(sanitized).not.toMatch(/style=|onclick=|onmouseover=|javascript:|data:text|<script|<style|<svg|<math|<iframe|id=/i);
  });

  it('preserves safe formatting and URLs while stripping CSS and new-tab controls', () => {
    const sanitized = sanitizeHtml(
      '<h2 class="fixed inset-0">Heading</h2><p><strong>Safe</strong> <a href="https://example.com/docs" title="Docs" target="_blank" rel="opener" class="fixed">link</a></p>',
    );

    expect(sanitized).toContain('<h2>Heading</h2>');
    expect(sanitized).toContain('<strong>Safe</strong>');
    expect(sanitized).toContain('href="https://example.com/docs"');
    expect(sanitized).toContain('title="Docs"');
    expect(sanitized).not.toMatch(/class=|target=|rel=/i);
  });

  it('uses the shared sanitizer for every current dangerous HTML sink', () => {
    const assistantSource = readFileSync(
      resolve(process.cwd(), 'qianfu-liandeng/src/components/form/GlobalAssistantPanel.tsx'),
      'utf8',
    );
    const editorSource = readFileSync(
      resolve(process.cwd(), 'qianfu-liandeng/src/pages/ServerEditor.tsx'),
      'utf8',
    );

    expect(assistantSource).toContain("import { sanitizeHtml } from '@/utils/htmlSanitizer';");
    expect(assistantSource).toContain('sanitizeHtml(markdown.render(content))');
    expect(editorSource).toContain("import { sanitizeHtml } from '@/utils/htmlSanitizer';");
    expect(editorSource).toContain("sanitizeHtml(formData.description || 'STREAMING_CONTENT_EMPTY...')");
    expect(assistantSource).not.toContain("from 'dompurify'");
    expect(editorSource).not.toContain("from 'dompurify'");
  });
});
