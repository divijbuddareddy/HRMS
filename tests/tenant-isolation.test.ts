import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('1A. Multi-Tenant SaaS & Data Isolation', () => {
  let tenantAId: string;
  let tenantBId: string;

  beforeAll(async () => {
    // Create Tenant A
    const tenantA = await prisma.tenant.upsert({
      where: { slug: 'test-tenant-a' },
      update: {},
      create: {
        name: 'Tenant Alpha Corp',
        slug: 'test-tenant-a',
        status: 'ACTIVE',
      },
    });
    tenantAId = tenantA.id;

    // Create Tenant B
    const tenantB = await prisma.tenant.upsert({
      where: { slug: 'test-tenant-b' },
      update: {},
      create: {
        name: 'Tenant Beta Corp',
        slug: 'test-tenant-b',
        status: 'ACTIVE',
      },
    });
    tenantBId = tenantB.id;

    // Create Legal Entity for Tenant A
    const leA = await prisma.legalEntity.upsert({
      where: { tenantId_code: { tenantId: tenantAId, code: 'ALPHA_LE' } },
      update: {},
      create: { tenantId: tenantAId, name: 'Alpha Legal Entity', code: 'ALPHA_LE' },
    });

    // Create Branch for Tenant A
    const brA = await prisma.branchLocation.upsert({
      where: { tenantId_code: { tenantId: tenantAId, code: 'ALPHA_BR' } },
      update: {},
      create: { tenantId: tenantAId, legalEntityId: leA.id, name: 'Alpha HQ', code: 'ALPHA_BR', city: 'BLR', state: 'KARNATAKA' },
    });

    // Create Dept for Tenant A
    const deptA = await prisma.department.upsert({
      where: { tenantId_code: { tenantId: tenantAId, code: 'ALPHA_DEPT' } },
      update: {},
      create: { tenantId: tenantAId, name: 'Alpha Dept', code: 'ALPHA_DEPT' },
    });

    // Create Desig for Tenant A
    const desigA = await prisma.designation.upsert({
      where: { tenantId_code: { tenantId: tenantAId, code: 'ALPHA_DESIG' } },
      update: {},
      create: { tenantId: tenantAId, title: 'Alpha Engineer', code: 'ALPHA_DESIG' },
    });

    // Create Employee in Tenant A
    await prisma.employee.upsert({
      where: { tenantId_workEmail: { tenantId: tenantAId, workEmail: 'john@alpha.com' } },
      update: {},
      create: {
        tenantId: tenantAId,
        employeeCode: 'ALPHA-001',
        firstName: 'John',
        lastName: 'Alpha',
        workEmail: 'john@alpha.com',
        joiningDate: new Date(),
        legalEntityId: leA.id,
        branchLocationId: brA.id,
        departmentId: deptA.id,
        designationId: desigA.id,
        status: 'ACTIVE',
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should strictly isolate employee records by tenantId', async () => {
    // Querying with Tenant A's tenantId should find John
    const alphaEmployees = await prisma.employee.findMany({
      where: { tenantId: tenantAId },
    });
    expect(alphaEmployees.length).toBeGreaterThanOrEqual(1);
    expect(alphaEmployees.some((e) => e.workEmail === 'john@alpha.com')).toBe(true);

    // Querying with Tenant B's tenantId must NOT return any records of Tenant A
    const betaEmployees = await prisma.employee.findMany({
      where: { tenantId: tenantBId },
    });
    expect(betaEmployees.some((e) => e.workEmail === 'john@alpha.com')).toBe(false);
  });

  it('should prevent cross-tenant unique collision on employeeCode across distinct tenants', async () => {
    // Create Legal Entity for Tenant B
    const leB = await prisma.legalEntity.upsert({
      where: { tenantId_code: { tenantId: tenantBId, code: 'BETA_LE' } },
      update: {},
      create: { tenantId: tenantBId, name: 'Beta Legal Entity', code: 'BETA_LE' },
    });

    const brB = await prisma.branchLocation.upsert({
      where: { tenantId_code: { tenantId: tenantBId, code: 'BETA_BR' } },
      update: {},
      create: { tenantId: tenantBId, legalEntityId: leB.id, name: 'Beta HQ', code: 'BETA_BR', city: 'MUM', state: 'MAHARASHTRA' },
    });

    const deptB = await prisma.department.upsert({
      where: { tenantId_code: { tenantId: tenantBId, code: 'BETA_DEPT' } },
      update: {},
      create: { tenantId: tenantBId, name: 'Beta Dept', code: 'BETA_DEPT' },
    });

    const desigB = await prisma.designation.upsert({
      where: { tenantId_code: { tenantId: tenantBId, code: 'BETA_DESIG' } },
      update: {},
      create: { tenantId: tenantBId, title: 'Beta Engineer', code: 'BETA_DESIG' },
    });

    // Same employeeCode ALPHA-001 can exist in Tenant B without conflict due to composite unique constraint @@unique([tenantId, employeeCode])
    const betaEmp = await prisma.employee.upsert({
      where: { tenantId_employeeCode: { tenantId: tenantBId, employeeCode: 'ALPHA-001' } },
      update: {},
      create: {
        tenantId: tenantBId,
        employeeCode: 'ALPHA-001',
        firstName: 'Jane',
        lastName: 'Beta',
        workEmail: 'jane@beta.com',
        joiningDate: new Date(),
        legalEntityId: leB.id,
        branchLocationId: brB.id,
        departmentId: deptB.id,
        designationId: desigB.id,
        status: 'ACTIVE',
      },
    });

    expect(betaEmp).toBeDefined();
    expect(betaEmp.tenantId).toBe(tenantBId);
  });
});
