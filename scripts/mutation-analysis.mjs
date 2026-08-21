#!/usr/bin/env node
/**
 * Mutation Coverage 分析脚本
 *
 * 分析 Stryker 报告并生成优化建议
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

/**
 * 读取 Stryker JSON 报告
 */
function readMutationReport() {
  const reportPath = path.join(projectRoot, 'coverage', 'mutation', 'mutation-report.json');

  if (!fs.existsSync(reportPath)) {
    console.error('❌ Mutation 报告不存在，请先运行 `pnpm test:mutation`');
    process.exit(1);
  }

  const content = fs.readFileSync(reportPath, 'utf-8');
  return JSON.parse(content);
}

/**
 * 分析变异类型分布
 */
function analyzeMutantTypes(report) {
  const typeCounts = {};
  const survivedByType = {};

  for (const file of report.files || []) {
    for (const mutant of file.mutants || []) {
      const type = mutant.mutatorName || 'unknown';
      typeCounts[type] = (typeCounts[type] || 0) + 1;

      if (mutant.status === 'Survived') {
        survivedByType[type] = (survivedByType[type] || 0) + 1;
      }
    }
  }

  return { typeCounts, survivedByType };
}

/**
 * 获取未被检测的变异
 */
function getSurvivedMutants(report) {
  const survived = [];

  for (const file of report.files || []) {
    for (const mutant of file.mutants || []) {
      if (mutant.status === 'Survived') {
        survived.push({
          file: file.sourceFilePath,
          location: mutant.location,
          mutator: mutant.mutatorName,
          replacement: mutant.replacement,
          status: mutant.status,
        });
      }
    }
  }

  return survived;
}

/**
 * 按文件分组分析
 */
function analyzeByFile(report) {
  const fileStats = {};

  for (const file of report.files || []) {
    const total = file.mutants?.length || 0;
    const survived = file.mutants?.filter(m => m.status === 'Survived').length || 0;
    const killed = file.mutants?.filter(m => m.status === 'Killed').length || 0;

    if (total > 0) {
      fileStats[file.sourceFilePath] = {
        total,
        survived,
        killed,
        score: ((total - survived) / total * 100).toFixed(1),
      };
    }
  }

  return fileStats;
}

/**
 * 生成优化建议
 */
function generateRecommendations(survivedMutants, fileStats) {
  const recommendations = [];

  // 找出覆盖率最低的文件
  const sortedFiles = Object.entries(fileStats)
    .filter(([_, stats]) => stats.total >= 3) // 只考虑有足够变异的文件
    .sort((a, b) => parseFloat(a[1].score) - parseFloat(b[1].score));

  for (const [file, stats] of sortedFiles.slice(0, 5)) {
    const fileSurvived = survivedMutants.filter(m => m.file === file);

    recommendations.push({
      priority: 'high',
      file,
      currentScore: `${stats.score}%`,
      survivedCount: stats.survived,
      suggestion: `需要为 ${path.basename(file)} 添加 ${stats.survived} 个测试用例来覆盖边界条件`,
      survivedMutants: fileSurvived.slice(0, 3).map(m => ({
        type: m.mutator,
        location: m.location,
      })),
    });
  }

  return recommendations;
}

/**
 * 打印分析结果
 */
function printReport(report, typeAnalysis, fileStats, survivedMutants) {
  const { typeCounts, survivedByType } = typeAnalysis;

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('                    Mutation Coverage 报告                   ');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // 总体得分
  const score = report.totals?.mutationScore ?? 0;
  const status = score >= 80 ? '✅ 优秀' : score >= 70 ? '⚠️  需改进' : '❌ 不合格';

  console.log(`整体得分: ${score.toFixed(1)}% ${status}`);
  console.log(`总变异数: ${report.totals?.totalMutants || 0}`);
  console.log(`存活数:   ${report.totals?.survived || 0}`);
  console.log(`已击杀:   ${report.totals?.killed || 0}`);
  console.log(`超时:     ${report.totals?.timeout || 0}`);
  console.log(`无覆盖:   ${report.totals?.noCoverage || 0}\n`);

  // 变异类型分析
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('                      变异类型分布                           ');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const sortedTypes = Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1]);

  for (const [type, count] of sortedTypes) {
    const survived = survivedByType[type] || 0;
    const survivedRate = ((survived / count) * 100).toFixed(1);
    const bar = '█'.repeat(Math.round(count / 10)) + '░'.repeat(10 - Math.round(count / 10));
    console.log(`${type.padEnd(20)} ${bar} ${count} (存活: ${survived} - ${survivedRate}%)`);
  }

  // 文件分析
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('                      文件覆盖率排名                         ');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const sortedFiles = Object.entries(fileStats)
    .filter(([_, s]) => s.total >= 3)
    .sort((a, b) => parseFloat(a[1].score) - parseFloat(b[1].score))
    .slice(0, 10);

  console.log('文件'.padEnd(50) + '覆盖率'.padEnd(10) + '存活/总计');
  console.log('─'.repeat(75));

  for (const [file, stats] of sortedFiles) {
    const filename = path.basename(file);
    const filePath = file.replace(projectRoot, '');
    console.log(
      `${filePath.padEnd(50)} ${stats.score.padStart(6)}%  ${String(stats.survived).padStart(3)}/${stats.total}`
    );
  }

  // 优化建议
  const recommendations = generateRecommendations(survivedMutants, fileStats);

  if (recommendations.length > 0) {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('                      优化建议                               ');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    for (let i = 0; i < recommendations.length; i++) {
      const rec = recommendations[i];
      console.log(`\n${i + 1}. [${rec.priority.toUpperCase()}] ${rec.file}`);
      console.log(`   当前覆盖率: ${rec.currentScore}`);
      console.log(`   建议: ${rec.suggestion}`);

      if (rec.survivedMutants.length > 0) {
        console.log('   未被检测的变异类型:');
        for (const mutant of rec.survivedMutants) {
          console.log(`     - ${mutant.type} (行 ${mutant.location?.start?.line || '?'})`);
        }
      }
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // 提示
  console.log('💡 运行 `pnpm test:mutation:report` 生成完整 HTML 报告');
  console.log('💡 参考 docs/MUTATION_COVERAGE.md 了解更多优化方法\n');
}

// 主函数
async function main() {
  try {
    const report = readMutationReport();
    const typeAnalysis = analyzeMutantTypes(report);
    const fileStats = analyzeByFile(report);
    const survivedMutants = getSurvivedMutants(report);

    printReport(report, typeAnalysis, fileStats, survivedMutants);

    // 如果得分低于阈值，退出码为 1
    const score = report.totals?.mutationScore ?? 0;
    if (score < 70) {
      console.log('⚠️  Mutation Coverage 低于 70%，CI 将失败\n');
      process.exit(1);
    }
  } catch (error) {
    console.error('分析失败:', error.message);
    process.exit(1);
  }
}

main();
