/**
 * 千服平台优化工作流 v2: 稳定性/运维/UX
 *
 * 目标：提升系统稳定性、运维能力和用户体验
 * 预计智能体数：~29
 */

export const meta = {
  name: 'qianfu-optimization-v2-stability',
  description: '千服平台优化 v2: 稳定性/运维/UX (~29 agents)',
  phases: [
    { title: '稳定性检查', detail: '检查并修复稳定性问题' },
    { title: '运维工具', detail: '完善运维工具和脚本' },
    { title: 'UX优化', detail: '用户体验改进' }
  ]
}

// ===== 稳定性检查阶段 =====

// 1.1 错误处理检查
const errorHandlingCheck = `
检查千服平台的错误处理机制，重点关注：
1. dist-server/server/errors/ 目录下的错误处理
2. dist-server/server/middleware/ 下的错误中间件
3. dist-server/server/utils/ 下的错误工具
4. 检查是否有未处理的 Promise rejection
5. 检查全局错误处理器是否完整
6. 验证错误日志记录是否完善

输出格式：
- 找到的问题列表
- 每个问题的文件路径和行号
- 建议的修复方案
`

// 1.2 内存泄漏检查
const memoryLeakCheck = `
检查千服平台的潜在内存泄漏问题：
1. 检查 dist-server/server/ 下的事件监听器是否正确清理
2. 检查数据库连接是否正确关闭
3. 检查缓存是否有过期机制
4. 检查大对象是否及时释放
5. 检查定时器(setTimeout/setInterval)是否正确清理
6. 检查文件流是否正确关闭

输出格式：
- 潜在的内存泄漏点
- 对应的文件和代码位置
- 修复建议
`

// 1.3 异常边界检查
const exceptionBoundaryCheck = `
检查千服平台的异常边界处理：
1. 检查所有 async 路由处理器是否有 try-catch
2. 检查数据库操作的错误处理
3. 检查外部 API 调用的错误处理
4. 检查文件操作的错误处理
5. 检查配置加载的错误处理
6. 验证是否有统一的异常处理中间件

输出格式：
- 未处理的异常风险点
- 文件路径和具体位置
- 建议的修复方案
`

// ===== 运维工具阶段 =====

// 2.1 日志系统检查
const loggingCheck = `
检查千服平台的日志系统：
1. dist-server/server/core/utils/logger.js 的日志配置
2. 检查日志级别是否合理
3. 检查敏感信息是否被过滤
4. 检查日志格式是否统一
5. 检查日志输出目标是否配置正确
6. 检查是否有过多的 console.log

输出格式：
- 日志配置问题
- 敏感信息泄露风险
- 优化建议
`

// 2.2 健康检查完善
const healthCheck = `
检查并完善健康检查机制：
1. 检查 dist-server/server/intelligent-probe/ 下的健康检查
2. 检查数据库连接健康检查
3. 检查 Redis 连接健康检查
4. 检查外部服务依赖健康检查
5. 添加缺失的健康检查端点
6. 验证健康检查的准确性

输出格式：
- 当前健康检查状态
- 缺失的检查项
- 改进建议
`

// 2.3 配置管理检查
const configManagement = `
检查配置管理系统：
1. 检查 .env 和 .env.example 是否一致
2. 检查环境变量是否有默认值
3. 检查敏感配置是否通过环境变量注入
4. 检查配置验证是否完整
5. 检查是否有过硬编码的配置值
6. 验证配置加载顺序

输出格式：
- 配置问题列表
- 安全风险
- 改进建议
`

// 2.4 备份恢复检查
const backupRecovery = `
检查备份和恢复机制：
1. 检查 dist-server/server/scripts/backupDb.js
2. 检查数据库备份脚本
3. 检查配置文件备份
4. 检查数据导出功能
5. 检查恢复脚本是否完整
6. 验证备份的完整性

输出格式：
- 备份机制现状
- 缺失的功能
- 改进建议
`

// 2.5 部署脚本检查
const deploymentCheck = `
检查部署脚本：
1. 检查 scripts/ 目录下的部署脚本
2. 检查 Docker 配置
3. 检查环境切换逻辑
4. 检查回滚机制
5. 检查部署验证步骤
6. 验证部署脚本的可重复性

输出格式：
- 部署脚本问题
- 潜在风险
- 改进建议
`

// ===== UX优化阶段 =====

// 3.1 API 响应时间检查
const apiResponseTime = `
检查 API 响应时间：
1. 检查关键 API 端点的响应时间
2. 检查 N+1 查询问题
3. 检查不必要的数据库查询
4. 检查缓存使用情况
5. 检查大文件处理
6. 检查第三方 API 调用优化

输出格式：
- 性能瓶颈列表
- 文件和查询位置
- 优化建议
`

// 3.2 前端加载性能
const frontendPerformance = `
检查前端加载性能：
1. 检查 src/ 目录下的 React 组件
2. 检查代码分割是否合理
3. 检查懒加载是否正确使用
4. 检查静态资源优化
5. 检查图片压缩和优化
6. 检查 bundle 大小

输出格式：
- 性能问题列表
- 对应文件
- 优化建议
`

// 3.3 用户提示信息
const userMessages = `
检查用户提示信息：
1. 检查 dist-server/server/constants/businessMessages.js
2. 检查错误消息是否友好
3. 检查是否有过多的技术细节暴露
4. 检查消息是否本地化
5. 检查加载提示是否友好
6. 检查确认对话框是否清晰

输出格式：
- 提示信息问题
- 文件位置
- 改进建议
`

// 3.4 表单验证体验
const formValidation = `
检查表单验证体验：
1. 检查 dist-server/server/middleware/validation.js
2. 检查前端表单验证
3. 检查错误提示是否及时
4. 检查必填项标识是否清晰
5. 检查输入格式提示
6. 检查提交状态反馈

输出格式：
- 验证体验问题
- 对应文件
- 改进建议
`

// 3.5 移动端适配
const mobileAdaptation = `
检查移动端适配：
1. 检查前端响应式布局
2. 检查触摸操作友好性
3. 检查移动端性能
4. 检查图片在小屏幕的显示
5. 检查字体大小可读性
6. 检查按钮点击区域大小

输出格式：
- 移动端问题列表
- 对应组件文件
- 改进建议
`

// ===== 汇总阶段 =====

// 4.1 生成修复报告
const generateReport = `
汇总所有检查结果，生成修复报告：

1. 按优先级分类问题（高/中/低）
2. 统计各类问题数量
3. 提供修复优先级建议
4. 估算修复工作量
5. 生成修复计划

输出格式：
- 问题汇总表
- 优先级建议
- 修复计划
`

// 工作流主体
export default async function run() {
  console.log('Starting v2: 稳定性/运维/UX optimization...')

  // Phase 1: 稳定性检查
  console.log('Phase 1: 稳定性检查')

  // Phase 2: 运维工具
  console.log('Phase 2: 运维工具')

  // Phase 3: UX优化
  console.log('Phase 3: UX优化')

  // Phase 4: 汇总报告
  console.log('Phase 4: 汇总报告')

  return {
    status: 'completed',
    phase: 'v2-stability',
    findings: []
  }
}
