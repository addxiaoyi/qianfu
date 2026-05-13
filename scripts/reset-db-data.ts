
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Database Reset Script ---');
  try {
    // Delete all users (cascading will handle related records if configured, 
    // but we'll do it manually to be safe)
    
    console.log('Cleaning up Audit Logs...');
    await prisma.auditLog.deleteMany({});
    
    console.log('Cleaning up Server Versions...');
    await prisma.serverVersion.deleteMany({});
    
    console.log('Cleaning up Servers...');
    await prisma.server.deleteMany({});
    
    console.log('Cleaning up Intro Page Versions...');
    await prisma.introPageVersion.deleteMany({});
    
    console.log('Cleaning up Intro Pages...');
    await prisma.introPage.deleteMany({});
    
    console.log('Cleaning up User Bio Versions...');
    await prisma.userBioVersion.deleteMany({});
    
    console.log('Cleaning up Users...');
    const result = await prisma.user.deleteMany({});
    
    console.log(`Successfully deleted ${result.count} users and all associated data.`);
    console.log('Database is now clean.');
  } catch (error) {
    console.error('Error during database reset:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
