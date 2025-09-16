const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createTestUser() {
  try {
    // Get the LukaTech company and head-of-resource department
    const company = await prisma.company.findUnique({
      where: { slug: 'lukatech' },
      include: { departments: true }
    });

    if (!company) {
      console.log('LukaTech company not found');
      return;
    }

    const headOfResourceDept = company.departments.find(d => d.slug === 'head-of-resource');
    if (!headOfResourceDept) {
      console.log('Head of Resource department not found');
      return;
    }

    // Create a test user
    const hashedPassword = await bcrypt.hash('testpassword', 10);
    
    const user = await prisma.user.create({
      data: {
        name: 'Test User',
        email: 'test@lukatech.com',
        passwordHash: hashedPassword,
        role: 'HEAD_OF_DEPARTMENT',
        companyId: company.id,
        departmentId: headOfResourceDept.id
      }
    });

    console.log('Created test user:', {
      id: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      departmentId: user.departmentId
    });

    return user;
  } catch (error) {
    console.error('Error creating test user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestUser();