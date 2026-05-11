import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const PERMISSIONS: Array<{ name: string; resource: string; action: string; description: string }> = [
  // users
  { name: 'users.read', resource: 'users', action: 'read', description: 'Listar y ver usuarios' },
  { name: 'users.create', resource: 'users', action: 'create', description: 'Crear usuarios' },
  { name: 'users.update', resource: 'users', action: 'update', description: 'Editar usuarios' },
  { name: 'users.delete', resource: 'users', action: 'delete', description: 'Eliminar usuarios' },
  // projects
  { name: 'projects.read', resource: 'projects', action: 'read', description: 'Ver proyectos' },
  { name: 'projects.create', resource: 'projects', action: 'create', description: 'Crear proyectos' },
  { name: 'projects.update', resource: 'projects', action: 'update', description: 'Editar proyectos' },
  { name: 'projects.delete', resource: 'projects', action: 'delete', description: 'Eliminar proyectos' },
  // rubros
  { name: 'rubros.read', resource: 'rubros', action: 'read', description: 'Ver presupuesto/rubros' },
  { name: 'rubros.write', resource: 'rubros', action: 'write', description: 'Editar rubros' },
  // gastos
  { name: 'gastos.read', resource: 'gastos', action: 'read', description: 'Ver gastos' },
  { name: 'gastos.write', resource: 'gastos', action: 'write', description: 'Registrar/editar gastos' },
  // planillas
  { name: 'planillas.read', resource: 'planillas', action: 'read', description: 'Ver planillas' },
  { name: 'planillas.write', resource: 'planillas', action: 'write', description: 'Crear/editar planillas' },
  { name: 'planillas.export', resource: 'planillas', action: 'export', description: 'Exportar planillas a Excel' },
  // payment orders
  { name: 'payment_orders.read', resource: 'payment_orders', action: 'read', description: 'Ver órdenes de pago' },
  { name: 'payment_orders.write', resource: 'payment_orders', action: 'write', description: 'Crear/pagar/eliminar órdenes de pago' },
];

