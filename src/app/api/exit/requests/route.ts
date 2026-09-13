import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { submitExitRequest } from '@/lib/exit/engine';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const exits = await prisma.exitRequest.findMany({
      where: { tenantId: user.tenantId },
      include: {
        employee: {
          include: {
            department: true,
            designation: true,
          },
        },
        settlement: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ exits });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const exitReq = await submitExitRequest({
      tenantId: user.tenantId,
      employeeId: user.employeeId || body.employeeId,
      requestedLwd: new Date(body.requestedLwd),
      reason: body.reason,
      reasonCategory: body.reasonCategory,
    });

    return NextResponse.json({ success: true, exitRequest: exitReq }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
