import 'express';

declare global {
  namespace Express {
    interface UserContext {
      id: string;
      email: string;
      roles: string[];
      permissions: string[];
    }
    interface Request {
      user?: UserContext;
      requestId?: string;
      // null = sin restricción (admin/super_admin/user). Array = solo estos
      // proyectos (operador / roles acotados). Lo setea loadProjectScope.
      allowedProjectIds?: string[] | null;
    }
  }
}

export {};
