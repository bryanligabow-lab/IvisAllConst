export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export class BadRequestError extends HttpError {
  constructor(message = 'Solicitud inválida', details?: unknown) {
    super(400, 'BAD_REQUEST', message, details);
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message = 'No autenticado') {
    super(401, 'UNAUTHORIZED', message);
  }
}

export class ForbiddenError extends HttpError {
  constructor(message = 'No autorizado') {
    super(403, 'FORBIDDEN', message);
  }
}

export class NotFoundError extends HttpError {
  constructor(message = 'No encontrado') {
    super(404, 'NOT_FOUND', message);
  }
}

export class ConflictError extends HttpError {
  constructor(message = 'Conflicto', details?: unknown) {
    super(409, 'CONFLICT', message, details);
  }
}

export class ValidationError extends HttpError {
  constructor(details: unknown, message = 'Datos inválidos') {
    super(422, 'VALIDATION_ERROR', message, details);
  }
}
