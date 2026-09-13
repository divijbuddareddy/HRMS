import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { signEmployeeDocument } from '@/lib/documents/engine';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { signatureDataUrl } = body;

    const signerId = user.employeeId || id;
    const clientIp = req.headers.get('x-forwarded-for') || '127.0.0.1';

    const signedDoc = await signEmployeeDocument({
      tenantId: user.tenantId,
      documentId: id,
      signerEmployeeId: signerId,
      signatureDataUrl: signatureDataUrl || 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMzAiPjx0ZXh0IHk9IjIwIiBmb250LWZhbWlseT0iY3Vyc2l2ZSI+U2lnbmVkPC90ZXh0Pjwvc3ZnPg==',
      ipAddress: clientIp,
      actor: user,
    });

    return NextResponse.json({ success: true, document: signedDoc });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
