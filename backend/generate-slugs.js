const { PrismaClient } = require('@prisma/client');
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

async function generateSlugs() {
  try {
    console.log('Generating slugs for existing data...');

    // Generate slugs for companies
    const companies = await prisma.company.findMany();
    console.log(`Found ${companies.length} companies to update`);

    for (const company of companies) {
      const slug = createSlug(company.name);
      await prisma.company.update({
        where: { id: company.id },
        data: { slug }
      });
      console.log(`Updated company "${company.name}" with slug: ${slug}`);
    }

    // Generate slugs for departments
    const departments = await prisma.department.findMany();
    console.log(`Found ${departments.length} departments to update`);

    for (const department of departments) {
      const slug = createSlug(department.name);
      await prisma.department.update({
        where: { id: department.id },
        data: { slug }
      });
      console.log(`Updated department "${department.name}" with slug: ${slug}`);
    }

    console.log('✅ Successfully generated all slugs!');

    // Display the updated data structure
    const updatedCompanies = await prisma.company.findMany({
      include: {
        departments: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        }
      }
    });

    console.log('\n📋 Updated URL structure:');
    for (const company of updatedCompanies) {
      console.log(`\n🏢 Company: ${company.name} (/${company.slug})`);
      for (const dept of company.departments) {
        console.log(`   📁 Department: ${dept.name} (/${company.slug}/${dept.slug})`);
      }
    }

  } catch (error) {
    console.error('Error generating slugs:', error);
  } finally {
    await prisma.$disconnect();
  }
}

generateSlugs();