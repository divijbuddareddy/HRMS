import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { submitExpenseClaim } from '@/lib/expenses/engine';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const searchParams = req.nextUrl.searchParams;
    const view = searchParams.get('view'); // 'mine' or 'team'

    let where: any = { tenantId: user.tenantId };
    if (view === 'mine') {
      where.employeeId = user.employeeId;
    }

    const claims = await prisma.expenseClaim.findMany({
      where,
      include: {
        employee: true,
        category: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ claims });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const claim = await submitExpenseClaim({
      tenantId: user.tenantId,
      employeeId: user.employeeId || body.employeeId,
      expenseCategoryId: body.expenseCategoryId,
      claimDate: new Date(body.claimDate),
      amount: parseFloat(body.amount),
      description: body.description,
      receiptUrl: body.receiptUrl,
      costCenter: body.costCenter,
      paymentMethod: body.paymentMethod,
    });

    return NextResponse.json({ success: true, claim }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
