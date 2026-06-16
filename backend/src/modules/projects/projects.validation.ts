import { z } from 'zod';
import { calendarDateSchema } from '../../shared/utils/date.util';

export { idParamSchema, type IdParamDto } from '../../shared/dto/id-param.dto';

export const projectStatusSchema = z.enum([
  'DRAFT',
  'ACTIVE',
  'PAUSED',
  'COMPLETED',
  'CANCELLED',
]);

export const executionTypeSchema = z.enum(['OWN', 'SUBCONTRACTED']);

export const createProjectSchema = z.object({
  code: z.string().min(1).max(80),
  name: z.string().min(1).max(200),
  contractor: z.string().max(200).optional(),
  // Cliente que solicita el contrato (catálogo de clientes).
  clientId: z.string().uuid().optional().nullable(),
  // Quién ejecuta: propio (CREACOM) o subcontratado.
  executionType: executionTypeSchema.default('OWN').optional(),
  // Subcontratista (proveedor) cuando executionType = SUBCONTRACTED.
  subcontractorId: z.string().uuid().optional().nullable(),
  // % de ganancia de CREACOM cuando la obra es subcontratada.
  creacomProfitPercent: z.coerce.number().min(0).max(100).default(0).optional(),
  description: z.string().max(2000).optional(),
  city: z.string().max(120).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  contractAmount: z.coerce.number().nonnegative(),
  advancePercent: z.coerce.number().min(0).max(100).default(40),
  guaranteePercent: z.coerce.number().min(0).max(100).default(5),
  // IVA
  vatPercent: z.coerce.number().min(0).max(100).default(15).optional(),
  vatIncluded: z.coerce.boolean().default(false).optional(),
  // Retenciones (cuando el cliente es agente de retención)
  isWithholdingAgent: z.coerce.boolean().default(false).optional(),
  vatRetentionPercent: z.coerce.number().min(0).max(100).default(0).optional(),
  incomeRetentionPercent: z.coerce.number().min(0).max(100).default(0).optional(),
  startDate: calendarDateSchema.optional(),
  endDate: calendarDateSchema.optional(),
  status: projectStatusSchema.optional(),
});

export const updateProjectSchema = createProjectSchema.partial();

export type CreateProjectDto = z.infer<typeof createProjectSchema>;
export type UpdateProjectDto = z.infer<typeof updateProjectSchema>;
