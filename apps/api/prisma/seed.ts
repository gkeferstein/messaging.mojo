import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create default messaging rules
  const rules = [
    {
      id: 'team-internal',
      name: 'Team-interne Kommunikation',
      description: 'Mitglieder der gleichen Organisation können frei kommunizieren',
      sourceScope: 'tenant',
      sourceRoles: ['owner', 'admin', 'member'],
      targetScope: 'tenant',
      targetRoles: ['owner', 'admin', 'member'],
      requireApproval: false,
      maxMessagesPerDay: null,
      isActive: true,
      priority: 100,
    },
    {
      id: 'cross-org-managers',
      name: 'Organisation-übergreifend (Manager)',
      description: 'Owner und Admins können andere Owner/Admins über Organisationen hinweg kontaktieren',
      sourceScope: 'platform',
      sourceRoles: ['owner', 'admin'],
      targetScope: 'platform',
      targetRoles: ['owner', 'admin'],
      requireApproval: true,
      maxMessagesPerDay: 10,
      isActive: true,
      priority: 50,
    },
    {
      id: 'support-channel',
      name: 'Support-Kanal',
      description: 'Alle User können den MOJO Support kontaktieren',
      sourceScope: 'platform',
      sourceRoles: ['owner', 'admin', 'member'],
      targetScope: 'platform',
      targetRoles: ['platform_support'],
      requireApproval: false,
      maxMessagesPerDay: null,
      isActive: true,
      priority: 90,
    },
    {
      id: 'platform-announcements',
      name: 'Plattform-Ankündigungen',
      description: 'Plattform-Admins können Ankündigungen an alle senden',
      sourceScope: 'platform',
      sourceRoles: ['platform_admin'],
      targetScope: 'platform',
      targetRoles: ['owner', 'admin', 'member'],
      requireApproval: false,
      maxMessagesPerDay: null,
      isActive: true,
      priority: 80,
    },
  ];

  for (const rule of rules) {
    await prisma.messagingRule.upsert({
      where: { id: rule.id },
      update: rule,
      create: rule,
    });
  }

  console.log(`✅ Created ${rules.length} messaging rules`);

  // Create a sample support conversation
  const supportConversation = await prisma.conversation.upsert({
    where: { id: 'support-global' },
    update: {},
    create: {
      id: 'support-global',
      type: 'SUPPORT',
      name: 'MOJO Support',
      description: 'Offizieller Support-Kanal für MOJO-Nutzer',
    },
  });

  console.log(`✅ Created support conversation: ${supportConversation.id}`);

  console.log('');
  console.log('🎉 Seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


