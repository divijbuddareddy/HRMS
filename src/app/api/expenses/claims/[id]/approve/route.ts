import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { processExpenseClaimApproval } from '@/lib/expenses/engine';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { stage, decision, notes } = body;

    const result = await processExpenseClaimApproval({
      tenantId: user.tenantId,
      claimId: id,
      stage: stage || 'MANAGER',
      decision: decision || 'APPROVED',
      notes,
      actor: user,
    });

    return NextResponse.json({ success: true, claim: result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
