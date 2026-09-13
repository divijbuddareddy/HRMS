import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hasPermission, PERMISSIONS } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const structures = await prisma.salaryStructure.findMany({
      where: { tenantId: user.tenantId },
      include: {
        components: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { assignments: true } },
      },
    });

    return NextResponse.json({ structures });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!hasPermission(user, PERMISSIONS.SALARY_MANAGE)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { name, code, description, isDefault, components } = body;

    if (!name || !code) {
      return NextResponse.json({ error: 'Structure name and code are required' }, { status: 400 });
    }

    const structure = await prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.salaryStructure.updateMany({
          where: { tenantId: user.tenantId },
          data: { isDefault: false },
        });
      }

      const created = await tx.salaryStructure.create({
        data: {
          tenantId: user.tenantId,
          name,
          code,
          description,
          isDefault: Boolean(isDefault),
        },
      });

      if (components && Array.isArray(components)) {
        for (let i = 0; i < components.length; i++) {
          const comp = components[i];
          await tx.salaryComponent.create({
            data: {
              structureId: created.id,
              name: comp.name,
              code: comp.code,
              componentType: comp.componentType || 'EARNING',
              calculationType: comp.calculationType || 'FORMULA',
              valueOrFormula: comp.valueOrFormula,
              isTaxable: comp.isTaxable ?? true,
              isPartOfCtc: comp.isPartOfCtc ?? true,
              isPartOfGross: comp.isPartOfGross ?? true,
              isStatutory: comp.isStatutory ?? false,
              sortOrder: i + 1,
            },
          });
        }
      }

      return created;
    });

    await createAuditLog({
      tenantId: user.tenantId,
      actorId: user.userId,
      actorRole: user.roles[0],
      action: 'CREATE_SALARY_STRUCTURE',
      entityType: 'SALARY_STRUCTURE',
      entityId: structure.id,
      afterState: structure,
    });

    return NextResponse.json(structure, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
