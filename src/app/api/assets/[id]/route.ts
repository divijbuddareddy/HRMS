import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const asset = await prisma.asset.findUnique({
      where: { id },
      include: {
        branchLocation: true,
        assignments: {
          include: { employee: true },
          orderBy: { assignedDate: 'desc' },
        },
      },
    });

    if (!asset || asset.tenantId !== user.tenantId) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    return NextResponse.json({ asset });
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

    // Admin only can edit asset data
    if (!isAdmin(user)) {
      return NextResponse.json(
        { error: 'Forbidden: Only administrators have permission to edit asset records.' },
        { status: 403 }
      );
    }

    const existing = await prisma.asset.findUnique({ where: { id } });
    if (!existing || existing.tenantId !== user.tenantId) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    const body = await req.json();
    const updated = await prisma.asset.update({
      where: { id },
      data: {
        assetName: body.assetName ?? existing.assetName,
        category: body.category ?? existing.category,
        serialNumber: body.serialNumber ?? existing.serialNumber,
        status: body.status ?? existing.status,
        purchaseCost: body.purchaseCost !== undefined ? parseFloat(body.purchaseCost) : existing.purchaseCost,
        branchLocationId: body.branchLocationId ?? existing.branchLocationId,
      },
    });

    await createAuditLog({
      tenantId: user.tenantId,
      actorId: user.userId,
      actorRole: user.roles[0],
      action: 'UPDATE_ASSET',
      entityType: 'ASSET',
      entityId: id,
      beforeState: existing,
      afterState: updated,
    });

    return NextResponse.json({ success: true, asset: updated });
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

    // Admin only can delete asset data
    if (!isAdmin(user)) {
      return NextResponse.json(
        { error: 'Forbidden: Only administrators have permission to delete asset records.' },
        { status: 403 }
      );
    }

    const existing = await prisma.asset.findUnique({ where: { id } });
    if (!existing || existing.tenantId !== user.tenantId) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    await prisma.asset.delete({ where: { id } });

    await createAuditLog({
      tenantId: user.tenantId,
      actorId: user.userId,
      actorRole: user.roles[0],
      action: 'DELETE_ASSET',
      entityType: 'ASSET',
      entityId: id,
      beforeState: existing,
    });

    return NextResponse.json({
      success: true,
      message: `Asset ${existing.assetTag} (${existing.assetName}) deleted successfully.`,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
