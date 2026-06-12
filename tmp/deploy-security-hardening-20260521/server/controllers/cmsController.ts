import { Response, NextFunction } from 'express';
import prisma from '../db';
import { logger } from '../utils/logger';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';
import { sanitize } from '../services/sanitize';
import { logDataChange } from '../services/auditService';
import { AuthRequest } from '../middleware/auth';
import { rollbackSchema, cmsPaginationQuerySchema, cmsGetPageQuerySchema, saveDraftSchema } from '../utils/validation';
import { AppError, ErrorCode } from '../utils/errors';
import { sendSuccess, sendPaginated } from '../utils/response';
import { z } from 'zod';

import { redisService } from '../services/redisService';
import { hookService, MotiaHook } from '../services/hookService';

const CMS_CACHE_PREFIX = 'cms:page:';
const CMS_CACHE_TTL = 60; // 1 minute in seconds

const CMSQueryFiltersSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  user: z.coerce.number().int().positive().optional(),
  action: z.string().optional(),
  target: z.string().optional(),
  start: z.string().optional(),
  end: z.string().optional(),
});

const md: MarkdownIt = new MarkdownIt({
  html: false,
  linkify: true,
  highlight: (str: string, lang: string): string => {
    if (lang && hljs.getLanguage(lang)) {
      try {
        const safeLang = lang.replace(/[^a-zA-Z0-9_-]/g, '');
        return `<pre class="hljs"><code class="language-${safeLang}">` +
          hljs.highlight(str, { language: lang }).value +
          '</code></pre>';
      } catch {}
    }
    return `<pre class="hljs"><code>${md.utils.escapeHtml(str)}</code></pre>`;
  },
});

function hashContent(title: string, mdText: string) {
  return crypto.createHash('sha256').update(title + '\n' + mdText).digest('hex');
}

function toHtml(mdText: string) {
  const raw = md.render(mdText);
  const safe = sanitize(raw);
  return safe;
}

function escapeHtml(value: string) {
  return String(value).replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return char;
    }
  });
}

function escapeAttribute(value: string) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

export const getPage = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const adminId = req.user?.id ?? (req.isAdmin ? 0 : null);
    const validation = cmsGetPageQuerySchema.safeParse(req.query);
    if (!validation.success) {
      throw new AppError('Invalid query parameters', 400, ErrorCode.VALIDATION_ERROR, false, validation.error.issues);
    }
    const { lock } = validation.data;
    if (!req.isAdmin && adminId === null) {
      throw new AppError('Forbidden', 403, ErrorCode.FORBIDDEN);
    }

    const cacheKey = CMS_CACHE_PREFIX + 'server-intro';
    let page = await redisService.get<any>(cacheKey);
    if (!page) {
      page = await prisma.introPage.findUnique({ where: { slug: 'server-intro' } });
      if (!page) {
        // Create initial page if not exists
        page = await prisma.introPage.create({
          data: {
            slug: 'server-intro',
            title: 'Welcome to Motiacraft',
            content_md: '# Welcome\n\nThis is the server introduction page.',
            content_html: '<h1>Welcome</h1><p>This is the server introduction page.</p>',
            status: 'PUBLISHED',
            version: 1,
            hash: hashContent('Welcome to Motiacraft', '# Welcome\n\nThis is the server introduction page.'),
            seo_title: 'Server Introduction',
            seo_description: 'Official introduction page for alliance servers',
          },
        });
        await prisma.introPageVersion.create({
          data: {
            page_id: page.id,
            version: 1,
            title: page.title,
            content_md: page.content_md,
            content_html: page.content_html,
            author_id: adminId ?? undefined,
            hash: page.hash,
          },
        });
      }
      if (!lock) await redisService.set(cacheKey, page, CMS_CACHE_TTL);
    }

    if (lock && page) {
      await redisService.withLock(`cms:lock:${page.slug}`, async () => {
        const now = Date.now();
        const expired = !page!.lock_expires_at || new Date(page!.lock_expires_at).getTime() < now;
        if (expired || page!.editor_lock_user === adminId) {
          const updatedPage = await prisma.introPage.update({
            where: { id: page!.id },
            data: {
              editor_lock_user: adminId ?? undefined,
              lock_expires_at: new Date(now + 15 * 60 * 1000),
            },
          });
          await logDataChange(adminId ?? 0, 'LOCK_CMS_PAGE', `cms_${page!.slug}`, req, page, updatedPage);
          page = updatedPage;
          await redisService.del(cacheKey);
        }
      });
    }
    if (!page) throw new AppError('Page not found', 404, ErrorCode.NOT_FOUND);
    return sendSuccess(res, page);
  } catch (error) {
    next(error);
  }
};

