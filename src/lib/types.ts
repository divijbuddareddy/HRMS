export type DataScope =
  | 'OWN'
  | 'DIRECT_REPORTS'
  | 'DEPARTMENT'
  | 'BRANCH_LOCATION'
  | 'LEGAL_ENTITY'
  | 'ENTIRE_TENANT';

export type RoleName =
  | 'PLATFORM_SUPER_ADMIN'
  | 'PLATFORM_SUPPORT_ADMIN'
  | 'COMPANY_ADMIN'
  | 'HR_ADMIN'
  | 'HR_EXECUTIVE'
  | 'FINANCE'
  | 'MANAGER'
  | 'EMPLOYEE'
  | 'CUSTOM';

export interface AuthUser {
  userId: string;
  tenantId: string;
  email: string;
  employeeId?: string;
  roles: RoleName[];
  permissions: {
    permissionKey: string;
    dataScope: DataScope;
    isSensitive: boolean;
  }[];
  departmentId?: string;
  branchLocationId?: string;
  legalEntityId?: string;
}

export interface StatutoryRulesEPF {
  employeeRate: number; // e.g. 0.12 (12%)
  employerEpfRate: number; // e.g. 0.0367 (3.67%)
  employerEpsRate: number; // e.g. 0.0833 (8.33%)
  wageCeiling: number; // e.g. 15000
  adminChargesRate: number; // e.g. 0.005
  edliRate: number; // e.g. 0.005
}

export interface StatutoryRulesESI {
  employeeRate: number; // e.g. 0.0075 (0.75%)
  employerRate: number; // e.g. 0.0325 (3.25%)
  grossWageLimit: number; // e.g. 21000
}

export interface StatePTSlab {
  minMonthlyGross: number;
  maxMonthlyGross: number;
  monthlyTax: number;
  februaryTax?: number; // specific to Maharashtra / some states
}

export interface StatutoryRulesPT {
  state: string;
  slabs: StatePTSlab[];
}

export interface TaxRegimeSlab {
  minAnnualIncome: number;
  maxAnnualIncome: number;
  taxRate: number;
}

export interface StatutoryRulesTDS {
  fiscalYear: string;
  newRegimeSlabs: TaxRegimeSlab[];
  oldRegimeSlabs: TaxRegimeSlab[];
  standardDeduction: number;
  rebateLimitNewRegime: number; // e.g. 700000 -> full rebate (or 1200000 for newer revisions)
  rebateLimitOldRegime: number; // e.g. 500000
  surchargeRates: { minIncome: number; rate: number }[];
  healthAndEducationCessRate: number; // 0.04 (4%)
}
