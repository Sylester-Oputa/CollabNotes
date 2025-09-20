const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed process...');

  // Create platform company for the SUPER_ADMIN
  const platformCompany = await prisma.company.upsert({
    where: { email: 'platform@collabnotes.com' },
    update: {},
    create: {
      name: 'CollabNotes Platform',
      slug: 'collabnotes-platform',
      email: 'platform@collabnotes.com',
    },
  });

  console.log(`✅ Platform company created: ${platformCompany.name}`);

  // Create platform administration department
  const platformDepartment = await prisma.department.upsert({
    where: {
      slug_companyId: {
        slug: 'platform-administration',
        companyId: platformCompany.id,
      },
    },
    update: {},
    create: {
      name: 'Platform Administration',
      slug: 'platform-administration',
      companyId: platformCompany.id,
    },
  });

  console.log(`✅ Platform department created: ${platformDepartment.name}`);

  // Hash the default password
  const hashedPassword = await bcrypt.hash('PlatformAdmin2024!', 12);

  // Create your SUPER_ADMIN account
  const platformAdmin = await prisma.user.upsert({
    where: { email: 'admin@collabnotes.com' },
    update: {
      // Update password if user already exists
      passwordHash: hashedPassword,
      role: 'SUPER_ADMIN',
    },
    create: {
      name: 'Platform Administrator',
      email: 'admin@collabnotes.com',
      passwordHash: hashedPassword,
      role: 'SUPER_ADMIN',
      departmentRole: 'Platform Owner',
      companyId: platformCompany.id,
      departmentId: platformDepartment.id,
    },
  });

  console.log(`✅ Platform admin created: ${platformAdmin.email}`);

  // Create notification settings for the admin
  await prisma.notificationSetting.upsert({
    where: { userId: platformAdmin.id },
    update: {},
    create: {
      userId: platformAdmin.id,
      emailNotifications: true,
      desktopNotifications: true,
      messageNotifications: true,
      groupNotifications: true,
      reactionNotifications: true,
      mentionNotifications: true,
    },
  });

  console.log(`✅ Notification settings created for platform admin`);

  // Create a sample company for testing (optional)
  const sampleCompany = await prisma.company.upsert({
    where: { email: 'demo@example.com' },
    update: {},
    create: {
      name: 'Demo Company',
      slug: 'demo-company',
      email: 'demo@example.com',
    },
  });

  // Create sample department
  const sampleDepartment = await prisma.department.upsert({
    where: {
      slug_companyId: {
        slug: 'engineering',
        companyId: sampleCompany.id,
      },
    },
    update: {},
    create: {
      name: 'Engineering',
      slug: 'engineering',
      companyId: sampleCompany.id,
    },
  });

  // Create sample ADMIN (company owner) user
  const sampleAdminPassword = await bcrypt.hash('DemoAdmin2024!', 12);
  const sampleAdmin = await prisma.user.upsert({
    where: { email: 'admin@demo.com' },
    update: {
      passwordHash: sampleAdminPassword,
    },
    create: {
      name: 'Demo Company Owner',
      email: 'admin@demo.com',
      passwordHash: sampleAdminPassword,
      role: 'ADMIN',
      departmentRole: 'Company Owner',
      companyId: sampleCompany.id,
      departmentId: null, // Company owners don't belong to specific departments
    },
  });

  // Create sample DEPT_HEAD user
  const sampleHeadPassword = await bcrypt.hash('DemoHead2024!', 12);
  const sampleHead = await prisma.user.upsert({
    where: { email: 'head@demo.com' },
    update: {
      passwordHash: sampleHeadPassword,
    },
    create: {
      name: 'Demo Department Head',
      email: 'head@demo.com',
      passwordHash: sampleHeadPassword,
      role: 'DEPT_HEAD',
      departmentRole: 'Engineering Manager',
      companyId: sampleCompany.id,
      departmentId: sampleDepartment.id,
    },
  });

  // Create sample USER
  const sampleUserPassword = await bcrypt.hash('DemoUser2024!', 12);
  const sampleUser = await prisma.user.upsert({
    where: { email: 'user@demo.com' },
    update: {
      passwordHash: sampleUserPassword,
    },
    create: {
      name: 'Demo Team Member',
      email: 'user@demo.com',
      passwordHash: sampleUserPassword,
      role: 'USER',
      departmentRole: 'Software Developer',
      companyId: sampleCompany.id,
      departmentId: sampleDepartment.id,
    },
  });

  console.log(`✅ Sample company and users created for testing`);

  // Log activity for the platform admin
  await prisma.activityLog.create({
    data: {
      action: 'platform_initialized',
      metadata: {
        description: 'Platform seeded with initial admin account',
        timestamp: new Date().toISOString(),
      },
      userId: platformAdmin.id,
      companyId: platformCompany.id,
    },
  });

  console.log('🎉 Seed completed successfully!');
  console.log('\n📋 Login Credentials:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔐 PLATFORM ADMIN (SUPER_ADMIN):');
  console.log(`   Email: admin@collabnotes.com`);
  console.log(`   Password: PlatformAdmin2024!`);
  console.log(`   Role: SUPER_ADMIN`);
  console.log(`   Company: ${platformCompany.name}`);
  console.log('\n🔐 DEMO COMPANY OWNER (ADMIN):');
  console.log(`   Email: admin@demo.com`);
  console.log(`   Password: DemoAdmin2024!`);
  console.log(`   Role: ADMIN`);
  console.log(`   Company: ${sampleCompany.name}`);
  console.log('\n🔐 DEMO COMPANY HEAD (DEPT_HEAD):');
  console.log(`   Email: head@demo.com`);
  console.log(`   Password: DemoHead2024!`);
  console.log(`   Role: DEPT_HEAD`);
  console.log(`   Company: ${sampleCompany.name}`);
  console.log('\n🔐 DEMO TEAM MEMBER (USER):');
  console.log(`   Email: user@demo.com`);
  console.log(`   Password: DemoUser2024!`);
  console.log(`   Role: USER`);
  console.log(`   Company: ${sampleCompany.name}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n⚠️  IMPORTANT: Change the default passwords in production!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Seed failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });