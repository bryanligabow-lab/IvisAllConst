import type { Request, Response } from 'express';
import { ProjectsService } from './projects.service';
import { success, buildPaginationMeta } from '../../utils/apiResponse';
import { getPagination } from '../../utils/pagination';
import { UnauthorizedError } from '../../utils/errors';
import { SUCCESS } from '../../shared/constants/error-messages';

export class ProjectsController {
  static async list(req: Request, res: Response): Promise<Response> {
    const { page, perPage, skip, take } = getPagination(req);
    const [items, total] = await ProjectsService.list(skip, take, req.allowedProjectIds ?? null);
    return success(res, items, 200, buildPaginationMeta(total, page, perPage));
  }

  static async get(req: Request, res: Response): Promise<Response> {
    const data = await ProjectsService.getById(req.params.id);
    return success(res, data);
  }

  static async summary(req: Request, res: Response): Promise<Response> {
    const data = await ProjectsService.getSummary(req.params.id);
    return success(res, data);
  }

  static async globalStats(req: Request, res: Response): Promise<Response> {
    const data = await ProjectsService.getGlobalStats(req.allowedProjectIds ?? null);
    return success(res, data);
  }

  static async subcontractors(req: Request, res: Response): Promise<Response> {
    const data = await ProjectsService.getSubcontractors(req.allowedProjectIds ?? null);
    return success(res, data);
  }

  static async create(req: Request, res: Response): Promise<Response> {
    if (!req.user) throw new UnauthorizedError();
    const project = await ProjectsService.create(req.body, req.user.id);
    return success(res, project, 201);
  }

  static async update(req: Request, res: Response): Promise<Response> {
    const project = await ProjectsService.update(req.params.id, req.body);
    return success(res, project);
  }

  static async remove(req: Request, res: Response): Promise<Response> {
    await ProjectsService.softDelete(req.params.id);
    return success(res, { message: SUCCESS.PROJECT_DELETED });
  }
}