async function main() {
  console.log('🌱 Seeding base data...');

  // ---------- Permisos ----------
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { name: p.name },
      update: { description: p.description, resource: p.resource, action: p.action },
      create: p,
    });
  }

  const allPermissions = await prisma.permission.findMany();

  // ---------- Roles ----------
  const superAdmin = await prisma.role.upsert({
    where: { name: 'super_admin' },
    update: {},
    create: {
      name: 'super_admin',
      description: 'Acceso total al sistema',
      isSystem: true,
    },
  });

  const admin = await prisma.role.upsert({
    where: { name: 'admin' },
    update: {},
    create: {
      name: 'admin',
      description: 'Administrador con acceso a casi todo',
      isSystem: true,
    },
  });

  const user = await prisma.role.upsert({
    where: { name: 'user' },
    update: {},
    create: {
      name: 'user',
      description: 'Usuario estándar (operario / supervisor)',
      isSystem: true,
    },
  });

  // super_admin: todos los permisos
  for (const p of allPermissions) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: superAdmin.id, permissionId: p.id } },
      update: {},
      create: { roleId: superAdmin.id, permissionId: p.id },
    });
  }

  // admin: todos salvo users.delete
  for (const p of allPermissions.filter((x) => x.name !== 'users.delete')) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: admin.id, permissionId: p.id } },
      update: {},
      create: { roleId: admin.id, permissionId: p.id },
    });
  }

  // user: lectura y registro de gastos
  const userPermNames = [
    'projects.read',
    'rubros.read',
    'gastos.read',
    'gastos.write',
    'planillas.read',
    'payment_orders.read',
    'payment_orders.write',
  ];
  for (const p of allPermissions.filter((x) => userPermNames.includes(x.name))) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: user.id, permissionId: p.id } },
      update: {},
      create: { roleId: user.id, permissionId: p.id },
    });
  }

  // ---------- Usuario admin ----------
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@ivisallconst.local';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin123!';
  const adminFirstName = process.env.SEED_ADMIN_FIRST_NAME || 'Admin';
  const adminLastName = process.env.SEED_ADMIN_LAST_NAME || 'IvisAllConst';
  const bcryptCost = Number(process.env.BCRYPT_COST || 12);

  const passwordHash = await bcrypt.hash(adminPassword, bcryptCost);

  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash,
      firstName: adminFirstName,
      lastName: adminLastName,
      emailVerified: true,
      isActive: true,
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: adminUser.id, roleId: superAdmin.id } },
    update: {},
    create: { userId: adminUser.id, roleId: superAdmin.id },
  });

  // ---------- Proyectos demo ----------
  await seedProject(adminUser.id, {
    code: 'TEC-URB-MM-003-2025',
    name: 'Mundo Mágico en Rosedales 2 — Fase 1',
    contractor: 'Ambiensa S.A.',
    description: 'Urbanización: áreas exteriores, ventas, agua potable, alcantarillado y eléctricas',
    contractAmount: 29007.43,
    startDate: new Date('2025-10-16'),
    endDate: new Date('2025-11-15'),
    rubros: [
      { code: '1', name: 'Área exterior villas', budgetedAmount: 5687 },
      { code: '2', name: 'Área de ventas', budgetedAmount: 896 },
      { code: '3', name: 'Sistema agua potable', budgetedAmount: 1280 },
      { code: '4', name: 'Aguas servidas', budgetedAmount: 362 },
      { code: '5', name: 'Aguas lluvias', budgetedAmount: 570 },
      { code: '6', name: 'Seguridad contra incendio', budgetedAmount: 2806 },
      { code: '7', name: 'Instalaciones eléctricas', budgetedAmount: 3646 },
      { code: '8', name: 'Varios', budgetedAmount: 2375 },
      { code: '9', name: 'Rubros nuevos', budgetedAmount: 10270 },
    ],
    gastos: [
      { rubroCode: '1', description: 'Adoquines exteriores 200 m²', amount: 2450, daysAgo: 18, invoice: '001-001-000451' },
      { rubroCode: '1', description: 'Mano de obra cuadrilla — semana 1', amount: 1200, daysAgo: 14 },
      { rubroCode: '3', description: 'Tubería PVC 110mm + accesorios', amount: 985, daysAgo: 12, invoice: '001-001-000478' },
      { rubroCode: '6', description: 'Equipos hidrantes Bermad', amount: 1875, daysAgo: 9, invoice: '003-002-000017' },
      { rubroCode: '7', description: 'Cable THHN cal. 12 — 1500 mts', amount: 1420, daysAgo: 7, invoice: '001-001-000503' },
      { rubroCode: '7', description: 'Tableros de distribución 12P', amount: 980, daysAgo: 5 },
      { rubroCode: '8', description: 'Renta retroexcavadora — 3 días', amount: 720, daysAgo: 3, invoice: '005-001-000089' },
    ],
    planillas: [
      {
        title: 'Planilla 01 — Octubre 2025',
        periodStart: new Date('2025-10-16'),
        periodEnd: new Date('2025-10-31'),
        status: 'APPROVED',
        items: [
          { rubroCode: '1', executedQuantity: 1, currentAmount: 3650 },
          { rubroCode: '3', executedQuantity: 1, currentAmount: 985 },
          { rubroCode: '6', executedQuantity: 1, currentAmount: 1875 },
        ],
      },
    ],
  });

  await seedProject(adminUser.id, {
    code: 'CIV-VIA-LP-008-2025',
    name: 'Pavimentación Av. Los Pinos — Tramo 2',
    contractor: 'Municipio de Quito',
    description: 'Repavimentación, bordillos y señalización horizontal en 1.2km',
    contractAmount: 84500.0,
    startDate: new Date('2025-08-01'),
    endDate: new Date('2026-01-30'),
    rubros: [
      { code: '1', name: 'Movimiento de tierras', budgetedAmount: 12000 },
      { code: '2', name: 'Base granular', budgetedAmount: 18500 },
      { code: '3', name: 'Carpeta asfáltica', budgetedAmount: 32000 },
      { code: '4', name: 'Bordillos y aceras', budgetedAmount: 14000 },
      { code: '5', name: 'Señalización horizontal', budgetedAmount: 5000 },
      { code: '6', name: 'Imprevistos', budgetedAmount: 3000 },
    ],
    gastos: [
      { rubroCode: '1', description: 'Excavación + retiro de material', amount: 8400, daysAgo: 60, invoice: '001-002-000031' },
      { rubroCode: '2', description: 'Base granular clase II 600 m³', amount: 15200, daysAgo: 40, invoice: '001-002-000044' },
      { rubroCode: '3', description: 'Asfalto en planta + transporte', amount: 11500, daysAgo: 20, invoice: '001-002-000061' },
      { rubroCode: '4', description: 'Hormigón f\'c=210 — bordillos', amount: 5800, daysAgo: 10 },
    ],
  });

  await seedProject(adminUser.id, {
    code: 'EDF-VIV-CA-012-2026',
    name: 'Edificio Las Cañas — Estructura',
    contractor: 'Inmobiliaria Castillo',
    description: 'Obra civil estructural de edificio residencial de 8 plantas',
    contractAmount: 215000.0,
    startDate: new Date('2026-02-01'),
    endDate: new Date('2026-12-15'),
    status: 'DRAFT',
    rubros: [
      { code: '1', name: 'Cimentación', budgetedAmount: 45000 },
      { code: '2', name: 'Estructura hormigón', budgetedAmount: 92000 },
      { code: '3', name: 'Mampostería', budgetedAmount: 35000 },
      { code: '4', name: 'Acabados', budgetedAmount: 28000 },
      { code: '5', name: 'Indirectos', budgetedAmount: 15000 },
    ],
  });

  console.log(`✓ Admin: ${adminEmail} / contraseña: ${adminPassword}`);
  console.log('✅ Seed completado');
}

