import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hasPermission, sanitizeEmployeeForUser, isAdmin, PERMISSIONS } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        legalEntity: true,
        branchLocation: true,
        department: true,
        designation: true,
        grade: true,
        reportingManager: true,
        identity: true,
        bank: true,
        emergencyContacts: true,
        salaryAssignments: {
          where: { isCurrent: true },
          include: { structure: { include: { components: true } } },
        },
      },
    });

    if (!employee || employee.tenantId !== user.tenantId) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    const sanitized = sanitizeEmployeeForUser(employee, user);
    return NextResponse.json(sanitized);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Only administrators have access to edit employee data
    if (!isAdmin(user)) {
      return NextResponse.json(
        { error: 'Forbidden: Only administrators have access to edit employee records.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const existing = await prisma.employee.findUnique({
      where: { id },
      include: { identity: true, bank: true },
    });

    if (!existing || existing.tenantId !== user.tenantId) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const emp = await tx.employee.update({
        where: { id },
        data: {
          firstName: body.firstName ?? existing.firstName,
          lastName: body.lastName ?? existing.lastName,
          displayName: body.firstName && body.lastName ? `${body.firstName} ${body.lastName}` : existing.displayName,
          mobilePhone: body.mobilePhone ?? existing.mobilePhone,
          personalEmail: body.personalEmail ?? existing.personalEmail,
          departmentId: body.departmentId ?? existing.departmentId,
          designationId: body.designationId ?? existing.designationId,
          branchLocationId: body.branchLocationId ?? existing.branchLocationId,
          reportingManagerId: body.reportingManagerId !== undefined ? body.reportingManagerId : existing.reportingManagerId,
          status: body.status ?? existing.status,
        },
      });

      if (body.panNumber || body.aadhaarNumber) {
        await tx.employeeIdentity.upsert({
          where: { employeeId: id },
          update: {
            panNumber: body.panNumber ?? existing.identity?.panNumber,
            aadhaarNumber: body.aadhaarNumber ?? existing.identity?.aadhaarNumber,
          },
          create: {
            employeeId: id,
            panNumber: body.panNumber,
            aadhaarNumber: body.aadhaarNumber,
          },
        });
      }

      if (body.bankAccountNumber && body.bankName) {
        await tx.employeeBank.upsert({
          where: { employeeId: id },
          update: {
            bankName: body.bankName,
            accountNumber: body.bankAccountNumber,
            ifscCode: body.bankIfsc || existing.bank?.ifscCode || '',
          },
          create: {
            employeeId: id,
            accountHolderName: `${emp.firstName} ${emp.lastName}`,
            bankName: body.bankName,
            accountNumber: body.bankAccountNumber,
            ifscCode: body.bankIfsc || '',
          },
        });
      }

      return emp;
    });

    await createAuditLog({
      tenantId: user.tenantId,
      actorId: user.userId,
      actorRole: user.roles[0],
      action: 'UPDATE_EMPLOYEE',
      entityType: 'EMPLOYEE',
      entityId: id,
      beforeState: existing,
      afterState: updated,
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Only administrators have access to delete employee records
    if (!isAdmin(user)) {
      return NextResponse.json(
        { error: 'Forbidden: Only administrators have access to delete employee records.' },
        { status: 403 }
      );
    }

    const existing = await prisma.employee.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!existing || existing.tenantId !== user.tenantId) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    await prisma.employee.delete({
      where: { id },
    });

    await createAuditLog({
      tenantId: user.tenantId,
      actorId: user.userId,
      actorRole: user.roles[0],
      action: 'DELETE_EMPLOYEE',
      entityType: 'EMPLOYEE',
      entityId: id,
      beforeState: existing,
    });

    return NextResponse.json({
      success: true,
      message: `Employee ${existing.firstName} ${existing.lastName} (${existing.employeeCode}) deleted successfully.`,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
