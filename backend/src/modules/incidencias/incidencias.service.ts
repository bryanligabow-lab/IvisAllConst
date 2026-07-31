import { prisma } from '../../config/database';
import { NotFoundError, BadRequestError } from '../../utils/errors';

export const INCIDENCIA_MODULES = [
  'PROFORMAS',
  'PLANILLAS',
  'GASTOS',
  'ORDENES',
  'PROYECTOS',
  'PROVEEDORES',
  'CLIENTES',
  'NOMINA',
  'DASHBOARD',
  'OTRO',
] as const;
export const INCIDENCIA_URGENCIES = ['BAJA', 'MEDIA', 'ALTA'] as const;
export const INCIDENCIA_STATUSES = ['ABIERTA', 'EN_REVISION', 'RESUELTA', 'CERRADA'] as const;

export type IncidenciaStatus = (typeof INCIDENCIA_STATUSES)[number];

const MAX_IMAGE_BYTES = 6 * 1024 * 1024; // 6 MB

interface ImageInput {
  imageBase64?: string | null;
  imageMime?: string | null;
}

function decodeImage(input: ImageInput): { data: Buffer; mime: string } | null {
  if (!input.imageBase64 || !input.imageMime) return null;
  const buf = Buffer.from(input.imageBase64, 'base64');
  if (buf.length === 0) throw new BadRequestError('La imagen está vacía');
  if (buf.length > MAX_IMAGE_BYTES) {
    throw new BadRequestError(`La imagen debe pesar menos de ${MAX_IMAGE_BYTES / 1024 / 1024} MB`);
  }
  return { data: buf, mime: input.imageMime };
}

// La lista NO envía los binarios de las imágenes (solo si existen), para no
// mandar megas por cada incidencia.
const listSelect = {
  id: true,
  number: true,
  title: true,
  description: true,
  module: true,
  urgency: true,
  status: true,
  imageMime: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
  resolvedAt: true,
  closedAt: true,
  creator: { select: { firstName: true, lastName: true, email: true } },
  _count: { select: { messages: true } },
} as const;

interface CreateInput extends ImageInput {
  title: string;
  description: string;
  module: string;
  urgency: string;
}

interface MessageInput extends ImageInput {
  body: string;
}

export class IncidenciasService {
  static async list(filter?: { status?: string; urgency?: string; module?: string }) {
    const where = {
      deletedAt: null,
      ...(filter?.status ? { status: filter.status } : {}),
      ...(filter?.urgency ? { urgency: filter.urgency } : {}),
      ...(filter?.module ? { module: filter.module } : {}),
    };
    const [items, grouped] = await Promise.all([
      prisma.incidencia.findMany({
        where,
        select: listSelect,
        // Abiertas primero, luego en revisión, resueltas y cerradas; dentro de
        // cada grupo, las más urgentes y recientes arriba.
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      }),
      prisma.incidencia.groupBy({
        by: ['status'],
        where: { deletedAt: null },
        _count: { _all: true },
      }),
    ]);
    const counts: Record<string, number> = {
      ABIERTA: 0,
      EN_REVISION: 0,
      RESUELTA: 0,
      CERRADA: 0,
    };
    for (const g of grouped) counts[g.status] = g._count._all;
    return { items, counts };
  }

  static async getById(id: string) {
    const incidencia = await prisma.incidencia.findFirst({
      where: { id, deletedAt: null },
      select: {
        ...listSelect,
        messages: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            body: true,
            authorRole: true,
            authorName: true,
            imageMime: true,
            createdAt: true,
            author: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });
    if (!incidencia) throw new NotFoundError('Incidencia no encontrada');
    return incidencia;
  }

  static async create(input: CreateInput, userId: string) {
    const img = decodeImage(input);
    const last = await prisma.incidencia.findFirst({
      orderBy: { number: 'desc' },
      select: { number: true },
    });
    const created = await prisma.incidencia.create({
      data: {
        number: (last?.number ?? 0) + 1,
        title: input.title.trim(),
        description: input.description.trim(),
        module: input.module,
        urgency: input.urgency,
        status: 'ABIERTA',
        createdBy: userId,
        ...(img ? { imageData: img.data, imageMime: img.mime } : {}),
      },
      select: listSelect,
    });
    return created;
  }

  /**
   * Agrega un mensaje al hilo. Si `asTecnico`, marca la incidencia como
   * RESUELTA (el técnico contestó); si la escribe quien reportó y estaba
   * ABIERTA, pasa a EN_REVISION para reflejar que ya hay ida y vuelta.
   */
  static async addMessage(
    id: string,
    input: MessageInput,
    opts: { asTecnico: boolean; authorId?: string | null; authorName?: string | null },
  ) {
    const incidencia = await prisma.incidencia.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, status: true },
    });
    if (!incidencia) throw new NotFoundError('Incidencia no encontrada');
    const img = decodeImage(input);

    const nextStatus = opts.asTecnico
      ? 'RESUELTA'
      : incidencia.status === 'ABIERTA'
        ? 'EN_REVISION'
        : incidencia.status;

    await prisma.$transaction([
      prisma.incidenciaMessage.create({
        data: {
          incidenciaId: id,
          body: input.body.trim(),
          authorRole: opts.asTecnico ? 'TECNICO' : 'OPERADOR',
          authorId: opts.authorId ?? null,
          authorName: opts.authorName ?? null,
          ...(img ? { imageData: img.data, imageMime: img.mime } : {}),
        },
      }),
      prisma.incidencia.update({
        where: { id },
        data: {
          status: nextStatus,
          ...(opts.asTecnico ? { resolvedAt: new Date() } : {}),
        },
      }),
    ]);
    return this.getById(id);
  }

  static async setStatus(id: string, status: IncidenciaStatus) {
    const incidencia = await prisma.incidencia.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!incidencia) throw new NotFoundError('Incidencia no encontrada');
    return prisma.incidencia.update({
      where: { id },
      data: {
        status,
        ...(status === 'RESUELTA' ? { resolvedAt: new Date() } : {}),
        ...(status === 'CERRADA' ? { closedAt: new Date() } : {}),
      },
      select: listSelect,
    });
  }

  static async softDelete(id: string) {
    const incidencia = await prisma.incidencia.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!incidencia) throw new NotFoundError('Incidencia no encontrada');
    await prisma.incidencia.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
