set -e
cd /www/wwwroot/qianfu-app
node --input-type=module - <<'NODE'
import bcrypt from 'bcrypt';
import { PrismaClient } from './dist-server/prisma/generated/client/index.js';
const prisma = new PrismaClient({ datasources: { db: { url: 'file:/www/wwwroot/qianfu-app/prisma/dev.db' } } });
const passwordHash = await bcrypt.hash('dev123456', 10);
const data = {
  email: 'dev_local@example.com',
  username: 'dev_local',
  display_name: 'Local Dev Admin',
  role: 'ADMIN',
  email_verified: true,
  password_hash: passwordHash,
  permissions: JSON.stringify(['admin','system_config','manage_users','manage_content']),
  preferences: '{}',
  updated_at: new Date(),
  last_login_at: new Date(),
};
const existing = await prisma.user.findFirst({ where: { OR: [{ email: data.email }, { username: data.username }] } });
if (existing) {
  await prisma.user.update({ where: { id: existing.id }, data });
  console.log('updated-user', existing.id);
} else {
  const created = await prisma.user.create({ data });
  console.log('created-user', created.id);
}
await prisma.$disconnect();
NODE
python3 -c 'import json; print(json.dumps({"identifier":"dev_local","password":"dev123456"}))' | curl -sS -A 'Mozilla/5.0' -X POST http://127.0.0.1:3001/api/v1/auth/login -H 'Content-Type: application/json' --data @-