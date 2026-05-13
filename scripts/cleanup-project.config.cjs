/**
 * 千服项目 — 本地「无关文件 / 测试 / 构建产物」清理配置
 *
 * 使用方式（在项目根目录）：
 *   npm run clean:project          → 只打印将要删除的内容，不删文件
 *   npm run clean:project:apply    → 按本配置真正删除（请先 dry-run 确认）
 *
 * 修改方式：
 *   1. 按需打开下面各分组的 enabled
 *   2. 在 extraPaths 里填写相对项目根的路径（目录或文件）
 *   3. 勿填 node_modules、.git、src、server 等核心目录
 */

module.exports = {
  /**
   * rootLogsAndTemp：根目录下的日志、一次性编译输出文本等。
   * 不影响子目录（避免误删 server 里合法的日志配置示例等）。
   */
  rootLogsAndTemp: {
    enabled: true,
    /** 只匹配「项目根」下的文件名（glob，仅支持 * 与 ?） */
    rootFileGlobs: ['*.log', 'tsc_output.txt', 'tsc_result.txt'],
  },

  /**
   * buildOutputs：前端 Vite 构建目录、Node 服务端 tsc 输出目录。
   * 删后可重新生成：npm run build、npm run server:build
   * 若你靠 dist 直接部署，请保持 enabled: false。
   */
  buildOutputs: {
    enabled: false,
    paths: ['dist', 'dist-server'],
  },

  /**
   * vitestTests：单元/集成测试源码与 Vitest 全局 setup。
   * 打开后 npm test 将无测试可跑；仅在你确定不需要测试时启用。
   */
  vitestTests: {
    enabled: false,
    paths: ['tests', 'setupTests.ts'],
  },

  /**
   * viteCache：Vite / Vitest 本地缓存（.vite），可安全删除，下次运行会重建。
   */
  viteCache: {
    enabled: true,
    paths: ['.vite'],
  },

  /**
   * extraPaths：仅填「确定与本项目无关」的路径。
   * 注意：xpay-3.1_YTM7H 是本仓库自带的 Java 支付子系统源码（StarMC XPay），
   * 与 Node 千服通过 QIANFU_* 环境变量对接，切勿在此配置为删除目标。
   */
  extraPaths: {
    enabled: false,
    paths: [
      // 'portable-bundle-backup-20260404-144032.tar.gz',
      // 'prisma/generated', // 可删；随后执行 npx prisma generate（或 npm install）会重建
    ],
  },
};
