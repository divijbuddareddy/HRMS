import { describe, it, expect } from 'vitest';
import {
  calculateAnnualIncomeTax,
  calculateProfessionalTax,
  DEFAULT_STATUTORY_CONFIG,
} from '../src/lib/payroll/engine';

describe('1E. Payroll & Indian Statutory Engine', () => {
  it('should calculate Indian Income Tax correctly under New Regime (FY 2026-27)', () => {
    // Annual Gross: 6,00,000 (Taxable after 75k std deduction = 5,25,000 <= 7,00,000 -> Full rebate = 0)
    const taxUnderRebate = calculateAnnualIncomeTax(600000, 'NEW_REGIME');
    expect(taxUnderRebate).toBe(0);

    // Annual Gross: 12,00,000 (Taxable = 11,25,000)
    // 0-3L: 0
    // 3-7L: 5% of 4L = 20,000
    // 7-10L: 10% of 3L = 30,000
    // 10-11.25L: 15% of 1.25L = 18,750
    // Base Tax = 68,750 + 4% cess (2,750) = 71,500
    const tax12L = calculateAnnualIncomeTax(1200000, 'NEW_REGIME');
    expect(tax12L).toBe(71500);
  });

  it('should calculate State-wise Professional Tax (PT) correctly', () => {
    // Karnataka: Rs 200 if gross >= 25,000
    expect(calculateProfessionalTax(50000, 'KARNATAKA', 5)).toBe(200);
    expect(calculateProfessionalTax(20000, 'KARNATAKA', 5)).toBe(0);

    // Maharashtra: Rs 200 normal months, Rs 300 in February
    expect(calculateProfessionalTax(50000, 'MAHARASHTRA', 5)).toBe(200);
    expect(calculateProfessionalTax(50000, 'MAHARASHTRA', 2)).toBe(300);

    // Delhi: Rs 0
    expect(calculateProfessionalTax(100000, 'DELHI', 5)).toBe(0);
  });

  it('should verify standard EPF rates and wage ceilings', () => {
    expect(DEFAULT_STATUTORY_CONFIG.epf.employeeRate).toBe(0.12);
    expect(DEFAULT_STATUTORY_CONFIG.epf.employerEpfRate).toBe(0.0367);
    expect(DEFAULT_STATUTORY_CONFIG.epf.employerEpsRate).toBe(0.0833);
    expect(DEFAULT_STATUTORY_CONFIG.epf.wageCeiling).toBe(15000);
  });

  it('should verify standard ESI rates and wage limits', () => {
    expect(DEFAULT_STATUTORY_CONFIG.esi.employeeRate).toBe(0.0075);
    expect(DEFAULT_STATUTORY_CONFIG.esi.employerRate).toBe(0.0325);
    expect(DEFAULT_STATUTORY_CONFIG.esi.grossLimit).toBe(21000);
  });
});
