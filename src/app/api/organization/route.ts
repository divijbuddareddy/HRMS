import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hasPermission, isAdmin, PERMISSIONS } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const [legalEntities, branchLocations, departments, designations, grades] = await Promise.all([
      prisma.legalEntity.findMany({ where: { tenantId: user.tenantId } }),
      prisma.branchLocation.findMany({ where: { tenantId: user.tenantId } }),
      prisma.department.findMany({ where: { tenantId: user.tenantId } }),
      prisma.designation.findMany({ where: { tenantId: user.tenantId }, include: { department: true } }),
      prisma.grade.findMany({ where: { tenantId: user.tenantId } }),
    ]);

    return NextResponse.json({
      legalEntities,
      branchLocations,
      departments,
      designations,
      grades,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!isAdmin(user) && !hasPermission(user, PERMISSIONS.ORGANIZATION_MANAGE)) {
      return NextResponse.json(
        { error: 'Forbidden: Only administrators have permission to modify organization structure.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { type, data } = body;

    let result: any;
    if (type === 'DEPARTMENT') {
      result = await prisma.department.create({
        data: {
          tenantId: user.tenantId,
          name: data.name,
          code: data.code,
          parentDepartmentId: data.parentDepartmentId || null,
        },
      });
    } else if (type === 'DESIGNATION') {
      result = await prisma.designation.create({
        data: {
          tenantId: user.tenantId,
          title: data.title,
          code: data.code,
          departmentId: data.departmentId || null,
        },
      });
    } else if (type === 'BRANCH') {
      result = await prisma.branchLocation.create({
        data: {
          tenantId: user.tenantId,
          legalEntityId: data.legalEntityId,
          name: data.name,
          code: data.code,
          city: data.city,
          state: data.state,
          country: data.country || 'India',
          latitude: data.latitude ? parseFloat(data.latitude) : null,
          longitude: data.longitude ? parseFloat(data.longitude) : null,
          geofenceRadiusMeters: data.geofenceRadiusMeters ? parseInt(data.geofenceRadiusMeters) : 200,
        },
      });
    } else {
      return NextResponse.json({ error: 'Invalid organization entity type' }, { status: 400 });
    }

    await createAuditLog({
      tenantId: user.tenantId,
      actorId: user.userId,
      actorRole: user.roles[0],
      action: `CREATE_${type}`,
      entityType: type,
      entityId: result.id,
      afterState: result,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
