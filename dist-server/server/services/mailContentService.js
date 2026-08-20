import sanitizeHtml from 'sanitize-html';
const HEADER_INJECTION = /[\r\n]/;
export function sanitizeMailHtml(input) {
    return sanitizeHtml(input, {
        allowedTags: [
            'a', 'b', 'blockquote', 'br', 'code', 'del', 'em', 'h1', 'h2', 'h3', 'hr', 'i',
            'li', 'ol', 'p', 'pre', 'strong', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead',
            'tr', 'u', 'ul',
        ],
        allowedAttributes: {
            a: ['href', 'title', 'target', 'rel'],
            '*': ['class'],
        },
        allowedSchemes: ['http', 'https', 'mailto'],
        allowedStyles: {},
        disallowedTagsMode: 'discard',
    });
}
export function buildSender(name, address) {
    const safeName = name.trim();
    const safeAddress = address.trim();
    if (HEADER_INJECTION.test(safeName) || HEADER_INJECTION.test(safeAddress)) {
        throw new Error('发件人名称或地址包含非法换行');
    }
    if (!safeAddress || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safeAddress)) {
        throw new Error('发件人地址格式无效');
    }
    if (safeName.length > 120)
        throw new Error('发件人名称过长');
    return { name: safeName, address: safeAddress };
}
//# sourceMappingURL=mailContentService.js.map