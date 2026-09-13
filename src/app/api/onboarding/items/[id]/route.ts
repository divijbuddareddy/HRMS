import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { updateOnboardingItemStatus } from '@/lib/onboarding/engine';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { status, evidenceUrl, notes } = body;

    const result = await updateOnboardingItemStatus({
      tenantId: user.tenantId,
      itemId: id,
      status: status || 'COMPLETED',
      evidenceUrl,
      notes,
      actor: user,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
