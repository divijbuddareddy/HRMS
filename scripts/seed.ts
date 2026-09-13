import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { addDays, subDays, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend } from 'date-fns';
import { DEFAULT_STATUTORY_CONFIG } from '../src/lib/payroll/engine';

const prisma = new PrismaClient();

export async function seedDatabase() {
  console.log('🌱 Starting comprehensive AI Automation Labs HRMS seed...');

  const passwordHash = await bcrypt.hash('Password@123', 10);

  // 1. Create or update AI Automation Labs Tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'ai-automation-labs' },
    update: {
      name: 'AI Automation Labs LLP',
      status: 'ACTIVE',
      plan: 'ENTERPRISE',
    },
    create: {
      name: 'AI Automation Labs LLP',
      slug: 'ai-automation-labs',
      domain: 'aiautomationlabs.com',
      status: 'ACTIVE',
      plan: 'ENTERPRISE',
      settings: JSON.stringify({
        primaryColor: '#16a34a',
        currency: 'INR',
        country: 'India',
        timezone: 'Asia/Kolkata',
      }),
    },
  });

  console.log(`✓ Tenant ready: ${tenant.name} (${tenant.id})`);

  // 2. Legal Entity
  const legalEntity = await prisma.legalEntity.upsert({
    where: {
      tenantId_code: { tenantId: tenant.id, code: 'AIAL_IN' },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'AI Automation Labs LLP',
      code: 'AIAL_IN',
      pan: 'AAACA1234F',
      gstin: '29AAACA1234F1Z5',
      cin: 'AAI-9988',
      registeredAddress: '100 Feet Road, Indiranagar, Bengaluru, Karnataka 560038',
      currency: 'INR',
    },
  });

  // 3. Branch Locations
  const blrBranch = await prisma.branchLocation.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'BLR_HQ' } },
    update: {},
    create: {
      tenantId: tenant.id,
      legalEntityId: legalEntity.id,
      name: 'Bengaluru Headquarters',
      code: 'BLR_HQ',
      city: 'Bengaluru',
      state: 'KARNATAKA',
      pincode: '560038',
      latitude: 12.9716,
      longitude: 77.5946,
      geofenceRadiusMeters: 500,
    },
  });

  const mumBranch = await prisma.branchLocation.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'MUM_OFFICE' } },
    update: {},
    create: {
      tenantId: tenant.id,
      legalEntityId: legalEntity.id,
      name: 'Mumbai Tech Hub',
      code: 'MUM_OFFICE',
      city: 'Mumbai',
      state: 'MAHARASHTRA',
      pincode: '400051',
      latitude: 19.0760,
      longitude: 72.8777,
      geofenceRadiusMeters: 500,
    },
  });

  // 4. Departments
  const deptEng = await prisma.department.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'ENG' } },
    update: {},
    create: { tenantId: tenant.id, name: 'Engineering', code: 'ENG' },
  });

  const deptHR = await prisma.department.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'HR' } },
    update: {},
    create: { tenantId: tenant.id, name: 'Human Resources', code: 'HR' },
  });

  const deptFin = await prisma.department.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'FIN' } },
    update: {},
    create: { tenantId: tenant.id, name: 'Finance & Operations', code: 'FIN' },
  });

  const deptProd = await prisma.department.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'PROD' } },
    update: {},
    create: { tenantId: tenant.id, name: 'Product & Design', code: 'PROD' },
  });

  // 5. Designations
  const desigArch = await prisma.designation.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'LEAD_ARCH' } },
    update: {},
    create: { tenantId: tenant.id, title: 'Lead Architect & Engineering Manager', code: 'LEAD_ARCH', departmentId: deptEng.id },
  });

  const desigSrDev = await prisma.designation.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'SR_DEV' } },
    update: {},
    create: { tenantId: tenant.id, title: 'Senior Fullstack Engineer', code: 'SR_DEV', departmentId: deptEng.id },
  });

  const desigHRAdmin = await prisma.designation.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'HR_LEAD' } },
    update: {},
    create: { tenantId: tenant.id, title: 'HR Lead & People Partner', code: 'HR_LEAD', departmentId: deptHR.id },
  });

  const desigFinance = await prisma.designation.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'FIN_LEAD' } },
    update: {},
    create: { tenantId: tenant.id, title: 'Finance Lead', code: 'FIN_LEAD', departmentId: deptFin.id },
  });

  // 6. Roles & Granular Permissions
  const roleNames = [
    'PLATFORM_SUPER_ADMIN',
    'COMPANY_ADMIN',
    'HR_ADMIN',
    'HR_EXECUTIVE',
    'FINANCE',
    'MANAGER',
    'EMPLOYEE',
  ];

  const roleMap = new Map<string, any>();
  for (const r of roleNames) {
    const role = await prisma.role.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: r } },
      update: {},
      create: {
        tenantId: tenant.id,
        name: r,
        description: `System ${r} Role`,
        isSystem: true,
      },
    });
    roleMap.set(r, role);
  }

  // 7. Standard Indian Statutory Rules
  await prisma.statutoryRuleSet.upsert({
    where: {
      tenantId_ruleFamily_jurisdiction_version: {
        tenantId: tenant.id,
        ruleFamily: 'EPF',
        jurisdiction: 'INDIA',
        version: 1,
      },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      ruleFamily: 'EPF',
      jurisdiction: 'INDIA',
      effectiveFrom: new Date('2026-04-01'),
      rulesConfig: JSON.stringify(DEFAULT_STATUTORY_CONFIG.epf),
      version: 1,
      isActive: true,
      approvedBy: 'SYSTEM_ADMIN',
      approvedAt: new Date(),
    },
  });

  await prisma.statutoryRuleSet.upsert({
    where: {
      tenantId_ruleFamily_jurisdiction_version: {
        tenantId: tenant.id,
        ruleFamily: 'PROFESSIONAL_TAX',
        jurisdiction: 'KARNATAKA',
        version: 1,
      },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      ruleFamily: 'PROFESSIONAL_TAX',
      jurisdiction: 'KARNATAKA',
      effectiveFrom: new Date('2026-04-01'),
      rulesConfig: JSON.stringify(DEFAULT_STATUTORY_CONFIG.pt),
      version: 1,
      isActive: true,
      approvedBy: 'SYSTEM_ADMIN',
      approvedAt: new Date(),
    },
  });

  // 8. Standard Shift
  const standardShift = await prisma.shiftPolicy.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'STD_0930_1830' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Standard General Shift (09:30 - 18:30)',
      code: 'STD_0930_1830',
      startTime: '09:30',
      endTime: '18:30',
      graceMinutes: 15,
      halfDayMinutes: 240,
      fullDayMinutes: 480,
      isDefault: true,
    },
  });

  // 9. Leave Types & Policies
  const leaveConfigs = [
    { name: 'Casual Leave', code: 'CL', isPaid: true, color: '#3b82f6', quota: 12, maxNeg: 0, sandwich: false },
    { name: 'Sick Leave', code: 'SL', isPaid: true, color: '#ef4444', quota: 12, maxNeg: 2, sandwich: false },
    { name: 'Earned Leave', code: 'EL', isPaid: true, color: '#10b981', quota: 18, maxNeg: 0, sandwich: true },
    { name: 'Loss of Pay', code: 'LOP', isPaid: false, color: '#6b7280', quota: 0, maxNeg: 99, sandwich: false },
  ];

  const leaveTypeMap = new Map<string, any>();
  for (const lc of leaveConfigs) {
    const lt = await prisma.leaveType.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: lc.code } },
      update: {},
      create: {
        tenantId: tenant.id,
        name: lc.name,
        code: lc.code,
        isPaid: lc.isPaid,
        color: lc.color,
      },
    });

    await prisma.leavePolicy.upsert({
      where: { leaveTypeId: lt.id },
      update: {},
      create: {
        tenantId: tenant.id,
        leaveTypeId: lt.id,
        annualQuota: lc.quota,
        accrualRate: lc.quota / 12,
        accrualFrequency: 'MONTHLY',
        maxCarryForward: 45,
        maxNegativeBalance: lc.maxNeg,
        allowHalfDay: true,
        isSandwichRuleEnabled: lc.sandwich,
      },
    });

    leaveTypeMap.set(lc.code, lt);
  }

  // 10. Standard Salary Structure
  const salaryStructure = await prisma.salaryStructure.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'STD_TECH_CTC' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Standard Tech CTC Structure',
      code: 'STD_TECH_CTC',
      description: 'Standard 50% Basic, 40% HRA, Special Allowance, EPF, ESI, PT',
      isDefault: true,
      isActive: true,
      components: {
        create: [
          { name: 'Basic Salary', code: 'BASIC', componentType: 'EARNING', calculationType: 'FORMULA', valueOrFormula: '0.50 * CTC', sortOrder: 1 },
          { name: 'House Rent Allowance', code: 'HRA', componentType: 'EARNING', calculationType: 'FORMULA', valueOrFormula: '0.40 * BASIC', sortOrder: 2 },
          { name: 'Special Allowance', code: 'SPECIAL_ALLOWANCE', componentType: 'EARNING', calculationType: 'FORMULA', valueOrFormula: 'CTC - BASIC - HRA', sortOrder: 3 },
          { name: 'Provident Fund (Employee)', code: 'PF_EE', componentType: 'STATUTORY', calculationType: 'FORMULA', valueOrFormula: '0.12 * BASIC', isStatutory: true, sortOrder: 4 },
          { name: 'Professional Tax', code: 'PT', componentType: 'STATUTORY', calculationType: 'FLAT', valueOrFormula: '200', isStatutory: true, sortOrder: 5 },
          { name: 'Provident Fund (Employer)', code: 'PF_ER', componentType: 'EMPLOYER_CONTRIBUTION', calculationType: 'FORMULA', valueOrFormula: '0.12 * BASIC', isStatutory: true, sortOrder: 6 },
        ],
      },
    },
  });

  // 11. Helper to create user + employee
  async function createPerson(data: {
    email: string;
    firstName: string;
    lastName: string;
    roleName: string;
    code: string;
    departmentId: string;
    designationId: string;
    ctc: number;
    phone: string;
    pan: string;
    aadhaar: string;
    bankAcc: string;
    reportingManagerId?: string;
  }) {
    const user = await prisma.user.upsert({
      where: { tenantId_email: { tenantId: tenant.id, email: data.email } },
      update: { passwordHash, status: 'ACTIVE' },
      create: {
        tenantId: tenant.id,
        email: data.email,
        phone: data.phone,
        passwordHash,
        status: 'ACTIVE',
      },
    });

    const role = roleMap.get(data.roleName);
    if (role) {
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: user.id, roleId: role.id } },
        update: {},
        create: { userId: user.id, roleId: role.id },
      });
    }

    const employee = await prisma.employee.upsert({
      where: { tenantId_workEmail: { tenantId: tenant.id, workEmail: data.email } },
      update: {
        reportingManagerId: data.reportingManagerId,
      },
      create: {
        tenantId: tenant.id,
        userId: user.id,
        employeeCode: data.code,
        firstName: data.firstName,
        lastName: data.lastName,
        displayName: `${data.firstName} ${data.lastName}`,
        workEmail: data.email,
        personalEmail: `${data.firstName.toLowerCase()}.${data.lastName.toLowerCase()}@personal.com`,
        mobilePhone: data.phone,
        joiningDate: new Date('2025-01-15'),
        legalEntityId: legalEntity.id,
        branchLocationId: blrBranch.id,
        departmentId: data.departmentId,
        designationId: data.designationId,
        reportingManagerId: data.reportingManagerId || null,
        status: 'ACTIVE',
      },
    });

    await prisma.employeeIdentity.upsert({
      where: { employeeId: employee.id },
      update: {},
      create: {
        employeeId: employee.id,
        panNumber: data.pan,
        aadhaarNumber: data.aadhaar,
        uanNumber: '100988776655',
      },
    });

    await prisma.employeeBank.upsert({
      where: { employeeId: employee.id },
      update: {},
      create: {
        employeeId: employee.id,
        accountHolderName: `${data.firstName} ${data.lastName}`,
        bankName: 'HDFC Bank',
        accountNumber: data.bankAcc,
        ifscCode: 'HDFC0001234',
        isVerified: true,
      },
    });

    await prisma.employeeSalaryAssignment.upsert({
      where: { id: `sal_${employee.id}` },
      update: {},
      create: {
        id: `sal_${employee.id}`,
        tenantId: tenant.id,
        employeeId: employee.id,
        structureId: salaryStructure.id,
        ctc: data.ctc,
        grossSalary: data.ctc / 12,
        netSalary: (data.ctc / 12) * 0.85,
        effectiveFrom: new Date('2025-01-15'),
        taxRegime: 'NEW_REGIME',
        isCurrent: true,
      },
    });

    // Opening leave balances
    for (const code of ['CL', 'SL', 'EL']) {
      const lt = leaveTypeMap.get(code);
      if (lt) {
        const openingDays = code === 'EL' ? 15 : 10;
        await prisma.leaveLedger.create({
          data: {
            tenantId: tenant.id,
            employeeId: employee.id,
            leaveTypeId: lt.id,
            transactionType: 'OPENING',
            days: openingDays,
            balanceAfter: openingDays,
            referenceType: 'OPENING_BALANCE',
            reason: 'Annual Opening Leave Balance',
            transactionDate: new Date('2026-01-01'),
          },
        });
      }
    }

    return employee;
  }

  // 12. Create Core Staff
  const adminEmp = await createPerson({
    email: 'admin@aiautomationlabs.com',
    firstName: 'Divij',
    lastName: 'Admin',
    roleName: 'COMPANY_ADMIN',
    code: 'EMP-2026-0001',
    departmentId: deptEng.id,
    designationId: desigArch.id,
    ctc: 3600000,
    phone: '+91 9876543210',
    pan: 'ABCDE1234F',
    aadhaar: '9876 5432 1098',
    bankAcc: '50100223344551',
  });

  const hrEmp = await createPerson({
    email: 'hr@aiautomationlabs.com',
    firstName: 'Anita',
    lastName: 'Deshmukh',
    roleName: 'HR_ADMIN',
    code: 'EMP-2026-0002',
    departmentId: deptHR.id,
    designationId: desigHRAdmin.id,
    ctc: 1800000,
    phone: '+91 9876543211',
    pan: 'ABCDE1234G',
    aadhaar: '9876 5432 1099',
    bankAcc: '50100223344552',
    reportingManagerId: adminEmp.id,
  });

  const finEmp = await createPerson({
    email: 'finance@aiautomationlabs.com',
    firstName: 'Ramesh',
    lastName: 'Iyer',
    roleName: 'FINANCE',
    code: 'EMP-2026-0003',
    departmentId: deptFin.id,
    designationId: desigFinance.id,
    ctc: 2000000,
    phone: '+91 9876543212',
    pan: 'ABCDE1234H',
    aadhaar: '9876 5432 1100',
    bankAcc: '50100223344553',
    reportingManagerId: adminEmp.id,
  });

  const managerEmp = await createPerson({
    email: 'manager@aiautomationlabs.com',
    firstName: 'Siddharth',
    lastName: 'Rao',
    roleName: 'MANAGER',
    code: 'EMP-2026-0004',
    departmentId: deptEng.id,
    designationId: desigArch.id,
    ctc: 2800000,
    phone: '+91 9876543213',
    pan: 'ABCDE1234J',
    aadhaar: '9876 5432 1101',
    bankAcc: '50100223344554',
    reportingManagerId: adminEmp.id,
  });

  const emp1 = await createPerson({
    email: 'emp1@aiautomationlabs.com',
    firstName: 'Priya',
    lastName: 'Sharma',
    roleName: 'EMPLOYEE',
    code: 'EMP-2026-0005',
    departmentId: deptEng.id,
    designationId: desigSrDev.id,
    ctc: 1500000,
    phone: '+91 9876543214',
    pan: 'ABCDE1234K',
    aadhaar: '9876 5432 1102',
    bankAcc: '50100223344555',
    reportingManagerId: managerEmp.id,
  });

  const emp2 = await createPerson({
    email: 'emp2@aiautomationlabs.com',
    firstName: 'Rahul',
    lastName: 'Verma',
    roleName: 'EMPLOYEE',
    code: 'EMP-2026-0006',
    departmentId: deptEng.id,
    designationId: desigSrDev.id,
    ctc: 1400000,
    phone: '+91 9876543215',
    pan: 'ABCDE1234L',
    aadhaar: '9876 5432 1103',
    bankAcc: '50100223344556',
    reportingManagerId: managerEmp.id,
  });

  // 13. Populate 1-Month Attendance Cycle (e.g., May 2026 / current month)
  const today = new Date();
  const monthStart = startOfMonth(today);
  const daysInCycle = eachDayOfInterval({ start: monthStart, end: today });

  for (const emp of [adminEmp, hrEmp, finEmp, managerEmp, emp1, emp2]) {
    for (const [idx, day] of daysInCycle.entries()) {
      if (isWeekend(day)) {
        await prisma.dailyAttendanceRecord.upsert({
          where: { tenantId_employeeId_date: { tenantId: tenant.id, employeeId: emp.id, date: day } },
          update: {},
          create: {
            tenantId: tenant.id,
            employeeId: emp.id,
            date: day,
            status: 'WEEK_OFF',
            shiftId: standardShift.id,
          },
        });
      } else {
        const isLateDay = idx % 5 === 0;
        const checkInHour = isLateDay ? 9 : 9;
        const checkInMinute = isLateDay ? 48 : (15 + (idx % 12));
        
        const checkInTime = new Date(day);
        checkInTime.setHours(checkInHour, checkInMinute, 0, 0);
        const checkOutTime = new Date(day);
        checkOutTime.setHours(18, 30 + (idx % 25), 0, 0);

        // Alternate IoT devices: Biometric Terminal BLR-01, Mobile GPS, RFID Turnstile, Face Recognition Kiosk
        const deviceTypes = ['BIOMETRIC', 'BIOMETRIC', 'MOBILE_GPS', 'BIOMETRIC', 'QR'];
        const chosenDevice = deviceTypes[(idx + emp.employeeCode.charCodeAt(emp.employeeCode.length - 1)) % deviceTypes.length];
        const isGeofenced = true;
        const latitude = 12.9716 + (Math.random() * 0.0008 - 0.0004);
        const longitude = 77.5946 + (Math.random() * 0.0008 - 0.0004);

        // Immutable raw punch check-in
        await prisma.rawAttendancePunch.create({
          data: {
            tenantId: tenant.id,
            employeeId: emp.id,
            punchTimestamp: checkInTime,
            punchType: 'CHECK_IN',
            deviceType: chosenDevice,
            latitude,
            longitude,
            accuracy: 8.5,
            ipAddress: chosenDevice === 'BIOMETRIC' ? '192.168.1.140' : '106.51.78.22',
            isGeofenced,
            verificationStatus: 'VERIFIED',
          },
        });

        // Immutable raw punch check-out
        await prisma.rawAttendancePunch.create({
          data: {
            tenantId: tenant.id,
            employeeId: emp.id,
            punchTimestamp: checkOutTime,
            punchType: 'CHECK_OUT',
            deviceType: chosenDevice,
            latitude,
            longitude,
            accuracy: 8.5,
            ipAddress: chosenDevice === 'BIOMETRIC' ? '192.168.1.140' : '106.51.78.22',
            isGeofenced,
            verificationStatus: 'VERIFIED',
          },
        });

        const workedMinutes = Math.round((checkOutTime.getTime() - checkInTime.getTime()) / 60000);

        await prisma.dailyAttendanceRecord.upsert({
          where: { tenantId_employeeId_date: { tenantId: tenant.id, employeeId: emp.id, date: day } },
          update: {},
          create: {
            tenantId: tenant.id,
            employeeId: emp.id,
            date: day,
            firstCheckIn: checkInTime,
            lastCheckOut: checkOutTime,
            totalWorkedMinutes: workedMinutes,
            status: 'PRESENT',
            isLate: isLateDay,
            lateMinutes: isLateDay ? 18 : 0,
            shiftId: standardShift.id,
          },
        });
      }
    }
  }

  // 14. Phase 2: ATS Pipeline Seed
  const jobReq = await prisma.jobRequisition.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'JOB-ENG-001' } },
    update: {},
    create: {
      tenantId: tenant.id,
      title: 'Principal AI Engineer',
      code: 'JOB-ENG-001',
      departmentId: deptEng.id,
      designationId: desigArch.id,
      branchLocationId: blrBranch.id,
      legalEntityId: legalEntity.id,
      headcount: 2,
      experienceYears: 6,
      minCtc: 2500000,
      maxCtc: 4000000,
      status: 'PUBLISHED',
      description: 'Lead next-gen LLM autonomous agent systems & multi-tenant HRMS architectures.',
      requirements: 'TypeScript, Node.js, PyTorch, Distributed Systems, PostgreSQL',
    },
  });

  const cand1 = await prisma.candidate.upsert({
    where: {
      tenantId_jobRequisitionId_email: {
        tenantId: tenant.id,
        jobRequisitionId: jobReq.id,
        email: 'kavita.k@example.com',
      },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      jobRequisitionId: jobReq.id,
      firstName: 'Kavita',
      lastName: 'Krishnamurthy',
      email: 'kavita.k@example.com',
      phone: '+91 9988776655',
      currentCompany: 'DeepTech Systems',
      currentCtc: 2800000,
      expectedCtc: 3600000,
      noticePeriodDays: 30,
      stage: 'OFFERED',
      aiMatchScore: 94,
      skills: JSON.stringify(['TypeScript', 'Node.js', 'PyTorch', 'Vector DBs', 'System Design']),
      resumeText: 'Lead AI Engineer with 8 years building distributed scalable platforms.',
    },
  });

  await prisma.candidate.upsert({
    where: {
      tenantId_jobRequisitionId_email: {
        tenantId: tenant.id,
        jobRequisitionId: jobReq.id,
        email: 'arjun.s@example.com',
      },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      jobRequisitionId: jobReq.id,
      firstName: 'Arjun',
      lastName: 'Sengupta',
      email: 'arjun.s@example.com',
      phone: '+91 9123456780',
      currentCompany: 'FinTech Hub',
      currentCtc: 2200000,
      expectedCtc: 2800000,
      noticePeriodDays: 60,
      stage: 'INTERVIEW',
      aiMatchScore: 82,
      skills: JSON.stringify(['PostgreSQL', 'Microservices', 'Distributed Locks']),
      resumeText: 'Senior Backend Engineer with expertise in transaction processing.',
    },
  });

  // 15. Phase 2: Onboarding Templates & Instances
  const onbTemplate = await prisma.onboardingTemplate.upsert({
    where: { id: 'onb-tmpl-eng-standard' },
    update: {},
    create: {
      id: 'onb-tmpl-eng-standard',
      tenantId: tenant.id,
      title: 'Engineering New Hire Playbook',
      description: 'Standard technical onboarding checklist and asset provisioning',
      department: 'Engineering',
      tasks: {
        create: [
          {
            taskTitle: 'Verify Aadhaar & PAN Documents',
            category: 'DOCUMENT_SUBMISSION',
            dueDaysFromJoining: 1,
            isRequired: true,
            sortOrder: 1,
          },
          {
            taskTitle: 'Provision MacBook Pro & GitHub / AWS Access',
            category: 'IT_SETUP',
            dueDaysFromJoining: 1,
            isRequired: true,
            sortOrder: 2,
          },
          {
            taskTitle: 'Sign Digital NDA & Employment Contract',
            category: 'POLICY_SIGNING',
            dueDaysFromJoining: 2,
            isRequired: true,
            sortOrder: 3,
          },
        ],
      },
    },
  });

  // 16. Phase 2: Document Templates
  const offerTemplate = await prisma.documentTemplate.upsert({
    where: {
      tenantId_code_version: { tenantId: tenant.id, code: 'OFFER_LETTER_STANDARD', version: 1 },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      title: 'Standard Executive Offer Letter',
      code: 'OFFER_LETTER_STANDARD',
      version: 1,
      isActive: true,
      contentHtml: `<div style="font-family: sans-serif; padding: 20px;">
<h2>CONFIDENTIAL EMPLOYMENT OFFER LETTER</h2>
<p>Date: {{current_date}}</p>
<p>Dear {{candidate.first_name}},</p>
<p>We are delighted to offer you the position of <strong>{{job.title}}</strong> at <strong>{{company.name}}</strong>.</p>
<p>Your Total Annual Cost to Company (CTC) will be <strong>INR {{salary.ctc_inr}}</strong>.</p>
<p>Please review and sign this digitally within 3 business days.</p>
</div>`,
    },
  });

  // 17. Phase 2: Performance Cycle & Goals
  const perfCycle = await prisma.performanceCycle.upsert({
    where: { id: 'perf-cycle-2026-q1' },
    update: {},
    create: {
      id: 'perf-cycle-2026-q1',
      tenantId: tenant.id,
      title: 'FY 2026-Q1 Performance & OKR Review',
      cycleType: 'QUARTERLY',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-03-31'),
      status: 'ACTIVE',
    },
  });

  const existingGoal1 = await prisma.performanceGoal.findFirst({
    where: { performanceCycleId: perfCycle.id, employeeId: emp1.id, title: 'Architect Real-Time Multi-Tenant Payroll Engine' }
  });
  if (!existingGoal1) {
    await prisma.performanceGoal.create({
      data: {
        performanceCycleId: perfCycle.id,
        employeeId: emp1.id,
        title: 'Architect Real-Time Multi-Tenant Payroll Engine',
        description: 'Deliver sub-100ms payroll calculation pipeline with 100% test coverage on statutory formulas.',
        category: 'OKR',
        weight: 50.0,
        targetValue: '100%',
        actualValue: '95%',
        progressPercent: 95,
      },
    });
  }

  const existingGoal2 = await prisma.performanceGoal.findFirst({
    where: { performanceCycleId: perfCycle.id, employeeId: emp1.id, title: 'Zero-Downtime Multi-Region Disaster Recovery' }
  });
  if (!existingGoal2) {
    await prisma.performanceGoal.create({
      data: {
        performanceCycleId: perfCycle.id,
        employeeId: emp1.id,
        title: 'Zero-Downtime Multi-Region Disaster Recovery',
        description: 'Automate replication failovers and tenant database backups.',
        category: 'OKR',
        weight: 50.0,
        targetValue: '100%',
        actualValue: '100%',
        progressPercent: 100,
      },
    });
  }

  // 18. Phase 2: Expense Categories & Sample Claim
  const expTravel = await prisma.expenseCategory.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'TRAVEL' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Travel & Airfare',
      code: 'TRAVEL',
      maxLimit: 50000,
      requiresReceipt: true,
    },
  });

  const expMeal = await prisma.expenseCategory.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'MEALS' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Client Meals & Team Dinners',
      code: 'MEALS',
      maxLimit: 10000,
      requiresReceipt: true,
    },
  });

  const existingExpense = await prisma.expenseClaim.findFirst({
    where: { tenantId: tenant.id, employeeId: emp1.id, expenseCategoryId: expTravel.id }
  });
  if (!existingExpense) {
    await prisma.expenseClaim.create({
      data: {
        tenantId: tenant.id,
        employeeId: emp1.id,
        expenseCategoryId: expTravel.id,
        claimDate: new Date('2026-05-10'),
        amount: 14500,
        description: 'Flight tickets for AI Innovation Summit Bengaluru-Mumbai',
        receiptUrl: 'https://placehold.co/600x400/png?text=Flight+Invoice+Verified',
        status: 'FINANCE_APPROVED',
        paymentMethod: 'PAYROLL_REIMBURSEMENT',
      },
    });
  }

  // 19. Phase 2: Hardware IT Assets
  const asset1 = await prisma.asset.upsert({
    where: { tenantId_assetTag: { tenantId: tenant.id, assetTag: 'AST-LTP-001' } },
    update: {},
    create: {
      tenantId: tenant.id,
      assetTag: 'AST-LTP-001',
      assetName: 'Apple MacBook Pro 16" M3 Max',
      category: 'LAPTOP',
      serialNumber: 'C02G1234MD6R',
      purchaseDate: new Date('2025-10-15'),
      purchaseCost: 320000,
      status: 'ASSIGNED',
      branchLocationId: blrBranch.id,
    },
  });

  const existingAssignment = await prisma.assetAssignment.findFirst({
    where: { assetId: asset1.id, employeeId: emp1.id }
  });
  if (!existingAssignment) {
    await prisma.assetAssignment.create({
      data: {
        assetId: asset1.id,
        employeeId: emp1.id,
        assignedDate: new Date('2025-10-20'),
        condition: 'NEW',
        notes: 'Pristine factory sealed issue',
      },
    });
  }

  await prisma.asset.upsert({
    where: { tenantId_assetTag: { tenantId: tenant.id, assetTag: 'AST-MON-002' } },
    update: {},
    create: {
      tenantId: tenant.id,
      assetTag: 'AST-MON-002',
      assetName: 'Dell UltraSharp 32" 4K Monitor',
      category: 'MONITOR',
      serialNumber: 'CN-088912-DEL',
      purchaseDate: new Date('2025-11-01'),
      purchaseCost: 65000,
      status: 'AVAILABLE',
      branchLocationId: blrBranch.id,
    },
  });

  // 20. Phase 2: Exit & Full & Final (F&F) Case
  const existingExit = await prisma.exitRequest.findFirst({
    where: { tenantId: tenant.id, employeeId: emp2.id }
  });
  if (!existingExit) {
    await prisma.exitRequest.create({
      data: {
        tenantId: tenant.id,
        employeeId: emp2.id,
        resignationDate: new Date('2026-05-01'),
        requestedLwd: new Date('2026-05-31'),
        approvedLwd: new Date('2026-05-31'),
        reason: 'Pursuing higher studies / research abroad',
        status: 'CLEARANCE_IN_PROGRESS',
        itClearanceStatus: 'CLEARED',
        financeClearanceStatus: 'CLEARED',
        adminClearanceStatus: 'CLEARED',
        settlement: {
          create: {
            payableDays: 30,
            earnedSalaryAmount: 116667,
            leaveEncashmentDays: 10,
            leaveEncashmentAmount: 38889,
            noticePayShortfallDays: 0,
            noticeRecoveryAmount: 0,
            gratuityAmount: 0, // < 5 yrs
            finalSettlementAmount: 155556,
            status: 'CALCULATED',
          },
        },
      },
    });
  }

  // 21. Phase 2: Second Tenant for Super Admin Multi-Tenancy Validation
  const tenant2 = await prisma.tenant.upsert({
    where: { slug: 'nova-healthtech' },
    update: {},
    create: {
      name: 'Nova Healthtech Pvt Ltd',
      slug: 'nova-healthtech',
      domain: 'novahealth.io',
      status: 'ACTIVE',
      plan: 'ENTERPRISE',
      settings: JSON.stringify({
        primaryColor: '#0284c7',
        currency: 'INR',
        country: 'India',
        timezone: 'Asia/Kolkata',
      }),
    },
  });

  console.log('✅ Phase 1 + Phase 2 Seed completed successfully! All 12 master modules populated.');
}

if (require.main === module) {
  seedDatabase()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