export const saveDraft = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const adminId = req.user?.id ?? (req.isAdmin ? 0 : null);
    if (!req.isAdmin && adminId === null) {
      throw new AppError('Forbidden', 403, ErrorCode.FORBIDDEN);
    }
    
    const validation = saveDraftSchema.safeParse(req.body);
    if (!validation.success) {
      throw new AppError('Invalid input', 400, ErrorCode.BAD_REQUEST, false, validation.error.format());
    }
    const { title, content, version, seo_title, seo_description } = validation.data;

    const page = await prisma.introPage.findUnique({ where: { slug: 'server-intro' } });
    if (!page) throw new AppError('Page not found', 404, ErrorCode.NOT_FOUND);
    
    const html = toHtml(String(content ?? ''));
    const nextVersion = (page.version ?? 1) + 1;
    const h = hashContent(String(title ?? ''), String(content ?? ''));
    const changed = h !== page.hash || seo_title !== page.seo_title || seo_description !== page.seo_description;
    
    if (!changed) {
      return sendSuccess(res, { message: 'No changes' });
    }

    const updated = await redisService.withLock(`cms:lock:${page.slug}`, async () => {
      const currentPage = await prisma.introPage.findUnique({ where: { id: page.id } });
      if (!currentPage) throw new AppError('Page not found', 404, ErrorCode.NOT_FOUND);
      
      if (currentPage.editor_lock_user !== adminId && currentPage.editor_lock_user !== null) {
        const now = Date.now();
        const expired = !currentPage.lock_expires_at || new Date(currentPage.lock_expires_at).getTime() < now;
        if (!expired) {
          throw new AppError('Locked by another editor', 423, ErrorCode.FORBIDDEN);
        }
      }
      
      if (typeof version === 'number' && version !== currentPage.version) {
        throw new AppError('Conflict: Page updated by another editor.', 409, ErrorCode.INTERNAL_ERROR, false, { 
          conflict: true, 
          serverVersion: currentPage.version 
        });
      }

      return await prisma.introPage.update({
        where: { id: page.id },
        data: {
          title: title ?? currentPage.title,
          content_md: content ?? currentPage.content_md,
          content_html: content !== undefined ? html : currentPage.content_html,
          seo_title: seo_title ?? currentPage.seo_title,
          seo_description: seo_description ?? currentPage.seo_description,
          status: 'DRAFT',
          version: nextVersion,
          hash: h,
          updated_at: new Date(),
        },
      });
    });
    
    await prisma.introPageVersion.create({
      data: {
        page_id: page.id,
        version: nextVersion,
        title: updated.title,
        content_md: updated.content_md,
        content_html: updated.content_html,
        author_id: adminId ?? undefined,
        hash: h,
      },
    });
    
    await redisService.del(CMS_CACHE_PREFIX + 'server-intro');
    await logDataChange(adminId ?? 0, 'SAVE_CMS_DRAFT', `cms_${page.slug}`, req, page, updated);

    // Trigger Hook
    hookService.trigger(MotiaHook.PAGE_UPDATED, { page: updated, user: req.user, isDraft: true });

    return sendSuccess(res, { version: nextVersion }, 'Success');
  } catch (error) {
    next(error);
  }
};

/**
 * Submit CMS page for review
 */
export const submitReview = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const adminId = req.user?.id ?? (req.isAdmin ? 0 : null);
    if (!req.isAdmin && adminId === null) throw new AppError('Forbidden', 403, ErrorCode.FORBIDDEN);
    
    const page = await prisma.introPage.findUnique({ where: { slug: 'server-intro' } });
    if (!page) throw new AppError('Not found', 404, ErrorCode.NOT_FOUND);
    
    const updated = await prisma.introPage.update({
      where: { id: page.id },
      data: { status: 'PENDING' },
    });
    
    await logDataChange(adminId ?? 0, 'SUBMIT_CMS_REVIEW', `cms_${page.slug}`, req, page, updated);
    return sendSuccess(res, null, 'Submitted for review');
  } catch (error) {
    next(error);
  }
};

/**
 * Reject CMS page review
 */
export const rejectReview = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const adminId = req.user?.id ?? (req.isAdmin ? 0 : null);
    if (!req.isAdmin && adminId === null) throw new AppError('Forbidden', 403, ErrorCode.FORBIDDEN);
    
    const page = await prisma.introPage.findUnique({ where: { slug: 'server-intro' } });
    if (!page) throw new AppError('Not found', 404, ErrorCode.NOT_FOUND);
    
    const updated = await prisma.introPage.update({
      where: { id: page.id },
      data: { status: 'REJECTED' },
    });
    
    await logDataChange(adminId ?? 0, 'REJECT_CMS_REVIEW', `cms_${page.slug}`, req, page, updated);
    return sendSuccess(res, null, 'Review rejected');
  } catch (error) {
    next(error);
  }
};

