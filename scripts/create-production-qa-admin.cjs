'use strict';

const fs = require('node:fs');
const path = require('node:path');
const bcrypt = require('bcrypt');

function loadPrismaClient() {
  const candidates = [
    '../prisma/generated/postgres-client',
    '../dist-server/prisma/generated/postgres-client',
    '@prisma/client',
  ];

  for (const candidate of candidates) {
    try {
      return require(candidate).PrismaClient;
    } catch (error) {
      if (error?.code !== 'MODULE_NOT_FOUND') throw error;
    }
  }
  throw new Error('Prisma client was not found in a supported release location');
}

const MIN_PASSWORD_LENGTH = 20;

function readSecret(file, label) {
  if (!file || !path.isAbsolute(file)) {
    throw new Error(`${label} must be an absolute file path`);
  }

  const value = fs.readFileSync(file, 'utf8').trim();
  if (!value) {
    throw new Error(`${label} is empty`);
  }
  return value;
}

async function main() {
  const email = String(process.env.QA_ADMIN_EMAIL || 'qa-admin@mc-u.top').trim().toLowerCase();
  const password = readSecret(process.env.QA_ADMIN_PASSWORD_FILE, 'QA_ADMIN_PASSWORD_FILE');
  const databaseUrl = readSecret(process.env.DATABASE_URL_FILE, 'DATABASE_URL_FILE');

  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`QA password must contain at least ${MIN_PASSWORD_LENGTH} characters`);
  }

  process.env.DATABASE_URL = databaseUrl;
  const PrismaClient = loadPrismaClient();
  const prisma = new PrismaClient();
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.upsert({
      where: { email },
      create: {
        email,
        username: 'qa_admin',
        display_name: '管理员 QA',
        password_hash: passwordHash,
        password_changed_at: new Date(),
        role: 'ADMIN',
        permissions: JSON.stringify(['admin']),
        email_verified: true,
      },
      update: {
        password_hash: passwordHash,
        password_changed_at: new Date(),
        role: 'ADMIN',
        permissions: JSON.stringify(['admin']),
        email_verified: true,
        login_lockout_at: null,
      },
      select: { id: true, email: true, role: true, email_verified: true },
    });

    process.stdout.write(JSON.stringify({ ok: true, user }) + '\n');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(`Unable to create QA administrator: ${error.message}`);
  process.exitCode = 1;
});
