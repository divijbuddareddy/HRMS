import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateEmployeeDocument } from '@/lib/documents/engine';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const searchParams = req.nextUrl.searchParams;
    const employeeId = searchParams.get('employeeId');

    const documents = await prisma.employeeDocument.findMany({
      where: {
        tenantId: user.tenantId,
        ...(employeeId ? { employeeId } : {}),
      },
      include: {
        employee: true,
        signature: { include: { signer: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ documents });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { employeeId, templateCode, customData } = body;

    const document = await generateEmployeeDocument({
      tenantId: user.tenantId,
      employeeId,
      templateCode: templateCode || 'OFFER_LETTER',
      customData,
      actor: user,
    });

    return NextResponse.json({ success: true, document }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
