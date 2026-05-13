import prisma from '../db.js';
import { TEAM_MEMBERS, ALLIANCE_GROUPS, RESOURCE_LINKS } from '../../constants.js';
import { logger } from '../utils/logger';

async function main() {
  logger.info('Starting data migration...');

  // Migrate Team Members
  for (const member of TEAM_MEMBERS) {
    await prisma.teamMember.upsert({
      where: { qq: member.qq },
      update: {},
      create: {
        name: member.name,
        name_en: member.nameEn,
        role: member.role,
        role_en: member.roleEn,
        description: member.description,
        description_en: member.descriptionEn,
        qq: member.qq,
        avatar_url: member.avatarUrl,
      },
    });
  }
  logger.info(`Migrated ${TEAM_MEMBERS.length} team members`);

  // Migrate Alliance Groups
  for (const group of ALLIANCE_GROUPS) {
    await prisma.allianceGroup.upsert({
      where: { id: group.id },
      update: {},
      create: {
        id: group.id,
        name: group.name,
        name_en: group.nameEn,
        link: group.link,
        description: group.description,
        description_en: group.descriptionEn,
      },
    });
  }
  logger.info(`Migrated ${ALLIANCE_GROUPS.length} alliance groups`);

  // Migrate Resource Links
  for (const resource of RESOURCE_LINKS) {
    await prisma.resourceLink.create({
      data: {
        title: resource.title,
        title_en: resource.titleEn,
        url: resource.url,
        description: resource.description,
        description_en: resource.descriptionEn,
        category: resource.category,
      },
    }).catch(() => {
      logger.info(`Resource link already exists: ${resource.title}`);
    });
  }
  logger.info(`Migrated ${RESOURCE_LINKS.length} resource links`);

  logger.info('Data migration completed!');
}

main()
  .catch((e) => {
    logger.error('Migration failed:', { error: e });
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
