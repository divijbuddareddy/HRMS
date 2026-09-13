import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
      include: {
        tenant: true,
        employee: {
          include: {
            legalEntity: true,
            branchLocation: true,
            department: true,
            designation: true,
            reportingManager: true,
          },
        },
      },
    });

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      user: {
        id: dbUser.id,
        email: dbUser.email,
        tenantId: dbUser.tenantId,
        tenantName: dbUser.tenant.name,
        tenantSlug: dbUser.tenant.slug,
        roles: user.roles,
        permissions: user.permissions,
        employee: dbUser.employee,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
