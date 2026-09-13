import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { calculateFullAndFinalSettlement } from '@/lib/exit/engine';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const settlement = await calculateFullAndFinalSettlement({
      tenantId: user.tenantId,
      exitRequestId: id,
      actor: user,
    });

    return NextResponse.json({ success: true, settlement });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
