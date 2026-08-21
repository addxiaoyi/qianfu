/**
 * 标签管理 API 路由
 * 优化项 308: 用户画像 - 标签体系
 */
import { Router, Request, Response } from 'express'
import { authenticate, requirePermission, requireAnyPermission, Permission } from '../middleware/auth'
import { TagService, UserTagService } from '../services/tagService'
import { TagCategory, TagListResponse, UserTagsResponse } from '../../src/types/tags'

const router = Router()

// ============================================================
// 标签定义管理 (管理员)
// ============================================================

/**
 * GET /api/tags
 * 获取所有标签列表
 */
router.get('/', (req: Request, res: Response) => {
  try {
    const { category, isActive } = req.query

    const tags = TagService.getAllTags({
      category: category as TagCategory,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    })

    const categories = TagService.getCategoryInfo()

    res.json({
      items: tags,
      total: tags.length,
      categories,
    } as TagListResponse)
  } catch (error) {
    console.error('[Tags] Get all tags error:', error)
    res.status(500).json({ error: '获取标签列表失败' })
  }
})

/**
 * GET /api/tags/categories
 * 获取标签分类信息
 */
router.get('/categories', (req: Request, res: Response) => {
  try {
    const categories = TagService.getCategoryInfo()
    res.json(categories)
  } catch (error) {
    console.error('[Tags] Get categories error:', error)
    res.status(500).json({ error: '获取分类信息失败' })
  }
})

/**
 * GET /api/tags/:id
 * 获取单个标签详情
 */
router.get('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const tag = TagService.getTagById(id)

    if (!tag) {
      res.status(404).json({ error: '标签不存在' })
      return
    }

    res.json(tag)
  } catch (error) {
    console.error('[Tags] Get tag error:', error)
    res.status(500).json({ error: '获取标签详情失败' })
  }
})

/**
 * POST /api/tags
 * 创建新标签 (需要管理员权限)
 */
router.post(
  '/',
  authenticate({ required: true }),
  requireAnyPermission(Permission.ADMIN_USERS, Permission.ADMIN_ALL),
  (req: Request, res: Response) => {
    try {
      const { name, description, category, color, icon } = req.body

      if (!name || !category) {
        res.status(400).json({ error: '缺少必填字段: name, category' })
        return
      }

      if (!Object.values(TagCategory).includes(category)) {
        res.status(400).json({ error: '无效的分类' })
        return
      }

      const tag = TagService.createTag({
        name,
        description,
        category,
        color,
        icon,
      })

      res.status(201).json(tag)
    } catch (error) {
      console.error('[Tags] Create tag error:', error)
      res.status(500).json({ error: '创建标签失败' })
    }
  }
)

/**
 * PUT /api/tags/:id
 * 更新标签 (需要管理员权限)
 */
router.put(
  '/:id',
  authenticate({ required: true }),
  requireAnyPermission(Permission.ADMIN_USERS, Permission.ADMIN_ALL),
  (req: Request, res: Response) => {
    try {
      const { id } = req.params
      const updates = req.body

      const tag = TagService.updateTag(id, updates)

      if (!tag) {
        res.status(404).json({ error: '标签不存在' })
        return
      }

      res.json(tag)
    } catch (error) {
      const message = error instanceof Error ? error.message : '更新标签失败'
      console.error('[Tags] Update tag error:', error)
      res.status(400).json({ error: message })
    }
  }
)

/**
 * DELETE /api/tags/:id
 * 删除标签 (需要管理员权限)
 */
router.delete(
  '/:id',
  authenticate({ required: true }),
  requireAnyPermission(Permission.ADMIN_USERS, Permission.ADMIN_ALL),
  (req: Request, res: Response) => {
    try {
      const { id } = req.params
      const success = TagService.deleteTag(id)

      if (!success) {
        res.status(404).json({ error: '标签不存在' })
        return
      }

      res.json({ success: true, message: '标签已删除' })
    } catch (error) {
      const message = error instanceof Error ? error.message : '删除标签失败'
      console.error('[Tags] Delete tag error:', error)
      res.status(400).json({ error: message })
    }
  }
)

// ============================================================
// 用户标签操作
// ============================================================

/**
 * GET /api/tags/users/:userId
 * 获取指定用户的标签
 */
