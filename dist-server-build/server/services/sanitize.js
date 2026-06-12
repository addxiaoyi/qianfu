import sanitizeHtml from 'sanitize-html';
const allowedIframeHosts = [
    'www.bilibili.com',
    'player.bilibili.com',
    'www.youtube.com',
    'player.youku.com',
];
export function sanitize(content, options = {}) {
    const defaultOptions = {
        allowedTags: [
            'h1', 'h2', 'h3', 'p', 'strong', 'em', 's', 'code', 'pre', 'blockquote', 'ul', 'ol', 'li',
            'a', 'img', 'video', 'iframe', 'br', 'hr', 'span', 'div', 'table', 'thead', 'tbody', 'tr', 'td', 'th'
        ],
        allowedAttributes: {
            a: ['href', 'title', 'target', 'rel', 'style', 'class'],
            img: ['src', 'alt', 'width', 'height', 'style', 'class'],
            video: ['src', 'controls', 'poster', 'width', 'height', 'style', 'class'],
            iframe: ['src', 'allowfullscreen', 'title', 'width', 'height', 'style', 'class'],
            code: ['class', 'style'],
            pre: ['class', 'style'],
            span: ['class', 'style'],
            p: ['style', 'class'],
            div: ['style', 'class'],
            h1: ['style', 'class'],
            h2: ['style', 'class'],
            h3: ['style', 'class'],
            ul: ['style', 'class'],
            ol: ['style', 'class'],
            li: ['style', 'class'],
            table: ['style', 'class', 'border', 'cellpadding', 'cellspacing'],
            thead: ['style', 'class'],
            tbody: ['style', 'class'],
            tr: ['style', 'class'],
            td: ['style', 'class', 'colspan', 'rowspan'],
            th: ['style', 'class', 'colspan', 'rowspan'],
        },
        transformTags: {
            img: (tag, attribs) => {
                if (!attribs.alt)
                    attribs.alt = '';
                return { tagName: 'img', attribs };
            },
            a: (tag, attribs) => {
                const href = attribs.href || '';
                const isLocal = href.startsWith('#') || href.startsWith('/#') || href.startsWith('/') && !href.startsWith('//');
                if (!isLocal) {
                    attribs.rel = 'nofollow noopener';
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
                }
                catch {
                    return { tagName: 'div', attribs: {}, text: '' };
                }
                return { tagName: 'iframe', attribs };
            },
        },
        allowedSchemes: ['http', 'https'],
        selfClosing: ['img', 'br', 'hr'],
        parser: { lowerCaseTags: true },
    };
    return sanitizeHtml(content, { ...defaultOptions, ...options });
}
//# sourceMappingURL=sanitize.js.map