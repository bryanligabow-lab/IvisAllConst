/**
 * One-shot cleanup script: wipes all business data and reactivates the admin user
 * so the system can be handed over fresh to the end client.
 *
 * Triggered at startup when env var `RUN_CLEANUP=1` is set.
 *
 * What it deletes (hard delete, in dependency order):
 *  - PaymentItems / PaymentOrders / Planillas / Gastos / Rubros / Projects
 *  - ProformaItems / ProformaImages / Proformas
 *  - Clients / Providers / Employees
 *
 * What it preserves:
 *  - Users, Roles, Permissions
 *  - Schema and config
 *
 * What it does to admin@ivisallconst.local:
 *  - Reactivates it (isActive = true)
 *  - Resets its password to the value of env var CLEANUP_ADMIN_PASSWORD
 *  - Restores super_admin role
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Starting demo-data cleanup...');

  // Helper: try delete with each model name, ignore unknown ones (schema may evolve).
  async function safeDeleteMany(model: keyof PrismaClient, label: string) {
    try {
      // @ts-expect-error dynamic delegate access
      const res = await prisma[model].deleteMany({});
      console.log(`  deleted ${res.count} ${label}`);
    } catch (err) {
      console.log(`  skipped ${label}: ${(err as Error).message}`);
    }
  }

  // Order matters: children first, then parents.
  await safeDeleteMany('proformaImage' as any, 'proforma images');
  await safeDeleteMany('proformaItem' as any, 'proforma items');
  await safeDeleteMany('proforma' as any, 'proformas');

  await safeDeleteMany('planillaItem' as any, 'planilla items');
  await safeDeleteMany('planilla' as any, 'planillas');

  await safeDeleteMany('paymentOrderPayment' as any, 'order partial payments');
  await safeDeleteMany('gasto' as any, 'gastos');
  await safeDeleteMany('paymentOrder' as any, 'payment orders');
  await safeDeleteMany('rubro' as any, 'rubros');
  await safeDeleteMany('project' as any, 'projects');

  await safeDeleteMany('payrollPayment' as any, 'payroll payments');
  await safeDeleteMany('employee' as any, 'employees');

  await safeDeleteMany('client' as any, 'clients');
  await safeDeleteMany('provider' as any, 'providers');

  // Reactivate admin
  const newAdminPassword = process.env.CLEANUP_ADMIN_PASSWORD;
  if (newAdminPassword) {
    const passwordHash = await bcrypt.hash(newAdminPassword, 10);
    const superAdminRole = await prisma.role.findUnique({ where: { name: 'super_admin' } });
    await prisma.user.update({
      where: { email: 'admin@ivisallconst.local' },
      data: {
        isActive: true,
        passwordHash,
        deletedAt: null,
        firstName: 'Admin',
        lastName: 'IvisAllConst',
      },
    });
    if (superAdminRole) {
      // Re-attach super_admin role if missing
      const admin = await prisma.user.findUnique({ where: { email: 'admin@ivisallconst.local' } });
      if (admin) {
        const existing = await prisma.userRole.findUnique({
          where: { userId_roleId: { userId: admin.id, roleId: superAdminRole.id } },
        });
        if (!existing) {
          await prisma.userRole.create({
            data: { userId: admin.id, roleId: superAdminRole.id },
          });
        }
      }
    }
    console.log('  ✓ admin@ivisallconst.local reactivated and password reset');
  } else {
    console.log('  (CLEANUP_ADMIN_PASSWORD not set, skipping admin reset)');
  }

  console.log('✅ Cleanup done.');
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
