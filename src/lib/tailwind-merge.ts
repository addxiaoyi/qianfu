/**
 * Tailwind CSS 工具函数
 * 提供 clsx 和 twMerge 的功能
 */
import { clsx, type ClassValue } from 'clsx'

/**
 * 合并 Tailwind CSS 类名
 * 处理类名冲突，后面的类名会覆盖前面的
 *
 * @example
 * clsxm('px-2 py-1', 'px-4') // 'px-4 py-1'
 * clsxm('text-sm text-lg', 'text-xl') // 'text-xl'
 */
export function twMerge(...inputs: ClassValue[]): string {
  return clsx(inputs)
}

// 导出 clsx 以便直接使用
export { clsx }

/**
 * 简化的类名合并函数
 * 与 twMerge 相同
 */
export function clsxm(...inputs: ClassValue[]): string {
  return clsx(inputs)
}
