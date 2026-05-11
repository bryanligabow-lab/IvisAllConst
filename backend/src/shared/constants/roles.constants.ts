/**
 * Roles y permisos del sistema. Cualquier nuevo rol/permiso se añade
 * AQUÍ y en el seed; el resto del código los referencia por nombre.
 */

export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  USER: 'user',
} as const;
export type RoleName = (typeof ROLES)[keyof typeof ROLES];

export const PERMISSIONS = {
  USERS_READ: 'users.read',
  USERS_CREATE: 'users.create',
  USERS_UPDATE: 'users.update',
  USERS_DELETE: 'users.delete',

  PROJECTS_READ: 'projects.read',
  PROJECTS_CREATE: 'projects.create',
  PROJECTS_UPDATE: 'projects.update',
  PROJECTS_DELETE: 'projects.delete',

  RUBROS_READ: 'rubros.read',
  RUBROS_WRITE: 'rubros.write',

  GASTOS_READ: 'gastos.read',
  GASTOS_WRITE: 'gastos.write',

  PLANILLAS_READ: 'planillas.read',
  PLANILLAS_WRITE: 'planillas.write',
  PLANILLAS_EXPORT: 'planillas.export',

  PAYMENT_ORDERS_READ: 'payment_orders.read',
  PAYMENT_ORDERS_WRITE: 'payment_orders.write',

  PROVIDERS_READ: 'providers.read',
  PROVIDERS_WRITE: 'providers.write',

  EMPLOYEES_READ: 'employees.read',
  EMPLOYEES_WRITE: 'employees.write',

  PAYROLL_READ: 'payroll.read',
  PAYROLL_WRITE: 'payroll.write',

  PROFORMAS_READ: 'proformas.read',
  PROFORMAS_WRITE: 'proformas.write',
  PROFORMAS_EXPORT: 'proformas.export',

  CLIENTS_READ: 'clients.read',
  CLIENTS_WRITE: 'clients.write',
} as const;
export type PermissionName = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const DEFAULT_ROLE_FOR_NEW_USERS: RoleName = ROLES.USER;
