import { Router } from 'express';
import { prisma } from '../../config/database';
import { authenticate } from '../../middleware/authenticate';
import { loadProjectScope } from '../../middleware/projectScope';
import { asyncHandler } from '../../utils/asyncHandler';
import { success } from '../../utils/apiResponse';

export const homeRouter = Router();
homeRouter.use(authenticate);
homeRouter.use(loadProjectScope);

/**
 * Contadores de la pantalla de inicio de la app: un número por área, para que
 * cada tarjeta diga algo útil ("22 activos", "8 pendientes"…). Es solo lectura
 * y barato; cada tarjeta se muestra u oculta en el front según los permisos.
 */
homeRouter.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const scope = req.allowedProjectIds;
    const projectWhere = {
      deletedAt: null,
      ...(scope ? { id: { in: scope } } : {}),
    };
    const chequeMesDesde = new Date();
    chequeMesDesde.setDate(1);
    chequeMesDesde.setHours(0, 0, 0, 0);

    const [
      proyectosActivos,
      proyectosTotal,
      proformasBorrador,
      proformasTotal,
      planillasPorRevisar,
      chequesPendientes,
      chequesMes,
      proveedores,
      subcontratistas,
      empleados,
    ] = await Promise.all([
      prisma.project.count({ where: { ...projectWhere, status: 'ACTIVE' } }),
      prisma.project.count({ where: projectWhere }),
      prisma.proforma.count({ where: { deletedAt: null, status: 'DRAFT' } }),
      prisma.proforma.count({ where: { deletedAt: null } }),
      prisma.planilla.count({
        where: {
          deletedAt: null,
          status: { in: ['SUBMITTED', 'FISCALIZACION', 'CONTRALORIA'] },
          ...(scope ? { projectId: { in: scope } } : {}),
        },
      }),
      prisma.cheque.count({ where: { deletedAt: null, status: 'PENDIENTE' } }),
      prisma.cheque.count({
        where: { deletedAt: null, dueDate: { gte: chequeMesDesde } },
      }),
      prisma.provider.count({ where: { deletedAt: null } }),
      prisma.provider.count({ where: { deletedAt: null, isSubcontractor: true } }),
      prisma.employee.count({ where: { deletedAt: null } }),
    ]);

    return success(res, {
      proyectos: { activos: proyectosActivos, total: proyectosTotal },
      proformas: { pendientes: proformasBorrador, total: proformasTotal },
      planillas: { porRevisar: planillasPorRevisar },
      cheques: { pendientes: chequesPendientes, esteMes: chequesMes },
      proveedores: { total: proveedores },
      subcontratistas: { total: subcontratistas },
      nomina: { empleados },
    });
  }),
);
