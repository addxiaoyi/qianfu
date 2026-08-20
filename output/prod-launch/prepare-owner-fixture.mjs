import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(pathToFileURL(`${process.cwd()}/package.json`));
const bcrypt = require('bcrypt');

let password = '';
for await (const chunk of process.stdin) {
  password += chunk;
}

const normalizedPassword = password.trim();
if (normalizedPassword.length < 16) {
  throw new Error('Fixture password is too short');
}

const dbUrl = pathToFileURL(`${process.cwd()}/dist-server/server/db.js`).href;
const { default: prisma } = await import(dbUrl);

try {
  const passwordHash = await bcrypt.hash(normalizedPassword, 12);
  const user = await prisma.user.update({
    where: { email: 'smoke_owner_ui_0718@example.invalid' },
    data: {
      password_hash: passwordHash,
      role: 'OWNER',
      email_verified: true,
    },
    select: { id: true, role: true, email_verified: true },
  });
  process.stdout.write(JSON.stringify(user));
} finally {
  await prisma.$disconnect();
}
