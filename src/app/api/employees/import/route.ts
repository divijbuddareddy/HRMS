import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hasPermission, PERMISSIONS } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';
import Papa from 'papaparse';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!hasPermission(user, PERMISSIONS.EMPLOYEE_IMPORT)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { csvContent } = await req.json();
    if (!csvContent) {
      return NextResponse.json({ error: 'CSV content is required' }, { status: 400 });
    }

    const parsed = Papa.parse(csvContent, { header: true, skipEmptyLines: true });
    const rows = parsed.data as Record<string, string>[];

    if (rows.length === 0) {
      return NextResponse.json({ error: 'No data rows found in CSV' }, { status: 400 });
    }

    // Cache lookup maps for tenant org entities
    const [entities, branches, departments, designations, structures] = await Promise.all([
      prisma.legalEntity.findMany({ where: { tenantId: user.tenantId } }),
      prisma.branchLocation.findMany({ where: { tenantId: user.tenantId } }),
      prisma.department.findMany({ where: { tenantId: user.tenantId } }),
      prisma.designation.findMany({ where: { tenantId: user.tenantId } }),
      prisma.salaryStructure.findMany({ where: { tenantId: user.tenantId } }),
    ]);

    const entityMap = new Map(entities.map((e) => [e.code.toUpperCase(), e.id]));
    const branchMap = new Map(branches.map((b) => [b.code.toUpperCase(), b.id]));
    const deptMap = new Map(departments.map((d) => [d.code.toUpperCase(), d.id]));
    const desigMap = new Map(designations.map((d) => [d.code.toUpperCase(), d.id]));
    const defaultStructure = structures.find((s) => s.isDefault) || structures[0];

    const errors: { row: number; email?: string; field?: string; message: string }[] = [];
    const successfulEmployees: any[] = [];
    const seenEmails = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2; // +1 for 0-index, +1 for header
      const row = rows[i];

      const firstName = row['firstName'] || row['First Name'] || row['firstname'];
      const lastName = row['lastName'] || row['Last Name'] || row['lastname'];
      const email = (row['workEmail'] || row['Work Email'] || row['email'])?.toLowerCase().trim();
      const entityCode = (row['legalEntityCode'] || row['Legal Entity'] || entities[0]?.code || '').toUpperCase();
      const branchCode = (row['branchCode'] || row['Branch'] || branches[0]?.code || '').toUpperCase();
      const deptCode = (row['departmentCode'] || row['Department'] || departments[0]?.code || '').toUpperCase();
      const desigCode = (row['designationCode'] || row['Designation'] || designations[0]?.code || '').toUpperCase();
      const annualCtc = parseFloat(row['annualCtc'] || row['CTC'] || '600000') || 600000;

      if (!firstName || !lastName || !email) {
        errors.push({ row: rowNum, email, message: 'First Name, Last Name and Work Email are required' });
        continue;
      }

      if (seenEmails.has(email)) {
        errors.push({ row: rowNum, email, field: 'workEmail', message: 'Duplicate work email in CSV file' });
        continue;
      }
      seenEmails.add(email);

      // Check existing in database
      const existingInDb = await prisma.employee.findUnique({
        where: {
          tenantId_workEmail: {
            tenantId: user.tenantId,
            workEmail: email,
          },
        },
      });

      if (existingInDb) {
        errors.push({ row: rowNum, email, field: 'workEmail', message: 'Employee with this email already exists in database' });
        continue;
      }

      const legalEntityId = entityMap.get(entityCode) || entities[0]?.id;
      const branchLocationId = branchMap.get(branchCode) || branches[0]?.id;
      const departmentId = deptMap.get(deptCode) || departments[0]?.id;
      const designationId = desigMap.get(desigCode) || designations[0]?.id;

      if (!legalEntityId || !branchLocationId || !departmentId || !designationId) {
        errors.push({ row: rowNum, email, message: 'Invalid organization code mapping (Legal Entity, Branch, Dept or Desig not found)' });
        continue;
      }

      // Generate sequence code
      const currentCount = (await prisma.employee.count({ where: { tenantId: user.tenantId } })) + successfulEmployees.length;
      const employeeCode = row['employeeCode'] || `EMP-${new Date().getFullYear()}-${String(currentCount + 1).padStart(4, '0')}`;

      try {
        const emp = await prisma.$transaction(async (tx) => {
          const createdEmp = await tx.employee.create({
            data: {
              tenantId: user.tenantId,
              employeeCode,
              firstName,
              lastName,
              displayName: `${firstName} ${lastName}`,
              workEmail: email,
              personalEmail: row['personalEmail'] || row['Personal Email'] || null,
              mobilePhone: row['mobilePhone'] || row['Phone'] || null,
              gender: row['gender'] || row['Gender'] || 'MALE',
              joiningDate: row['joiningDate'] ? new Date(row['joiningDate']) : new Date(),
              legalEntityId,
              branchLocationId,
              departmentId,
              designationId,
              status: 'ACTIVE',
            },
          });

          if (row['pan'] || row['aadhaar']) {
            await tx.employeeIdentity.create({
              data: {
                employeeId: createdEmp.id,
                panNumber: row['pan'] || null,
                aadhaarNumber: row['aadhaar'] || null,
              },
            });
          }

          if (row['bankAccount'] && row['bankName']) {
            await tx.employeeBank.create({
              data: {
                employeeId: createdEmp.id,
                accountHolderName: `${firstName} ${lastName}`,
                bankName: row['bankName'],
                accountNumber: row['bankAccount'],
                ifscCode: row['ifsc'] || '',
              },
            });
          }

          // Assign default salary structure if exists
          if (defaultStructure) {
            await tx.employeeSalaryAssignment.create({
              data: {
                tenantId: user.tenantId,
                employeeId: createdEmp.id,
                structureId: defaultStructure.id,
                ctc: annualCtc,
                grossSalary: annualCtc / 12,
                netSalary: (annualCtc / 12) * 0.85,
                effectiveFrom: new Date(),
                taxRegime: row['taxRegime'] === 'OLD_REGIME' ? 'OLD_REGIME' : 'NEW_REGIME',
                isCurrent: true,
              },
            });
          }

          return createdEmp;
        });

        successfulEmployees.push(emp);
      } catch (err: any) {
        errors.push({ row: rowNum, email, message: err.message || 'Database insert error' });
      }
    }

    await createAuditLog({
      tenantId: user.tenantId,
      actorId: user.userId,
      actorRole: user.roles[0],
      action: 'BULK_IMPORT_EMPLOYEES',
      entityType: 'EMPLOYEE',
      afterState: {
        totalRows: rows.length,
        importedCount: successfulEmployees.length,
        failedCount: errors.length,
      },
    });

    return NextResponse.json({
      success: true,
      totalProcessed: rows.length,
      importedCount: successfulEmployees.length,
      failedCount: errors.length,
      errors,
      employees: successfulEmployees,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
