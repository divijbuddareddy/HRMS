import { describe, it, expect } from 'vitest';
import { hasPermission, getUserDataScope, sanitizeEmployeeForUser, maskAadhaar, maskPAN, maskBankAccount, isAdmin } from '../src/lib/rbac';
import { AuthUser } from '../src/lib/types';

describe('1A & 1B. RBAC, Data Scopes & Sensitive Data Masking', () => {
  const adminUser: AuthUser = {
    userId: 'usr_admin',
    tenantId: 'tenant_1',
    email: 'admin@company.com',
    roles: ['COMPANY_ADMIN'],
    permissions: [],
  };

  const superAdminUser: AuthUser = {
    userId: 'usr_super',
    tenantId: 'tenant_1',
    email: 'super@company.com',
    roles: ['PLATFORM_SUPER_ADMIN'],
    permissions: [],
  };

  const hrUser: AuthUser = {
    userId: 'usr_hr',
    tenantId: 'tenant_1',
    email: 'hr@company.com',
    roles: ['HR_ADMIN'],
    permissions: [
      { permissionKey: 'employee:read', dataScope: 'ENTIRE_TENANT', isSensitive: false },
      { permissionKey: 'employee:write', dataScope: 'ENTIRE_TENANT', isSensitive: false },
      { permissionKey: 'identity:read', dataScope: 'ENTIRE_TENANT', isSensitive: true },
      { permissionKey: 'bank:read', dataScope: 'ENTIRE_TENANT', isSensitive: true },
    ],
  };

  const managerUser: AuthUser = {
    userId: 'usr_mgr',
    tenantId: 'tenant_1',
    email: 'mgr@company.com',
    employeeId: 'emp_mgr_1',
    departmentId: 'dept_eng',
    roles: ['MANAGER'],
    permissions: [
      { permissionKey: 'employee:read', dataScope: 'DEPARTMENT', isSensitive: false },
      { permissionKey: 'leave:approve', dataScope: 'DIRECT_REPORTS', isSensitive: false },
      { permissionKey: 'attendance:read', dataScope: 'DEPARTMENT', isSensitive: false },
    ],
  };

  const employeeUser: AuthUser = {
    userId: 'usr_emp',
    tenantId: 'tenant_1',
    email: 'emp@company.com',
    employeeId: 'emp_dev_1',
    roles: ['EMPLOYEE'],
    permissions: [
      { permissionKey: 'employee:read', dataScope: 'OWN', isSensitive: false },
      { permissionKey: 'attendance:punch', dataScope: 'OWN', isSensitive: false },
      { permissionKey: 'leave:apply', dataScope: 'OWN', isSensitive: false },
    ],
  };

  it('should restrict edit and delete access to administrators only', () => {
    expect(isAdmin(adminUser)).toBe(true);
    expect(isAdmin(superAdminUser)).toBe(true);
    expect(isAdmin(hrUser)).toBe(true);
    expect(isAdmin(managerUser)).toBe(false);
    expect(isAdmin(employeeUser)).toBe(false);
  });

  it('should grant Company Admin full permissions automatically', () => {
    expect(hasPermission(adminUser, 'employee:read')).toBe(true);
    expect(hasPermission(adminUser, 'salary:manage')).toBe(true);
    expect(hasPermission(adminUser, 'payroll:lock')).toBe(true);
    expect(getUserDataScope(adminUser, 'employee:read')).toBe('ENTIRE_TENANT');
  });

  it('should enforce data scopes for Manager vs Employee', () => {
    // Manager has DEPARTMENT scope for employee:read
    expect(hasPermission(managerUser, 'employee:read', 'DEPARTMENT')).toBe(true);
    expect(hasPermission(managerUser, 'employee:read', 'ENTIRE_TENANT')).toBe(false);
    expect(getUserDataScope(managerUser, 'employee:read')).toBe('DEPARTMENT');

    // Employee has OWN scope only
    expect(hasPermission(employeeUser, 'employee:read', 'OWN')).toBe(true);
    expect(hasPermission(employeeUser, 'employee:read', 'DEPARTMENT')).toBe(false);
    expect(hasPermission(employeeUser, 'leave:approve')).toBe(false);
  });

  it('should properly mask Aadhaar, PAN, and Bank Account numbers', () => {
    expect(maskAadhaar('1234 5678 9012')).toBe('XXXX-XXXX-9012');
    expect(maskPAN('ABCDE1234F')).toBe('AB******4F');
    expect(maskBankAccount('50100998877665')).toBe('XXXXXX7665');
  });

  it('should sanitize sensitive employee fields when accessed by unauthorized users', () => {
    const rawEmployee = {
      id: 'emp_other_1',
      firstName: 'Rahul',
      lastName: 'Sharma',
      identity: {
        panNumber: 'ABCDE1234F',
        aadhaarNumber: '1234 5678 9012',
      },
      bank: {
        bankName: 'HDFC Bank',
        accountNumber: '50100998877665',
      },
      salaryAssignments: [{ ctc: 1500000, grossSalary: 125000 }],
    };

    // When viewed by regular employee, sensitive fields must be masked and salary stripped
    const sanitized = sanitizeEmployeeForUser(rawEmployee, employeeUser);
    expect(sanitized.identity?.panNumber).toBe('AB******4F');
    expect(sanitized.identity?.aadhaarNumber).toBe('XXXX-XXXX-9012');
    expect(sanitized.bank?.accountNumber).toBe('XXXXXX7665');
    expect(sanitized.salaryAssignments).toBeUndefined();

    // When viewed by HR Admin with permissions, fields remain unmasked
    const hrView = sanitizeEmployeeForUser(rawEmployee, hrUser);
    expect(hrView.identity?.panNumber).toBe('ABCDE1234F');
    expect(hrView.bank?.accountNumber).toBe('50100998877665');
  });
});
