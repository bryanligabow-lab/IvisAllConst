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
    }
  }
}

export {};
