import { describe, it, expect, beforeAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { generateDocumentFromTemplate, computeDocumentSha256 } from '../src/lib/documents/engine';

const prisma = new PrismaClient();

describe('Document Generation & Digital E-Signature Engine', () => {
  let tenantId: string;
  let employeeId: string;
  let templateId: string;

  beforeAll(async () => {
    const tenant = await prisma.tenant.findFirst({ where: { slug: 'ai-automation-labs' } });
    tenantId = tenant!.id;
    const emp = await prisma.employee.findFirst({ where: { tenantId, employeeCode: 'EMP-2026-0005' } });
    employeeId = emp!.id;
    const tmpl = await prisma.documentTemplate.findFirst({ where: { tenantId, code: 'OFFER_LETTER_STANDARD' } });
    templateId = tmpl!.id;
  });

  it('should interpolate template merge tags accurately', () => {
    const templateHtml = '<h1>Offer for {{candidate.first_name}}</h1><p>Company: {{company.name}}</p><p>CTC: INR {{salary.ctc_inr}}</p>';
    const mergeData = {
      'candidate.first_name': 'Kavita',
      'company.name': 'AI Automation Labs',
      'salary.ctc_inr': '36,00,000',
    };

    const rendered = generateDocumentFromTemplate(templateHtml, mergeData);
    expect(rendered).toBe('<h1>Offer for Kavita</h1><p>Company: AI Automation Labs</p><p>CTC: INR 36,00,000</p>');
    expect(rendered).not.toContain('{{');
  });

  it('should compute cryptographic SHA-256 checksum for document immutability', () => {
    const docHtml = '<p>Legal contract agreement text</p>';
    const hash1 = computeDocumentSha256(docHtml);
    const hash2 = computeDocumentSha256(docHtml);
    const alteredHash = computeDocumentSha256(docHtml + ' altered');

    expect(hash1).toHaveLength(64);
    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(alteredHash);
  });

  it('should record digital signature and lock employee document', async () => {
    const docHtml = '<p>Official Employment Agreement for Priya Sharma</p>';
    const checksum = computeDocumentSha256(docHtml);

    const doc = await prisma.employeeDocument.create({
      data: {
        tenantId,
        employeeId,
        documentTemplateId: templateId,
        title: 'Executive Employment Offer',
        contentHtml: docHtml,
        checksumSha256: checksum,
        status: 'SENT_FOR_SIGNATURE',
      },
    });

    const signature = await prisma.documentSignature.create({
      data: {
        employeeDocumentId: doc.id,
        signerId: employeeId,
        signerIpAddress: '192.168.1.100',
        signatureDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA...',
        signatureHash: computeDocumentSha256('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA...'),
      },
    });

    const updatedDoc = await prisma.employeeDocument.update({
      where: { id: doc.id },
      data: { status: 'SIGNED', signedAt: new Date() },
      include: { signature: true },
    });

    expect(updatedDoc.status).toBe('SIGNED');
    expect(updatedDoc.signature?.signerId).toBe(employeeId);
    expect(updatedDoc.checksumSha256).toBe(checksum);
  });
});
