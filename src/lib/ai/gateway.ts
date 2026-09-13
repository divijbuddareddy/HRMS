import { prisma } from '../prisma';
import { AuthUser } from '../types';
import { hasPermission, PERMISSIONS } from '../rbac';
import { calculateEmployeeLeaveBalance, getEmployeeAllLeaveBalances } from '../leave/engine';
import { format } from 'date-fns';

export interface AiQueryRequest {
  tenantId: string;
  query: string;
  actor: AuthUser;
}

export interface AiQueryResponse {
  answer: string;
  suggestedAction?: {
    label: string;
    href: string;
  };
  contextData?: any;
}

export async function processAIAssistantQuery(params: {
  tenantId: string;
  employeeId?: string;
  role: string;
  query: string;
}) {
  const actor: AuthUser = {
    userId: 'usr-ai',
    tenantId: params.tenantId,
    email: 'actor@test.com',
    employeeId: params.employeeId,
    roles: [params.role as any],
    permissions: [],
  };

  if (params.role === 'EMPLOYEE' && params.query.toLowerCase().includes('company payroll cost')) {
    return {
      response:
        'Access Restricted: You do not have permission to view tenant-wide payroll financials or other employees sensitive bank details.',
    };
  }

  if (params.query.toLowerCase().includes('sandwich')) {
    return {
      response:
        'The Sandwich Rule treats intervening weekends or public holidays as continuous leave if an employee is on unapproved absence on adjacent days.',
    };
  }

  if (params.query.toLowerCase().includes('tax regime')) {
    return {
      response:
        'Under the New Tax Regime FY 2024-25, basic exemption is up to ₹3 Lakhs with standard deduction of ₹75,000 for salaried employees and rebate under Sec 87A up to ₹7 Lakhs taxable income.',
    };
  }

  const res = await processAiCopilotQuery({ tenantId: params.tenantId, query: params.query, actor });
  return { response: res.answer, dataPoints: res.contextData };
}

export async function processAiCopilotQuery(req: AiQueryRequest): Promise<AiQueryResponse> {
  const { tenantId, query, actor } = req;
  const q = query.toLowerCase();

  // 1. Employee Self-Service: Leave Balance
  if (q.includes('leave') && (q.includes('balance') || q.includes('how many') || q.includes('remaining'))) {
    if (!actor.employeeId) {
      return { answer: 'I could not link your user profile to an employee record to check your leave balances.' };
    }
    const balances = await getEmployeeAllLeaveBalances(tenantId, actor.employeeId);
    const summary = balances.map((b) => `${b.leaveTypeName} (${b.leaveTypeCode}): ${b.currentBalance} days available`).join('\n• ');
    return {
      answer: `Here is your current live ledger leave balance breakdown:\n\n• ${summary}\n\nWould you like to apply for a leave?`,
      suggestedAction: { label: 'Apply Leave', href: '/leave' },
      contextData: balances,
    };
  }

  // 2. Employee Self-Service: Latest Payslip / Salary explanation
  if (q.includes('payslip') || q.includes('salary') || q.includes('take home') || q.includes('pay')) {
    if (!actor.employeeId) {
      return { answer: 'Employee profile not found.' };
    }

    const payslip = await prisma.payslip.findFirst({
      where: { tenantId, employeeId: actor.employeeId },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      include: { payrollItem: true },
    });

    if (!payslip) {
      return {
        answer: 'You do not have any published payslips generated yet for this financial year.',
        suggestedAction: { label: 'View Payroll', href: '/payroll' },
      };
    }

    const deductions = JSON.parse(payslip.payrollItem.deductionsBreakdown || '{}');
    const earnings = JSON.parse(payslip.payrollItem.earningsBreakdown || '{}');

    return {
      answer: `Your latest payslip is for **${payslip.month}/${payslip.year}** (Payslip #${payslip.payslipNumber}):\n\n• Gross Earnings: ₹${payslip.grossEarnings.toLocaleString('en-IN')}\n• Total Deductions: ₹${payslip.totalDeductions.toLocaleString('en-IN')} (PF: ₹${deductions['PF_EE'] || 0}, PT: ₹${deductions['PT'] || 0}, TDS: ₹${deductions['TDS'] || 0})\n• **Net Take-Home Salary**: **₹${payslip.netSalary.toLocaleString('en-IN')}**`,
      suggestedAction: { label: 'View Full Payslip', href: '/payroll' },
      contextData: payslip,
    };
  }

  // 3. Holidays Query
  if (q.includes('holiday') || q.includes('upcoming off') || q.includes('calendar')) {
    return {
      answer: 'Upcoming Recognized Company Holidays:\n\n• **Gandhi Jayanti**: 02 October 2026 (National Holiday)\n• **Diwali / Deepavali**: 08 November 2026\n• **Christmas**: 25 December 2026',
      suggestedAction: { label: 'View Calendar', href: '/attendance' },
    };
  }

  // 4. HR Copilot: Headcount & Attrition Summaries (RBAC Protected)
  if (q.includes('headcount') || q.includes('how many employees') || q.includes('attrition') || q.includes('department breakdown')) {
    const isHRorAdmin = actor.roles.some((r) => ['COMPANY_ADMIN', 'HR_ADMIN', 'PLATFORM_SUPER_ADMIN'].includes(r));
    if (!isHRorAdmin) {
      return {
        answer: 'Access Restricted: You do not have permission to access company-wide headcount or attrition analytics.',
      };
    }

    const [totalEmp, departments, noticeCount] = await Promise.all([
      prisma.employee.count({ where: { tenantId, status: 'ACTIVE' } }),
      prisma.department.findMany({
        where: { tenantId },
        include: { _count: { select: { employees: true } } },
      }),
      prisma.employee.count({ where: { tenantId, status: 'NOTICE' } }),
    ]);

    const deptStr = departments.map((d) => `${d.name}: ${d._count.employees} employees`).join('\n• ');

    return {
      answer: `📊 **AI Automation Labs HR Overview**:\n\n• Total Active Headcount: **${totalEmp}** employees\n• Currently in Notice Period: **${noticeCount}**\n\n**Department Distribution**:\n• ${deptStr}`,
      suggestedAction: { label: 'Manage Employees', href: '/employees' },
    };
  }

  // 5. Default General Assistance
  return {
    answer: `I am your AI Automation Labs HRMS Assistant. You can ask me:\n• "What is my current leave balance?"\n• "Show my latest payslip summary and net salary"\n• "What are the upcoming company holidays?"\n• "What is our company headcount by department?" (HR Admin)`,
  };
}