// ---------- Helpers ----------

interface SeedRubro {
  code: string;
  name: string;
  budgetedAmount: number;
}

interface SeedGasto {
  rubroCode: string;
  description: string;
  amount: number;
  daysAgo: number;
  invoice?: string;
}

interface SeedPlanillaItem {
  rubroCode: string;
  executedQuantity: number;
  currentAmount: number;
}

interface SeedPlanilla {
  title: string;
  periodStart: Date;
  periodEnd: Date;
  status?: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'PAID' | 'CANCELLED';
  items: SeedPlanillaItem[];
}

interface SeedProjectInput {
  code: string;
  name: string;
  contractor: string;
  description?: string;
  contractAmount: number;
  startDate: Date;
  endDate: Date;
  status?: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
  rubros: SeedRubro[];
  gastos?: SeedGasto[];
  planillas?: SeedPlanilla[];
}

async function seedProject(adminUserId: string, input: SeedProjectInput) {
  const existing = await prisma.project.findUnique({ where: { code: input.code } });
  if (existing) {
    console.log(`↺ Proyecto ya existe (${input.code}), skip`);
    return;
  }

  const project = await prisma.project.create({
    data: {
      code: input.code,
      name: input.name,
      contractor: input.contractor,
      description: input.description,
      contractAmount: input.contractAmount,
      advancePercent: 40,
      guaranteePercent: 5,
      startDate: input.startDate,
      endDate: input.endDate,
      status: input.status || 'ACTIVE',
      createdBy: adminUserId,
    },
  });

  const rubroByCode = new Map<string, string>();
  for (let i = 0; i < input.rubros.length; i++) {
    const r = input.rubros[i];
    const created = await prisma.rubro.create({
      data: {
        projectId: project.id,
        code: r.code,
        name: r.name,
        budgetedAmount: r.budgetedAmount,
        orderIndex: i + 1,
        isGroup: true,
      },
    });
    rubroByCode.set(r.code, created.id);
  }

  for (const g of input.gastos || []) {
    const rubroId = rubroByCode.get(g.rubroCode);
    if (!rubroId) continue;
    const gastoDate = new Date(Date.now() - g.daysAgo * 24 * 60 * 60 * 1000);
    await prisma.gasto.create({
      data: {
        projectId: project.id,
        rubroId,
        description: g.description,
        amount: g.amount,
        gastoDate,
        invoiceNumber: g.invoice,
        createdBy: adminUserId,
      },
    });
  }

  let planillaNumber = 0;
  for (const p of input.planillas || []) {
    planillaNumber += 1;
    const totalCurrent = p.items.reduce((acc, i) => acc + i.currentAmount, 0);
    const advanceAmortization = totalCurrent * 0.4;
    const guaranteeRetention = totalCurrent * 0.05;
    const netPayable = totalCurrent - advanceAmortization - guaranteeRetention;

    const created = await prisma.planilla.create({
      data: {
        projectId: project.id,
        number: planillaNumber,
        title: p.title,
        status: p.status || 'DRAFT',
        periodStart: p.periodStart,
        periodEnd: p.periodEnd,
        totalCurrent,
        totalPrevious: 0,
        totalAccumulated: totalCurrent,
        advanceAmortization,
        guaranteeRetention,
        netPayable,
        createdBy: adminUserId,
      },
    });

    for (const it of p.items) {
      const rubroId = rubroByCode.get(it.rubroCode);
      if (!rubroId) continue;
      await prisma.planillaItem.create({
        data: {
          planillaId: created.id,
          rubroId,
          executedQuantity: it.executedQuantity,
          currentAmount: it.currentAmount,
        },
      });
    }
  }

  console.log(`✓ Proyecto: ${project.name}`);
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
