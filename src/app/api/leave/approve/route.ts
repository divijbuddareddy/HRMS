import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { processLeaveApproval } from '@/lib/leave/engine';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { leaveRequestId, decision, notes } = body;

    if (!leaveRequestId || !['APPROVED', 'REJECTED'].includes(decision)) {
      return NextResponse.json({ error: 'leaveRequestId and decision (APPROVED/REJECTED) are required' }, { status: 400 });
    }

    const updated = await processLeaveApproval({
      tenantId: user.tenantId,
      leaveRequestId,
      actor: user,
      decision,
      notes,
    });

    return NextResponse.json({ success: true, leaveRequest: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
