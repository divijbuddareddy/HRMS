import crypto from 'crypto';
import { prisma } from '../prisma';
import { AuthUser } from '../types';
import { createAuditLog } from '../audit';
import { format } from 'date-fns';

export function interpolateMergeTags(templateHtml: string, context: Record<string, any>): string {
  let result = templateHtml;
  for (const [key, value] of Object.entries(context)) {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
    result = result.replace(regex, String(value ?? ''));
  }
  return result;
}

export function computeDocumentSha256(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

export const generateDocumentFromTemplate = (template: string, data: Record<string, any>) =>
  interpolateMergeTags(template, data);

export async function generateEmployeeDocument(params: {
  tenantId: string;
  employeeId: string;
  templateCode: string;
  customData?: Record<string, any>;
  actor: AuthUser;
}) {
  const employee = await prisma.employee.findUnique({
    where: { id: params.employeeId },
    include: {
      legalEntity: true,
      branchLocation: true,
      department: true,
      designation: true,
      salaryAssignments: { where: { isCurrent: true } },
    },
  });

  if (!employee) throw new Error('Employee not found');

  let template = await prisma.documentTemplate.findFirst({
    where: {
      tenantId: params.tenantId,
      code: params.templateCode,
      isActive: true,
    },
    orderBy: { version: 'desc' },
  });

  if (!template) {
    // Create default offer/appointment template
    template = await prisma.documentTemplate.create({
      data: {
        tenantId: params.tenantId,
        title: 'Employment Offer & Appointment Letter',
        code: params.templateCode,
        contentHtml: `
          <h1>AI AUTOMATION LABS LLP</h1>
          <h3>APPOINTMENT LETTER</h3>
          <p>Dear <strong>{{employee.name}}</strong>,</p>
          <p>We are pleased to appoint you as <strong>{{designation}}</strong> in the <strong>{{department}}</strong> department at AI Automation Labs LLP, located at {{branch.city}}.</p>
          <p>Your Annual Cost to Company (CTC) will be <strong>INR {{salary.ctc}}</strong> per annum. Your joining date is <strong>{{joiningDate}}</strong>.</p>
          <p>Please sign this document electronically to confirm your acceptance.</p>
        `,
        version: 1,
      },
    });
  }

  const currentCtc = employee.salaryAssignments[0]?.ctc || 1200000;
  const context = {
    'employee.name': employee.displayName,
    'employee.code': employee.employeeCode,
    'employee.email': employee.workEmail,
    'designation': employee.designation?.title || 'Engineer',
    'department': employee.department?.name || 'Engineering',
    'branch.city': employee.branchLocation?.city || 'Bengaluru',
    'company.name': employee.legalEntity?.name || 'AI Automation Labs LLP',
    'salary.ctc': currentCtc.toLocaleString('en-IN'),
    'joiningDate': format(new Date(employee.joiningDate), 'dd MMMM yyyy'),
    ...(params.customData || {}),
  };

  const contentHtml = interpolateMergeTags(template.contentHtml, context);
  const checksum = crypto.createHash('sha256').update(contentHtml).digest('hex');

  const doc = await prisma.employeeDocument.create({
    data: {
      tenantId: params.tenantId,
      employeeId: params.employeeId,
      documentTemplateId: template.id,
      title: `${template.title} — ${employee.displayName}`,
      contentHtml,
      checksumSha256: checksum,
      status: 'SENT_FOR_SIGNATURE',
    },
  });

  await createAuditLog({
    tenantId: params.tenantId,
    actorId: params.actor.userId,
    actorRole: params.actor.roles[0],
    action: 'GENERATE_DOCUMENT',
    entityType: 'DOCUMENT',
    entityId: doc.id,
    afterState: { id: doc.id, title: doc.title, checksum },
  });

  return doc;
}

export async function signEmployeeDocument(params: {
  tenantId: string;
  documentId: string;
  signerEmployeeId: string;
  signatureDataUrl: string;
  ipAddress?: string;
  actor: AuthUser;
}) {
  const doc = await prisma.employeeDocument.findUnique({
    where: { id: params.documentId },
  });

  if (!doc) throw new Error('Document not found');
  if (doc.status === 'SIGNED') throw new Error('Document is already signed');

  const signatureHash = crypto
    .createHash('sha256')
    .update(`${doc.checksumSha256}:${params.signerEmployeeId}:${Date.now()}`)
    .digest('hex');

  const signed = await prisma.$transaction(async (tx) => {
    await tx.documentSignature.create({
      data: {
        employeeDocumentId: doc.id,
        signerId: params.signerEmployeeId,
        signerIpAddress: params.ipAddress || '127.0.0.1',
        signatureDataUrl: params.signatureDataUrl,
        signatureHash,
      },
    });

    return tx.employeeDocument.update({
      where: { id: doc.id },
      data: {
        status: 'SIGNED',
        signedAt: new Date(),
      },
      include: { signature: true },
    });
  });

  await createAuditLog({
    tenantId: params.tenantId,
    actorId: params.actor.userId,
    actorRole: params.actor.roles[0] || 'SIGNER',
    action: 'DIGITALLY_SIGN_DOCUMENT',
    entityType: 'DOCUMENT',
    entityId: doc.id,
    afterState: { status: 'SIGNED', signatureHash, signerId: params.signerEmployeeId },
  });

  return signed;
}
