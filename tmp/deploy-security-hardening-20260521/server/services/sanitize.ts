import sanitizeHtml from 'sanitize-html';

const allowedIframeHosts = [
  'www.bilibili.com',
  'player.bilibili.com',
  'www.youtube.com',
  'player.youku.com',
];

export function sanitize(content: string, options: sanitizeHtml.IOptions = {}) {
  const defaultOptions: sanitizeHtml.IOptions = {
    allowedTags: [
      'h1','h2','h3','p','strong','em','s','code','pre','blockquote','ul','ol','li',
      'a','img','video','iframe','br','hr','span','div','table','thead','tbody','tr','td','th'
    ],
    allowedAttributes: {
      a: ['href', 'title', 'target', 'rel', 'class'],
      img: ['src', 'alt', 'width', 'height', 'class', 'loading'],
      video: ['src', 'controls', 'poster', 'width', 'height', 'class'],
      iframe: ['src', 'allowfullscreen', 'title', 'width', 'height', 'class', 'sandbox', 'referrerpolicy', 'loading'],
      code: ['class'],
      pre: ['class'],
      span: ['class'],
      p: ['class'],
      div: ['class'],
      h1: ['class'],
      h2: ['class'],
      h3: ['class'],
      ul: ['class'],
      ol: ['class'],
      li: ['class'],
      table: ['class', 'border', 'cellpadding', 'cellspacing'],
      thead: ['class'],
      tbody: ['class'],
      tr: ['class'],
      td: ['class', 'colspan', 'rowspan'],
      th: ['class', 'colspan', 'rowspan'],
    },
    transformTags: {
      img: (tag, attribs) => {
        if (!attribs.alt) attribs.alt = '';
        attribs.loading = 'lazy';
        return { tagName: 'img', attribs };
      },
      a: (tag, attribs) => {
        const href = attribs.href || '';
        const isLocal = href.startsWith('#') || href.startsWith('/#') || href.startsWith('/') && !href.startsWith('//');
        
        if (!isLocal) {
          attribs.rel = 'nofollow noopener noreferrer';
          attribs.target = '_blank';
        }
        return { tagName: 'a', attribs };
      },
      iframe: (tag, attribs) => {
        try {
          const u = new URL(attribs.src);
          if (!allowedIframeHosts.includes(u.hostname)) {
            return { tagName: 'div', attribs: {}, text: '' };
          }
        } catch {
          return { tagName: 'div', attribs: {}, text: '' };
        }
        attribs.sandbox = 'allow-scripts allow-same-origin allow-presentation';
        attribs.referrerpolicy = 'strict-origin-when-cross-origin';
        attribs.loading = 'lazy';
        return { tagName: 'iframe', attribs };
      },
    },
    allowedSchemes: ['http','https'],
    allowedSchemesByTag: {
      iframe: ['https'],
    },
    selfClosing: ['img','br','hr'],
    parser: { lowerCaseTags: true },
  };

  return sanitizeHtml(content, { ...defaultOptions, ...options });
}
