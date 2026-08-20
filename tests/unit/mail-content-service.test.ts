import { describe, expect, it } from 'vitest';
import { buildSender, sanitizeMailHtml } from '../../server/services/mailContentService';

describe('mail content service', () => {
  it('removes executable and remote-tracking markup from custom html', () => {
    const html = sanitizeMailHtml(`
      <h1>通知</h1>
      <script>alert(1)</script>
      <img src="https://tracker.example/pixel.gif" onerror="alert(2)">
      <a href="javascript:alert(3)">危险链接</a>
      <p style="color:red;position:fixed">正文</p>
    `);

    expect(html).toContain('<h1>通知</h1>');
    expect(html).toContain('正文');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('onerror');
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('tracker.example');
    expect(html).not.toContain('position:fixed');
  });

  it('formats a sender name without allowing header injection', () => {
    expect(buildSender('千服客服', 'support@0st.top')).toEqual({
      name: '千服客服',
      address: 'support@0st.top',
    });
    expect(() => buildSender('客服\r\nBcc: attacker@example.com', 'support@0st.top')).toThrow('发件人名称');
  });
});
