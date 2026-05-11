import { Router } from 'express';
import { ProjectsController } from './projects.controller';
import { authenticate } from '../../middleware/authenticate';
import { requirePermission } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { createProjectSchema, updateProjectSchema, idParamSchema } from './projects.validation';
import { PERMISSIONS } from '../../shared/constants/roles.constants';

export const projectsRouter = Router();
projectsRouter.use(authenticate);

projectsRouter.get(
  '/',
  requirePermission(PERMISSIONS.PROJECTS_READ),
  asyncHandler(ProjectsController.list),
);
projectsRouter.get(
  '/stats/global',
  requirePermission(PERMISSIONS.PROJECTS_READ),
  asyncHandler(ProjectsController.globalStats),
);
projectsRouter.post(
  '/',
  requirePermission(PERMISSIONS.PROJECTS_CREATE),
  validate(createProjectSchema),
  asyncHandler(ProjectsController.create),
);
projectsRouter.get(
  '/:id',
  requirePermission(PERMISSIONS.PROJECTS_READ),
  validate(idParamSchema, 'params'),
  asyncHandler(ProjectsController.get),
);
projectsRouter.get(
  '/:id/summary',
  requirePermission(PERMISSIONS.PROJECTS_READ),
  validate(idParamSchema, 'params'),
  asyncHandler(ProjectsController.summary),
);
projectsRouter.patch(
  '/:id',
  requirePermission(PERMISSIONS.PROJECTS_UPDATE),
  validate(idParamSchema, 'params'),
  validate(updateProjectSchema),
  asyncHandler(ProjectsController.update),
);
projectsRouter.delete(
  '/:id',
  requirePermission(PERMISSIONS.PROJECTS_DELETE),
  validate(idParamSchema, 'params'),
  asyncHandler(ProjectsController.remove),
);
