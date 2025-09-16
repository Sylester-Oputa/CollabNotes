const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testDatabase() {
  try {
    console.log('Testing database connection...');
    
    // Test basic connection
    const result = await prisma.$queryRaw`SELECT NOW()`;
    console.log('Database connected successfully:', result);
    
    // Check users
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        companyId: true,
        departmentId: true
      }
    });
    console.log('Users in database:', users);
    
    // Check companies
    const companies = await prisma.company.findMany({
      select: {
        id: true,
        name: true,
        email: true
      }
    });
    console.log('Companies in database:', companies);
    
    // Check departments
    const departments = await prisma.department.findMany({
      select: {
        id: true,
        name: true,
        companyId: true
      }
    });
    console.log('Departments in database:', departments);
    
  } catch (error) {
    console.error('Database test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testDatabase();