function buildStaticHtml(title: string, description: string, bodyHtml: string) {
  const safeTitle = escapeHtml(title || '千服联灯');
  const safeDescription = escapeAttribute(description || '');
  const safeBodyHtml = sanitize(bodyHtml || '');

  return [
    '<!DOCTYPE html>',
    '<html lang="zh-CN">',
    '<head>',
    '<meta charset="utf-8"/>',
    `<title>${safeTitle}</title>`,
    `<meta name="description" content="${safeDescription}"/>`,
    '<meta name="viewport" content="width=device-width, initial-scale=1.0"/>',
    '<style>',
    ':root { color-scheme: dark; --bg: #030712; --fg: #f9fafb; --muted: #9ca3af; --panel: rgba(17,24,39,0.72); --line: rgba(255,255,255,0.12); --accent: #60a5fa; }',
    '* { box-sizing: border-box; }',
    'body { margin: 0; min-height: 100vh; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: radial-gradient(circle at 15% 10%, rgba(96,165,250,0.18), transparent 30%), linear-gradient(135deg, #020617 0%, var(--bg) 58%, #111827 100%); color: var(--fg); }',
    'main { width: min(960px, calc(100% - 32px)); margin: 0 auto; padding: clamp(48px, 8vw, 96px) 0; }',
    'article { border: 1px solid var(--line); border-radius: 32px; background: var(--panel); box-shadow: 0 32px 120px rgba(0,0,0,0.35); padding: clamp(28px, 5vw, 56px); backdrop-filter: blur(18px); }',
    'h1, h2, h3 { letter-spacing: -0.04em; line-height: 0.98; }',
    'h1 { font-size: clamp(2.6rem, 8vw, 5.6rem); margin: 0 0 1.5rem; }',
    'h2 { font-size: clamp(1.8rem, 5vw, 3rem); margin-top: 2.4rem; }',
    'p, li { color: #d1d5db; font-size: 1.05rem; line-height: 1.8; }',
    'a { color: var(--accent); text-underline-offset: 0.2em; }',
    'img, video, iframe { max-width: 100%; border-radius: 20px; border: 1px solid var(--line); }',
    'pre { overflow: auto; padding: 1rem; border-radius: 18px; background: rgba(0,0,0,0.35); }',
    'code { color: #bfdbfe; }',
    'blockquote { margin: 1.5rem 0; padding-left: 1.25rem; border-left: 3px solid var(--accent); color: var(--muted); }',
    '</style>',
    '</head>',
    '<body>',
    '<main>',
    '<article>',
    safeBodyHtml,
    '</article>',
    '</main>',
    '</body>',
    '</html>',
  ].join('');
}

/**
 * Publish CMS page
 */
export const publish = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const adminId = req.user?.id ?? (req.isAdmin ? 0 : null);
    if (!req.isAdmin && adminId === null) throw new AppError('Forbidden', 403, ErrorCode.FORBIDDEN);
    
    const page = await prisma.introPage.findUnique({ where: { slug: 'server-intro' } });
    if (!page) throw new AppError('Not found', 404, ErrorCode.NOT_FOUND);
    
    const updated = await prisma.introPage.update({
      where: { id: page.id },
      data: {
        status: 'PUBLISHED',
        last_published_at: new Date(),
      },
    });
    
    await logDataChange(adminId ?? 0, 'PUBLISH_CMS_PAGE', `cms_${page.slug}`, req, page, updated);

    // Trigger Hook
    hookService.trigger(MotiaHook.PAGE_PUBLISHED, { page: updated, user: req.user });

    const html = buildStaticHtml(updated.seo_title ?? updated.title, updated.seo_description ?? '', updated.content_html ?? '');
    
    try {
      const pubDir = path.resolve(process.cwd(), 'server/public');
      fs.mkdirSync(pubDir, { recursive: true });
      const filePath = path.join(pubDir, 'server-intro.html');
      fs.writeFileSync(filePath, html, 'utf-8');
    } catch (err) {
      logger.error('Failed to write static HTML:', err);
    }
    
    return sendSuccess(res, null, 'Published successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Unlock CMS page
 */
export const unlock = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const adminId = req.user?.id ?? (req.isAdmin ? 0 : null);
    if (!req.isAdmin && adminId === null) throw new AppError('Forbidden', 403, ErrorCode.FORBIDDEN);
    
    const page = await prisma.introPage.findUnique({ where: { slug: 'server-intro' } });
    if (!page) throw new AppError('Not found', 404, ErrorCode.NOT_FOUND);
    
    const updated = await prisma.introPage.update({
      where: { id: page.id },
      data: { editor_lock_user: null, lock_expires_at: null },
    });
    
    await logDataChange(adminId ?? 0, 'UNLOCK_CMS_PAGE', `cms_${page.slug}`, req, page, updated);
    return sendSuccess(res, null, 'Page unlocked');
  } catch (error) {
    next(error);
  }
};

