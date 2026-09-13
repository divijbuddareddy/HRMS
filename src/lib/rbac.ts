import { AuthUser, DataScope, RoleName } from './types';
import { prisma } from './prisma';

export const PERMISSIONS = {
  // Employee Master
  EMPLOYEE_READ: 'employee:read',
  EMPLOYEE_WRITE: 'employee:write',
  EMPLOYEE_DELETE: 'employee:delete',
  EMPLOYEE_IMPORT: 'employee:import',
  
  // Sensitive Data
  SALARY_READ: 'salary:read',
  SALARY_MANAGE: 'salary:manage',
  BANK_READ: 'bank:read',
  IDENTITY_READ: 'identity:read',
  
  // Attendance & Time
  ATTENDANCE_PUNCH: 'attendance:punch',
  ATTENDANCE_READ: 'attendance:read',
  ATTENDANCE_MANAGE: 'attendance:manage',
  ATTENDANCE_REGULARIZE: 'attendance:regularize',
  ATTENDANCE_APPROVE: 'attendance:approve',
  
  // Leave
  LEAVE_APPLY: 'leave:apply',
  LEAVE_READ: 'leave:read',
  LEAVE_APPROVE: 'leave:approve',
  LEAVE_MANAGE: 'leave:manage',
  
  // Payroll & Statutory
  PAYROLL_READ: 'payroll:read',
  PAYROLL_RUN: 'payroll:run',
  PAYROLL_APPROVE: 'payroll:approve',
  PAYROLL_LOCK: 'payroll:lock',
  PAYROLL_OVERRIDE: 'payroll:override',
  PAYROLL_PUBLISH: 'payroll:publish',
  PAYSLIP_READ: 'payslip:read',
  STATUTORY_MANAGE: 'statutory:manage',
  
  // Admin & Settings
  ORGANIZATION_MANAGE: 'organization:manage',
  ROLES_MANAGE: 'roles:manage',
  AUDIT_LOG_READ: 'audit_log:read',
} as const;

export function isAdmin(user: AuthUser | null | undefined): boolean {
  if (!user || !user.roles) return false;
  return (
    user.roles.includes('COMPANY_ADMIN') ||
    user.roles.includes('PLATFORM_SUPER_ADMIN') ||
    user.roles.includes('HR_ADMIN')
  );
}

export function hasPermission(
  user: AuthUser,
  permissionKey: string,
  requiredScope: DataScope = 'OWN'
): boolean {
  // Platform Super Admin and Company Admin have full access
  if (user.roles.includes('PLATFORM_SUPER_ADMIN') || user.roles.includes('COMPANY_ADMIN')) {
    return true;
  }

  const matchingPerms = user.permissions.filter((p) => p.permissionKey === permissionKey);
  if (matchingPerms.length === 0) return false;

  const scopeHierarchy: Record<DataScope, number> = {
    ENTIRE_TENANT: 6,
    LEGAL_ENTITY: 5,
    BRANCH_LOCATION: 4,
    DEPARTMENT: 3,
    DIRECT_REPORTS: 2,
    OWN: 1,
  };

  const maxUserScopeLevel = Math.max(
    ...matchingPerms.map((p) => scopeHierarchy[p.dataScope] || 0)
  );

  return maxUserScopeLevel >= (scopeHierarchy[requiredScope] || 1);
}

export function getUserDataScope(user: AuthUser, permissionKey: string): DataScope {
  if (user.roles.includes('PLATFORM_SUPER_ADMIN') || user.roles.includes('COMPANY_ADMIN')) {
    return 'ENTIRE_TENANT';
  }

  const perms = user.permissions.filter((p) => p.permissionKey === permissionKey);
  if (perms.length === 0) return 'OWN';

  const scopeHierarchy: Record<DataScope, number> = {
    ENTIRE_TENANT: 6,
    LEGAL_ENTITY: 5,
    BRANCH_LOCATION: 4,
    DEPARTMENT: 3,
    DIRECT_REPORTS: 2,
    OWN: 1,
  };

  let bestScope: DataScope = 'OWN';
  let maxLevel = 0;
  for (const p of perms) {
    const lvl = scopeHierarchy[p.dataScope] || 1;
    if (lvl > maxLevel) {
      maxLevel = lvl;
      bestScope = p.dataScope;
    }
  }

  return bestScope;
}

export function maskAadhaar(aadhaar?: string | null): string {
  if (!aadhaar) return '';
  const clean = aadhaar.replace(/\s+/g, '');
  if (clean.length < 4) return '****';
  return `XXXX-XXXX-${clean.slice(-4)}`;
}

export function maskPAN(pan?: string | null): string {
  if (!pan) return '';
  if (pan.length < 4) return '*****';
  return `${pan.slice(0, 2)}******${pan.slice(-2)}`;
}

export function maskBankAccount(account?: string | null): string {
  if (!account) return '';
  if (account.length <= 4) return '****';
  return `XXXXXX${account.slice(-4)}`;
}

export function sanitizeEmployeeForUser<T extends Record<string, any>>(
  employee: T,
  user: AuthUser
): T {
  const canReadSalary = hasPermission(user, PERMISSIONS.SALARY_READ);
  const canReadBank = hasPermission(user, PERMISSIONS.BANK_READ);
  const canReadIdentity = hasPermission(user, PERMISSIONS.IDENTITY_READ);
  const isOwn = user.employeeId && user.employeeId === (employee as any).id;

  const sanitized: any = { ...employee };

  if (!isOwn && !canReadIdentity && sanitized.identity) {
    sanitized.identity = {
      ...sanitized.identity,
      aadhaarNumber: maskAadhaar(sanitized.identity.aadhaarNumber),
      panNumber: maskPAN(sanitized.identity.panNumber),
      passportNumber: sanitized.identity.passportNumber ? 'XXXXXX' : null,
      uanNumber: sanitized.identity.uanNumber ? 'XXXXXX' : null,
    };
  }

  if (!isOwn && !canReadBank && sanitized.bank) {
    sanitized.bank = {
      ...sanitized.bank,
      accountNumber: maskBankAccount(sanitized.bank.accountNumber),
    };
  }

  if (!isOwn && !canReadSalary) {
    delete sanitized.salaryAssignments;
    delete sanitized.payrollItems;
  }

  return sanitized as T;
}

export function filterSensitiveEmployeeData<T extends Record<string, any>>(
  emp: T,
  user: AuthUser,
  allowSensitive = false
): T {
  if (allowSensitive || hasPermission(user, PERMISSIONS.IDENTITY_READ)) {
    return emp;
  }
  const res: any = { ...emp };
  if (res.panNumber) res.panNumber = '••••••••••';
  if (res.aadhaarNumber) res.aadhaarNumber = '•••• •••• ••••';
  if (res.bankAccountNumber) res.bankAccountNumber = '••••••••••••';
  if (res.ctc && !hasPermission(user, PERMISSIONS.SALARY_READ)) res.ctc = '••••••';
  return res as T;
}
