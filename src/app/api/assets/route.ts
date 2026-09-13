import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createAsset } from '@/lib/assets/engine';
import { isAdmin } from '@/lib/rbac';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const assets = await prisma.asset.findMany({
      where: { tenantId: user.tenantId },
      include: {
        branchLocation: true,
        assignments: {
          include: { employee: true },
          orderBy: { assignedDate: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ assets });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Only administrators have permission to add asset inventory
    if (!isAdmin(user)) {
      return NextResponse.json(
        { error: 'Forbidden: Only administrators have permission to add asset inventory.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const asset = await createAsset({
      tenantId: user.tenantId,
      assetName: body.assetName,
      assetTag: body.assetTag,
      serialNumber: body.serialNumber,
      category: body.category || 'LAPTOP',
      purchaseCost: body.purchaseCost ? parseFloat(body.purchaseCost) : undefined,
      branchLocationId: body.branchLocationId,
      actor: user,
    });

    return NextResponse.json({ success: true, asset }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