/**
 * List CMS page versions
 */
export const listVersions = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const adminId = req.user?.id ?? (req.isAdmin ? 0 : null);
    if (!req.isAdmin && adminId === null) throw new AppError('Forbidden', 403, ErrorCode.FORBIDDEN);
    
    const validation = cmsPaginationQuerySchema.safeParse(req.query);
    if (!validation.success) {
      throw new AppError('Invalid query parameters', 400, ErrorCode.VALIDATION_ERROR, false, validation.error.issues);
    }
    const { page, limit } = validation.data;
    const skip = (page - 1) * limit;

    const introPage = await prisma.introPage.findUnique({ where: { slug: 'server-intro' } });
    if (!introPage) throw new AppError('Not found', 404, ErrorCode.NOT_FOUND);
    
    const [versions, total] = await Promise.all([
      prisma.introPageVersion.findMany({
        where: { page_id: introPage.id },
        orderBy: { version: 'desc' },
        skip,
        take: limit,
      }),
      prisma.introPageVersion.count({ where: { page_id: introPage.id } })
    ]);
    
    return sendPaginated(res, versions, total, page, limit, 'Versions retrieved');
  } catch (error) {
    next(error);
  }
};

/**
 * Rollback CMS page version
 */
export const rollbackVersion = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const adminId = req.user?.id ?? (req.isAdmin ? 0 : null);
    if (!req.isAdmin && adminId === null) throw new AppError('Forbidden', 403, ErrorCode.FORBIDDEN);
    
    const validation = rollbackSchema.safeParse(req.body);
    if (!validation.success) {
      throw new AppError('Invalid input', 400, ErrorCode.BAD_REQUEST, false, validation.error.format());
    }
    const toVersion = validation.data.version;

    const page = await prisma.introPage.findUnique({ where: { slug: 'server-intro' } });
    if (!page) throw new AppError('Not found', 404, ErrorCode.NOT_FOUND);
    
    const v = await prisma.introPageVersion.findFirst({ where: { page_id: page.id, version: toVersion } });
    if (!v) throw new AppError('Version not found', 404, ErrorCode.NOT_FOUND);
    
    const nextVersion = (page.version || 1) + 1;
    const h = hashContent(v.title, v.content_md);
    
    const updated = await prisma.introPage.update({
      where: { id: page.id },
      data: {
        title: v.title,
        content_md: v.content_md,
        content_html: v.content_html,
        version: nextVersion,
        hash: h,
        status: 'DRAFT',
      },
    });
    
    await prisma.introPageVersion.create({
      data: {
        page_id: page.id,
        version: nextVersion,
        title: updated.title,
        content_md: updated.content_md,
        content_html: updated.content_html,
        author_id: adminId ?? undefined,
        hash: h,
      },
    });
    
    await logDataChange(adminId ?? 0, 'ROLLBACK_CMS_PAGE', `cms_${page.slug}`, req, page, updated);

    // Trigger Hook
    hookService.trigger(MotiaHook.PAGE_UPDATED, { page: updated, user: req.user, isRollback: true });

    return sendSuccess(res, { version: nextVersion }, 'Version rolled back');
  } catch (error) {
    next(error);
  }
};

/**
 * List CMS audit logs
 */
export const listAudit = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const adminId = req.user?.id ?? (req.isAdmin ? 0 : null);
    if (!req.isAdmin && adminId === null) throw new AppError('Forbidden', 403, ErrorCode.FORBIDDEN);
    
    const validation = CMSQueryFiltersSchema.safeParse(req.query);
    if (!validation.success) {
      throw new AppError('Invalid query parameters', 400, ErrorCode.VALIDATION_ERROR, false, validation.error.issues);
    }
    
    const { page, limit, user, action, target, start, end } = validation.data;
    const skip = (page - 1) * limit;
    
    const filters: {
      user_id?: number;
      action?: string;
      target?: string;
      created_at?: { gte?: Date; lte?: Date };
    } = {};
    if (user) filters.user_id = user;
    if (action) filters.action = action;
    if (target) filters.target = target;
    if (start || end) {
      filters.created_at = {};
      if (start) filters.created_at.gte = new Date(start);
      if (end) filters.created_at.lte = new Date(end);
    }
    
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: filters,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
        include: { user: { select: { id: true, username: true } } }
      }),
      prisma.auditLog.count({ where: filters })
    ]);
    
    return sendPaginated(res, logs, total, page, limit, 'Audit logs retrieved');
  } catch (error) {
    next(error);
  }
};