router.get('/users/:userId', authenticate({ required: true }), (req: Request, res: Response) => {
  try {
    const { userId } = req.params

    // 权限检查：只能查看自己或管理员可以查看所有
    if (req.user!.id !== userId && !req.user!.permissions.includes(Permission.ADMIN_ALL)) {
      const hasPermission = req.user!.permissions.some(p =>
        [Permission.ADMIN_USERS, Permission.USER_VIEW].includes(p)
      )
      if (!hasPermission) {
        res.status(403).json({ error: '无权查看此用户的标签' })
        return
      }
    }

    const tags = UserTagService.getUserTags(userId)
    const stats = UserTagService.getUserTagStats(userId)

    res.json({
      userId,
      tags,
      stats,
    } as UserTagsResponse)
  } catch (error) {
    console.error('[Tags] Get user tags error:', error)
    res.status(500).json({ error: '获取用户标签失败' })
  }
})

/**
 * POST /api/tags/users/:userId
 * 为用户分配标签
 */
router.post(
  '/users/:userId',
  authenticate({ required: true }),
  requireAnyPermission(Permission.ADMIN_USERS, Permission.ADMIN_ALL),
  (req: Request, res: Response) => {
    try {
      const { userId } = req.params
      const { tagIds, scores, source } = req.body

      if (!Array.isArray(tagIds) || tagIds.length === 0) {
        res.status(400).json({ error: '请提供有效的标签ID列表' })
        return
      }

      const tags = UserTagService.assignTags(userId, tagIds, { scores, source })

      res.status(201).json({
        userId,
        tags,
        stats: UserTagService.getUserTagStats(userId),
      })
    } catch (error) {
      console.error('[Tags] Assign tags error:', error)
      res.status(500).json({ error: '分配标签失败' })
    }
  }
)

/**
 * PUT /api/tags/users/:userId/tags/:tagId
 * 更新用户标签
 */
router.put(
  '/users/:userId/tags/:tagId',
  authenticate({ required: true }),
  requireAnyPermission(Permission.ADMIN_USERS, Permission.ADMIN_ALL),
  (req: Request, res: Response) => {
    try {
      const { userId, tagId } = req.params
      const { score } = req.body

      if (score !== undefined) {
        if (typeof score !== 'number' || score < 0 || score > 100) {
          res.status(400).json({ error: '分值必须在 0-100 之间' })
          return
        }
        UserTagService.updateTagScore(userId, tagId, score)
      }

      const tags = UserTagService.getUserTags(userId)
      res.json({
        userId,
        tags,
        stats: UserTagService.getUserTagStats(userId),
      })
    } catch (error) {
      console.error('[Tags] Update user tag error:', error)
      res.status(500).json({ error: '更新用户标签失败' })
    }
  }
)

/**
 * DELETE /api/tags/users/:userId
 * 移除用户的所有标签或指定标签
 */
router.delete(
  '/users/:userId',
  authenticate({ required: true }),
  requireAnyPermission(Permission.ADMIN_USERS, Permission.ADMIN_ALL),
  (req: Request, res: Response) => {
    try {
      const { userId } = req.params
      const { tagIds } = req.query

      if (tagIds) {
        // 移除指定标签
        const ids = (tagIds as string).split(',')
        UserTagService.removeTags(userId, ids)
      } else {
        // 清除所有标签
        UserTagService.clearUserTags(userId)
      }

      res.json({
        success: true,
        message: tagIds ? '已移除指定标签' : '已清除所有标签',
      })
    } catch (error) {
      console.error('[Tags] Remove user tags error:', error)
      res.status(500).json({ error: '移除标签失败' })
    }
  }
)

/**
 * GET /api/tags/users/:userId/stats
 * 获取用户标签统计
 */
router.get('/users/:userId/stats', authenticate({ required: true }), (req: Request, res: Response) => {
  try {
    const { userId } = req.params

    const stats = UserTagService.getUserTagStats(userId)
    res.json(stats)
  } catch (error) {
    console.error('[Tags] Get user tag stats error:', error)
    res.status(500).json({ error: '获取标签统计失败' })
  }
})

/**
 * POST /api/tags/users/:userId/self
 * 用户自助管理标签
 */
router.post('/users/:userId/self', authenticate({ required: true }), (req: Request, res: Response) => {
  try {
    const { userId } = req.params

    // 只能操作自己的标签
    if (req.user!.id !== userId) {
      res.status(403).json({ error: '只能管理自己的标签' })
      return
    }

    const { tagIds, action } = req.body

    if (action === 'add') {
      const tags = UserTagService.assignTags(userId, tagIds, { source: 'manual' })
      res.json({
        userId,
        tags,
        stats: UserTagService.getUserTagStats(userId),
      })
    } else if (action === 'remove') {
      UserTagService.removeTags(userId, tagIds)
      res.json({
        success: true,
        stats: UserTagService.getUserTagStats(userId),
      })
    } else {
      res.status(400).json({ error: '无效的操作类型' })
    }
  } catch (error) {
    console.error('[Tags] Self manage tags error:', error)
    res.status(500).json({ error: '操作失败' })
  }
})

export default router
