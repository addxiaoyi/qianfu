import fs from 'node:fs/promises';
import path from 'node:path';

const sourcePath = path.resolve('prisma/schema.prisma');
const postgresTargetPath = path.resolve('prisma/schema.postgresql.prisma');
const mysqlTargetPath = path.resolve('prisma/schema.mysql.prisma');

const source = await fs.readFile(sourcePath, 'utf8');

const withoutLocalGenerator = source.replace(
  /\ngenerator localClient \{[\s\S]*?\n\}\n/g,
  '\n',
);

function buildSchema(outputDir, provider) {
  let schema = withoutLocalGenerator
  .replace(
    /generator client \{[\s\S]*?\n\}/,
    [
      'generator client {',
      '  provider      = "prisma-client-js"',
      `  output        = "./generated/${outputDir}"`,
      '  binaryTargets = ["native", "debian-openssl-3.0.x"]',
      '}',
    ].join('\n'),
  )
  .replace(
    /datasource db \{[\s\S]*?\n\}/,
    [
      'datasource db {',
      `  provider = "${provider}"`,
      '  url      = env("DATABASE_URL")',
      '}',
    ].join('\n'),
  );

  if (provider === 'mysql') {
    const longTextFields = [
      ['UserBioVersion', 'content_html'],
      ['SystemConfig', 'value'],
      ['SystemConfig', 'description'],
      ['AuditLog', 'details'],
      ['ModerationLog', 'content'],
      ['PromoTask', 'rule_config'],
      ['IntroPage', 'content_md'],
      ['IntroPageVersion', 'content_md'],
    ];

    const longTextFieldSet = new Set(longTextFields.map(([modelName, fieldName]) => `${modelName}.${fieldName}`));
    const lines = schema.split('\n');
    let currentModel = null;

    schema = lines.map((line) => {
      const modelStart = line.match(/^model\s+(\w+)\s+\{$/);
      if (modelStart) {
        currentModel = modelStart[1];
        return line;
      }

      if (currentModel && line.trim() === '}') {
        currentModel = null;
        return line;
      }

      if (!currentModel) {
        return line;
      }

      const fieldMatch = line.match(/^(\s*)(\w+)(\s+String\??)(.*)$/);
      if (!fieldMatch) {
        return line;
      }

      const [, indent, fieldName, typePart, restPart] = fieldMatch;
      if (!longTextFieldSet.has(`${currentModel}.${fieldName}`)) {
        return line;
      }

      if (restPart.includes('@db.LongText')) {
        return line;
      }

      const commentIndex = restPart.indexOf('//');
      if (commentIndex >= 0) {
        const beforeComment = restPart.slice(0, commentIndex).trimEnd();
        const comment = restPart.slice(commentIndex);
        return `${indent}${fieldName}${typePart}${beforeComment} @db.LongText ${comment}`;
      }

      return `${indent}${fieldName}${typePart}${restPart} @db.LongText`;
    }).join('\n');
  }

  return schema;
}

const postgresSchema = buildSchema('postgres-client', 'postgresql');
const mysqlSchema = buildSchema('mysql-client', 'mysql');

await fs.writeFile(postgresTargetPath, postgresSchema, 'utf8');
await fs.writeFile(mysqlTargetPath, mysqlSchema, 'utf8');
console.log(`Prepared PostgreSQL Prisma schema at ${path.relative(process.cwd(), postgresTargetPath)}`);
console.log(`Prepared MySQL Prisma schema at ${path.relative(process.cwd(), mysqlTargetPath)}`);
