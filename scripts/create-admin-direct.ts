import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createAdmin() {
  try {
    console.log('🚀 Creating admin user...\n');

    const email = 'admin@carbidding.com';
    const password = 'admin123';
    const name = 'System Administrator';

    // Check if admin exists
    const existing = await prisma.adminUser.findUnique({
      where: { email }
    });

    if (existing) {
      console.log('⚠️  Admin user already exists!');
      console.log(`   Email: ${existing.email}`);
      console.log(`   Name: ${existing.name}\n`);

      // Update password
      const passwordHash = await bcrypt.hash(password, 10);
      await prisma.adminUser.update({
        where: { email },
        data: { passwordHash }
      });

      console.log('✅ Password updated to: admin123\n');
      return;
    }

    // Create password hash
    const passwordHash = await bcrypt.hash(password, 10);

    // Create admin user
    const admin = await prisma.adminUser.create({
      data: {
        email,
        passwordHash,
        name
      }
    });

    console.log('✅ Admin user created successfully!\n');
    console.log('📧 Email:', email);
    console.log('🔑 Password:', password);
    console.log('👤 Name:', name);
    console.log('🆔 ID:', admin.id);
    console.log('\n🎯 Login at: http://localhost:5173/admin\n');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();
