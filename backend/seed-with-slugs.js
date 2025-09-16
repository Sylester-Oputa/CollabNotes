const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

// Function to create URL-friendly slugs
function createSlug(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_-]+/g, '-') // Replace spaces, underscores and multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

async function seedDatabase() {
  try {
    console.log('🌱 Seeding database with sample data...');

    // Create company
    const company = await prisma.company.create({
      data: {
        name: 'LukaTech',
        slug: createSlug('LukaTech'),
        email: 'soputa42@gmail.com'
      }
    });
    console.log(`✅ Created company: ${company.name} (/${company.slug})`);

    // Create departments
    const departments = [
      { name: 'Head of Resource', slug: createSlug('Head of Resource') },
      { name: 'Engineering', slug: createSlug('Engineering') },
      { name: 'Marketing', slug: createSlug('Marketing') }
    ];

    const createdDepartments = [];
    for (const dept of departments) {
      const department = await prisma.department.create({
        data: {
          name: dept.name,
          slug: dept.slug,
          companyId: company.id
        }
      });
      createdDepartments.push(department);
      console.log(`✅ Created department: ${department.name} (/${company.slug}/${department.slug})`);
    }

    // Create users
    const hashedPassword = await bcrypt.hash('password123', 10);

    // Super Admin
    const superAdmin = await prisma.user.create({
      data: {
        name: 'Sylvester Oputa',
        email: 'sylvesteroputa366@gmail.com',
        passwordHash: hashedPassword,
        role: 'SUPER_ADMIN',
        companyId: company.id
      }
    });
    console.log(`✅ Created super admin: ${superAdmin.name}`);

    // Department Head
    const deptHead = await prisma.user.create({
      data: {
        name: 'Sylvester Oputa',
        email: 'oputaemeka2@gmail.com',
        passwordHash: hashedPassword,
        role: 'HEAD_OF_DEPARTMENT',
        companyId: company.id,
        departmentId: createdDepartments[0].id // Head of Resource department
      }
    });
    console.log(`✅ Created department head: ${deptHead.name}`);

    // Regular user
    const user = await prisma.user.create({
      data: {
        name: 'John Developer',
        email: 'john@lukatech.com',
        passwordHash: hashedPassword,
        role: 'USER',
        companyId: company.id,
        departmentId: createdDepartments[1].id // Engineering department
      }
    });
    console.log(`✅ Created user: ${user.name}`);

    console.log('\n🎉 Database seeded successfully!');
    console.log('\n📋 New URL structure:');
    console.log(`🏢 Company: /${company.slug}`);
    for (const dept of createdDepartments) {
      console.log(`   📁 Department: /${company.slug}/${dept.slug}`);
    }

    console.log('\n🔗 Example URLs:');
    console.log(`- Company Dashboard: http://localhost:5174/${company.slug}`);
    console.log(`- Department Dashboard: http://localhost:5174/${company.slug}/${createdDepartments[0].slug}`);
    console.log(`- Department Notes: http://localhost:5174/${company.slug}/${createdDepartments[0].slug}/notes`);
    console.log(`- Department Tasks: http://localhost:5174/${company.slug}/${createdDepartments[0].slug}/tasks`);

  } catch (error) {
    console.error('❌ Error seeding database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedDatabase();