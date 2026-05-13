import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function promoteUserToAdmin() {
  try {
    console.log('Starting admin promotion...');
    
    // Find target user
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: 'addxiaoyi' },
          { email: { contains: 'addxiaoyi' } }
        ]
      }
    });

    if (!user) {
      console.log('[AdminPromote] User "addxiaoyi" not found');
      console.log('Please create the user first');
      return;
    }

    console.log(`[AdminPromote] Found user: ${user.username} (${user.email})`);
    
    // Grant admin privileges
    await prisma.user.update({
      where: { id: user.id },
      data: {
        role: 'ADMIN',
        permissions: JSON.stringify(['admin', 'edit_pages', 'view_pages', 'manage_users'])
      }
    });

    console.log('[AdminPromote] User successfully promoted to admin');
    console.log(`- Username: ${user.username}`);
    console.log(`- Email: ${user.email}`);
    console.log(`- Role: ADMIN`);
    console.log(`- Permissions: admin, edit_pages, view_pages, manage_users`);

    // Log action
    await prisma.auditLog.create({
      data: {
        user_id: user.id,
        action: 'PROMOTE_TO_ADMIN',
        target: 'user',
        ip_address: '127.0.0.1',
        details: JSON.stringify({
          promoted_user: user.id,
          new_role: 'ADMIN',
          permissions: ['admin', 'edit_pages', 'view_pages', 'manage_users']
        })
      }
    });

    console.log('[AdminPromote] Audit log recorded');
    
  } catch (error) {
    console.error('[AdminPromote] Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

promoteUserToAdmin();