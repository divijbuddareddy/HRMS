import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hasPermission, getUserDataScope, sanitizeEmployeeForUser, PERMISSIONS } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';

// Generate Tenant-Unique Employee ID based on pattern
async function generateNextEmployeeCode(tenantId: string, prefix = 'EMP'): Promise<string> {
  const currentYear = new Date().getFullYear();
  const count = await prisma.employee.count({ where: { tenantId } });
  const sequence = String(count + 1).padStart(4, '0');
  return `${prefix}-${currentYear}-${sequence}`;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!hasPermission(user, PERMISSIONS.EMPLOYEE_READ)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const scope = getUserDataScope(user, PERMISSIONS.EMPLOYEE_READ);

    // Build data scope filter
    const where: any = { tenantId: user.tenantId };
    if (scope === 'OWN') {
      where.id = user.employeeId || 'none';
    } else if (scope === 'DIRECT_REPORTS') {
      where.OR = [
        { id: user.employeeId || 'none' },
        { reportingManagerId: user.employeeId || 'none' },
      ];
    } else if (scope === 'DEPARTMENT') {
      if (user.departmentId) where.departmentId = user.departmentId;
    } else if (scope === 'BRANCH_LOCATION') {
      if (user.branchLocationId) where.branchLocationId = user.branchLocationId;
    } else if (scope === 'LEGAL_ENTITY') {
      if (user.legalEntityId) where.legalEntityId = user.legalEntityId;
    }

    const employees = await prisma.employee.findMany({
      where,
      include: {
        legalEntity: true,
        branchLocation: true,
        department: true,
        designation: true,
        grade: true,
        reportingManager: {
          select: { id: true, firstName: true, lastName: true, employeeCode: true },
        },
        identity: true,
        bank: true,
        salaryAssignments: { where: { isCurrent: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const sanitized = employees.map((emp) => sanitizeEmployeeForUser(emp, user));

    return NextResponse.json({ employees: sanitized });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!hasPermission(user, PERMISSIONS.EMPLOYEE_WRITE)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const {
      firstName,
      middleName,
      lastName,
      workEmail,
      personalEmail,
      mobilePhone,
      gender,
      dob,
      joiningDate,
      legalEntityId,
      branchLocationId,
      departmentId,
      designationId,
      gradeId,
      reportingManagerId,
      panNumber,
      aadhaarNumber,
      bankAccountHolder,
      bankName,
      bankAccountNumber,
      bankIfsc,
    } = body;

    if (!firstName || !lastName || !workEmail || !legalEntityId || !branchLocationId || !departmentId || !designationId) {
      return NextResponse.json({ error: 'Missing required employee fields' }, { status: 400 });
    }

    // Check duplicate workEmail
    const existing = await prisma.employee.findUnique({
      where: {
        tenantId_workEmail: {
          tenantId: user.tenantId,
          workEmail: workEmail.toLowerCase().trim(),
        },
      },
    });

    if (existing) {
      return NextResponse.json({ error: 'Employee with this work email already exists in this tenant' }, { status: 409 });
    }

    const employeeCode = body.employeeCode || (await generateNextEmployeeCode(user.tenantId));

    const employee = await prisma.$transaction(async (tx) => {
      const created = await tx.employee.create({
        data: {
          tenantId: user.tenantId,
          employeeCode,
          firstName,
          middleName,
          lastName,
          displayName: `${firstName} ${lastName}`,
          gender,
          dob: dob ? new Date(dob) : null,
          workEmail: workEmail.toLowerCase().trim(),
          personalEmail,
          mobilePhone,
          joiningDate: joiningDate ? new Date(joiningDate) : new Date(),
          legalEntityId,
          branchLocationId,
          departmentId,
          designationId,
          gradeId: gradeId || null,
          reportingManagerId: reportingManagerId || null,
          status: 'ACTIVE',
        },
      });

      if (panNumber || aadhaarNumber) {
        await tx.employeeIdentity.create({
          data: {
            employeeId: created.id,
            panNumber,
            aadhaarNumber,
          },
        });
      }

      if (bankAccountNumber && bankName) {
        await tx.employeeBank.create({
          data: {
            employeeId: created.id,
            accountHolderName: bankAccountHolder || `${firstName} ${lastName}`,
            bankName,
            accountNumber: bankAccountNumber,
            ifscCode: bankIfsc || '',
          },
        });
      }

      return created;
    });

    await createAuditLog({
      tenantId: user.tenantId,
      actorId: user.userId,
      actorRole: user.roles[0],
      action: 'CREATE_EMPLOYEE',
      entityType: 'EMPLOYEE',
      entityId: employee.id,
      afterState: { id: employee.id, code: employee.employeeCode, email: employee.workEmail },
    });

    return NextResponse.json(employee, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
