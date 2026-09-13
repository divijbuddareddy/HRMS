'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import {
  Banknote,
  Calculator,
  Lock,
  CheckCircle,
  FileSpreadsheet,
  Edit3,
  ShieldCheck,
  Building,
  Printer,
  X,
  TrendingUp,
  AlertCircle,
} from 'lucide-react';
import { format } from 'date-fns';

export default function PayrollPage() {
  const { user } = useAuth();
  const [runs, setRuns] = useState<any[]>([]);
  const [selectedRun, setSelectedRun] = useState<any | null>(null);
  const [structures, setStructures] = useState<any[]>([]);
  const [statutoryRules, setStatutoryRules] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<'RUNS' | 'STRUCTURES' | 'STATUTORY'>('RUNS');
  const [loading, setLoading] = useState(true);

  // Month / year selector
  const [runMonth, setRunMonth] = useState(new Date().getMonth() + 1);
  const [runYear, setRunYear] = useState(new Date().getFullYear());
  const [calculating, setCalculating] = useState(false);

  // Override modal
  const [overrideItem, setOverrideItem] = useState<any | null>(null);
  const [overrideComp, setOverrideComp] = useState('SPECIAL_ALLOWANCE');
  const [overrideAmount, setOverrideAmount] = useState('');
  const [overrideReason, setOverrideReason] = useState('');

  // Payslip modal
  const [viewPayslip, setViewPayslip] = useState<any | null>(null);

  const fetchPayroll = async () => {
    setLoading(true);
    try {
      const [rRes, sRes, stRes] = await Promise.all([
        fetch('/api/payroll/runs'),
        fetch('/api/payroll/structures'),
        fetch('/api/payroll/statutory-rules'),
      ]);

      if (rRes.ok) {
        const rData = await rRes.json();
        setRuns(rData.runs || []);
        if (rData.runs?.[0]) setSelectedRun(rData.runs[0]);
      }
      if (sRes.ok) setStructures((await sRes.json()).structures || []);
      if (stRes.ok) setStatutoryRules(await stRes.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayroll();
  }, []);

  const handleRunPayroll = async () => {
    setCalculating(true);
    try {
      const res = await fetch('/api/payroll/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: runMonth, year: runYear }),
      });
      const data = await res.json();
      if (res.ok) {
        await fetchPayroll();
        setSelectedRun(data.run);
      } else {
        alert(data.error || 'Payroll calculation failed');
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setCalculating(false);
    }
  };

  const handleAction = async (action: 'APPROVE' | 'LOCK' | 'PUBLISH') => {
    if (!selectedRun) return;
    try {
      const res = await fetch(`/api/payroll/runs/${selectedRun.id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        await fetchPayroll();
      } else {
        const d = await res.json();
        alert(d.error || `Failed to ${action.toLowerCase()} payroll run`);
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleSaveOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideItem) return;
    try {
      const res = await fetch(`/api/payroll/runs/${selectedRun.id}/override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payrollItemId: overrideItem.id,
          componentCode: overrideComp,
          newAmount: overrideAmount,
          reason: overrideReason,
        }),
      });
      if (res.ok) {
        setOverrideItem(null);
        await fetchPayroll();
      } else {
        const d = await res.json();
        alert(d.error || 'Failed to save component override');
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const formatINR = (val: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);

  return (
    <DashboardLayout title="Payroll & Indian Statutory Compliance" subtitle="Deterministic calculation, EPF/ESI/PT/TDS compliance, lock and payslips">
      <div className="space-y-6">
        {/* Navigation Tabs */}
        <div className="flex gap-2 border-b border-slate-200 pb-2">
          <button
            onClick={() => setActiveTab('RUNS')}
            className={`px-4 py-2 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 ${
              activeTab === 'RUNS' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Calculator className="h-3.5 w-3.5" />
            Payroll Runs & Payslips
          </button>
          <button
            onClick={() => setActiveTab('STRUCTURES')}
            className={`px-4 py-2 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 ${
              activeTab === 'STRUCTURES' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Salary Structures
          </button>
          <button
            onClick={() => setActiveTab('STATUTORY')}
            className={`px-4 py-2 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 ${
              activeTab === 'STATUTORY' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Indian Statutory Rules (EPF/ESI/PT/TDS)
          </button>
        </div>

        {/* Tab 1: Runs & Payslips */}
        {activeTab === 'RUNS' && (
          <div className="space-y-6">
            {/* Top Control Bar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
                  <span>Cycle:</span>
                  <select
                    value={runMonth}
                    onChange={(e) => setRunMonth(parseInt(e.target.value))}
                    className="p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                      <option key={m} value={m}>
                        Month {m}
                      </option>
                    ))}
                  </select>
                  <select
                    value={runYear}
                    onChange={(e) => setRunYear(parseInt(e.target.value))}
                    className="p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  >
                    <option value={2026}>2026</option>
                    <option value={2025}>2025</option>
                  </select>
                </div>

                <button
                  disabled={calculating}
                  onClick={handleRunPayroll}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium text-xs rounded-xl shadow-sm shadow-emerald-600/20 flex items-center gap-1.5 transition-colors"
                >
                  <Calculator className="h-3.5 w-3.5" />
                  {calculating ? 'Calculating...' : 'Run / Recalculate Payroll'}
                </button>
              </div>

              {selectedRun && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Status:</span>
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                      selectedRun.status === 'LOCKED' || selectedRun.status === 'PUBLISHED'
                        ? 'bg-purple-50 text-purple-700 border border-purple-200'
                        : selectedRun.status === 'APPROVED'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}
                  >
                    {selectedRun.status}
                  </span>

                  {selectedRun.status === 'CALCULATED' && (
                    <button
                      onClick={() => handleAction('APPROVE')}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-medium rounded-lg"
                    >
                      Approve Run
                    </button>
                  )}

                  {selectedRun.status === 'APPROVED' && (
                    <button
                      onClick={() => handleAction('LOCK')}
                      className="px-3 py-1.5 bg-purple-700 hover:bg-purple-800 text-white text-xs font-medium rounded-lg flex items-center gap-1"
                    >
                      <Lock className="h-3.5 w-3.5" />
                      Lock & Generate Payslips
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Run Financial Summary Cards */}
            {selectedRun && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                  <span className="text-xs text-slate-500 block">Total Employees</span>
                  <span className="text-2xl font-bold text-slate-900">{selectedRun.totalEmployees}</span>
                  <span className="text-[11px] text-slate-400 block mt-0.5">Processed in batch</span>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                  <span className="text-xs text-slate-500 block">Total Gross Pay</span>
                  <span className="text-2xl font-bold text-emerald-600">{formatINR(selectedRun.totalGrossPay)}</span>
                  <span className="text-[11px] text-slate-400 block mt-0.5">Earnings</span>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                  <span className="text-xs text-slate-500 block">Total Deductions</span>
                  <span className="text-2xl font-bold text-rose-600">{formatINR(selectedRun.totalDeductions)}</span>
                  <span className="text-[11px] text-slate-400 block mt-0.5">PF + ESI + PT + TDS</span>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                  <span className="text-xs text-slate-500 block">Total Net Payout</span>
                  <span className="text-2xl font-bold text-purple-700">{formatINR(selectedRun.totalNetPay)}</span>
                  <span className="text-[11px] text-slate-400 block mt-0.5">Bank transfer total</span>
                </div>
              </div>
            )}

            {/* Payroll Calculation Register Table */}
            {selectedRun && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-800">
                    Cycle {selectedRun.cycle?.month}/{selectedRun.cycle?.year} Register
                  </span>
                  <span className="text-slate-500 font-mono">Formula & Statutory Compliant</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold">
                      <tr>
                        <th className="py-3 px-4">Employee</th>
                        <th className="py-3 px-4">Payable Days</th>
                        <th className="py-3 px-4">Gross Earned</th>
                        <th className="py-3 px-4">PF (EE)</th>
                        <th className="py-3 px-4">PT</th>
                        <th className="py-3 px-4">TDS (Tax)</th>
                        <th className="py-3 px-4">Net Salary</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {selectedRun.items?.map((item: any) => {
                        const deductions = JSON.parse(item.deductionsBreakdown || '{}');
                        return (
                          <tr key={item.id} className="hover:bg-slate-50/70 font-sans">
                            <td className="py-3 px-4">
                              <div className="font-semibold text-slate-900">
                                {item.employee?.firstName} {item.employee?.lastName}
                              </div>
                              <div className="text-[11px] text-slate-400 font-mono">
                                {item.employee?.employeeCode} • {item.taxRegime}
                              </div>
                            </td>
                            <td className="py-3 px-4 font-mono font-bold text-slate-700">
                              {item.payableDays}d
                              {item.unpaidLopDays > 0 && (
                                <span className="ml-1 text-[10px] text-rose-600">({item.unpaidLopDays}d LOP)</span>
                              )}
                            </td>
                            <td className="py-3 px-4 font-mono font-bold text-emerald-700">
                              {formatINR(item.grossEarnings)}
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-700">
                              {formatINR(deductions['PF_EE'] || 0)}
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-700">
                              {formatINR(deductions['PT'] || 0)}
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-700">
                              {formatINR(deductions['TDS'] || 0)}
                            </td>
                            <td className="py-3 px-4 font-mono font-bold text-purple-700">
                              {formatINR(item.netSalary)}
                            </td>
                            <td className="py-3 px-4 text-right font-sans">
                              <div className="flex justify-end gap-1.5">
                                {!['LOCKED', 'PUBLISHED'].includes(selectedRun.status) && (
                                  <button
                                    onClick={() => {
                                      setOverrideItem(item);
                                      setOverrideAmount(String(item.grossEarnings));
                                    }}
                                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium flex items-center gap-1"
                                  >
                                    <Edit3 className="h-3 w-3" /> Override
                                  </button>
                                )}
                                <button
                                  onClick={() => setViewPayslip(item)}
                                  className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-medium flex items-center gap-1"
                                >
                                  <Printer className="h-3 w-3" /> Payslip
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Salary Structures */}
        {activeTab === 'STRUCTURES' && (
          <div className="space-y-4">
            {structures.map((s) => (
              <div key={s.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">{s.name}</h3>
                    <p className="text-xs text-slate-500 font-mono">Code: {s.code} • {s._count?.assignments || 0} Employees Assigned</p>
                  </div>
                  {s.isDefault && (
                    <span className="text-xs bg-emerald-50 text-emerald-700 font-bold px-2.5 py-1 rounded-full border border-emerald-200">
                      Default Template
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {s.components?.map((c: any) => (
                    <div key={c.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-1">
                      <div className="flex justify-between font-semibold text-slate-800">
                        <span>{c.name}</span>
                        <span className="font-mono text-[10px] bg-slate-200 px-1 rounded">{c.componentType}</span>
                      </div>
                      <div className="text-slate-500 font-mono text-[11px]">Formula: {c.valueOrFormula}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab 3: Versioned Statutory Rules */}
        {activeTab === 'STATUTORY' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* EPF Rules */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
                <ShieldCheck className="h-5 w-5" />
                Employees' Provident Fund (EPF)
              </div>
              <div className="space-y-2 text-xs text-slate-700">
                <div className="flex justify-between p-2 bg-slate-50 rounded-lg">
                  <span>Employee PF Contribution:</span>
                  <span className="font-mono font-bold">12.00% of Basic</span>
                </div>
                <div className="flex justify-between p-2 bg-slate-50 rounded-lg">
                  <span>Employer EPS Split:</span>
                  <span className="font-mono font-bold">8.33% (Cap ₹1,250)</span>
                </div>
                <div className="flex justify-between p-2 bg-slate-50 rounded-lg">
                  <span>Employer EPF Split:</span>
                  <span className="font-mono font-bold">3.67% of Basic</span>
                </div>
                <div className="flex justify-between p-2 bg-slate-50 rounded-lg">
                  <span>Wage Ceiling:</span>
                  <span className="font-mono font-bold">₹15,000 / month</span>
                </div>
              </div>
            </div>

            {/* ESI Rules */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
                <ShieldCheck className="h-5 w-5" />
                Employee State Insurance (ESI)
              </div>
              <div className="space-y-2 text-xs text-slate-700">
                <div className="flex justify-between p-2 bg-slate-50 rounded-lg">
                  <span>Wage Threshold:</span>
                  <span className="font-mono font-bold">₹21,000 / month Gross</span>
                </div>
                <div className="flex justify-between p-2 bg-slate-50 rounded-lg">
                  <span>Employee ESI Rate:</span>
                  <span className="font-mono font-bold">0.75% of Gross</span>
                </div>
                <div className="flex justify-between p-2 bg-slate-50 rounded-lg">
                  <span>Employer ESI Rate:</span>
                  <span className="font-mono font-bold">3.25% of Gross</span>
                </div>
              </div>
            </div>

            {/* Professional Tax */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
                <ShieldCheck className="h-5 w-5" />
                State-wise Professional Tax (PT)
              </div>
              <div className="space-y-2 text-xs text-slate-700">
                <div className="flex justify-between p-2 bg-slate-50 rounded-lg">
                  <span>Karnataka:</span>
                  <span className="font-mono font-bold">₹200 / month (&gt;= ₹25,000)</span>
                </div>
                <div className="flex justify-between p-2 bg-slate-50 rounded-lg">
                  <span>Maharashtra:</span>
                  <span className="font-mono font-bold">₹200 / month (₹300 in Feb)</span>
                </div>
                <div className="flex justify-between p-2 bg-slate-50 rounded-lg">
                  <span>Delhi:</span>
                  <span className="font-mono font-bold">Nil (₹0)</span>
                </div>
              </div>
            </div>

            {/* Income Tax Slabs */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
                <ShieldCheck className="h-5 w-5" />
                Income Tax Regimes (FY 2026-27)
              </div>
              <div className="space-y-2 text-xs text-slate-700">
                <div className="flex justify-between p-2 bg-slate-50 rounded-lg">
                  <span>New Regime Std Deduction:</span>
                  <span className="font-mono font-bold">₹75,000</span>
                </div>
                <div className="flex justify-between p-2 bg-slate-50 rounded-lg">
                  <span>Old Regime Std Deduction:</span>
                  <span className="font-mono font-bold">₹50,000 + 80C/80D/HRA</span>
                </div>
                <div className="flex justify-between p-2 bg-slate-50 rounded-lg">
                  <span>Health & Edu Cess:</span>
                  <span className="font-mono font-bold">4.00%</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Manual Component Override Modal */}
        {overrideItem && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h3 className="font-semibold text-slate-900 text-base flex items-center gap-2">
                  <Edit3 className="h-5 w-5 text-emerald-600" />
                  Manual Component Override
                </h3>
                <button onClick={() => setOverrideItem(null)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                Overriding salary for <strong>{overrideItem.employee?.firstName} {overrideItem.employee?.lastName}</strong> ({overrideItem.employee?.employeeCode}). All overrides are audited.
              </div>

              <form onSubmit={handleSaveOverride} className="space-y-3 text-xs">
                <div>
                  <label className="font-medium text-slate-700 block mb-1">Component to Override</label>
                  <select
                    value={overrideComp}
                    onChange={(e) => setOverrideComp(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                  >
                    <option value="SPECIAL_ALLOWANCE">Special Allowance (Earnings)</option>
                    <option value="BASIC">Basic (Earnings)</option>
                    <option value="HRA">HRA (Earnings)</option>
                    <option value="TDS">TDS Income Tax (Deduction)</option>
                  </select>
                </div>

                <div>
                  <label className="font-medium text-slate-700 block mb-1">New Amount (₹) *</label>
                  <input
                    type="number"
                    required
                    value={overrideAmount}
                    onChange={(e) => setOverrideAmount(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-mono"
                  />
                </div>

                <div>
                  <label className="font-medium text-slate-700 block mb-1">Audit Reason for Override *</label>
                  <textarea
                    rows={3}
                    required
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg"
                    placeholder="e.g. One-time performance adjustment authorized by Finance Lead"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setOverrideItem(null)}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium shadow-sm shadow-emerald-600/20"
                  >
                    Save Override
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Payslip Modal View / Printable */}
        {viewPayslip && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-8 shadow-2xl border border-slate-200 my-8 space-y-6">
              {/* Header */}
              <div className="flex justify-between items-start border-b border-slate-200 pb-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">AI AUTOMATION LABS LLP</h2>
                  <p className="text-xs text-slate-500">100 Feet Road, Indiranagar, Bengaluru, Karnataka 560038</p>
                  <p className="text-xs text-slate-500 font-mono">PAN: AAACA1234F • GSTIN: 29AAACA1234F1Z5</p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold bg-slate-100 text-slate-800 px-3 py-1 rounded-full uppercase tracking-wider block mb-1">
                    Payslip
                  </span>
                  <span className="text-xs text-slate-500 font-mono">
                    {selectedRun?.cycle?.month}/{selectedRun?.cycle?.year}
                  </span>
                </div>
              </div>

              {/* Employee & Bank Info */}
              <div className="grid grid-cols-2 gap-4 text-xs p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div>
                  <div>Name: <strong>{viewPayslip.employee?.firstName} {viewPayslip.employee?.lastName}</strong></div>
                  <div>Emp Code: <strong className="font-mono">{viewPayslip.employee?.employeeCode}</strong></div>
                  <div>Designation: <strong>{viewPayslip.employee?.designation?.title || 'Engineer'}</strong></div>
                  <div>Department: <strong>{viewPayslip.employee?.department?.name || 'Engineering'}</strong></div>
                </div>
                <div>
                  <div>Payable Days: <strong className="font-mono">{viewPayslip.payableDays}</strong></div>
                  <div>Bank Name: <strong>HDFC Bank</strong></div>
                  <div>Account: <strong className="font-mono">XXXXXX{viewPayslip.employee?.bank?.accountNumber?.slice(-4) || '1234'}</strong></div>
                  <div>Tax Regime: <strong className="font-mono">{viewPayslip.taxRegime}</strong></div>
                </div>
              </div>

              {/* Earnings & Deductions Table */}
              <div className="grid grid-cols-2 gap-4 text-xs">
                {/* Earnings */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-100 px-3 py-2 font-bold text-slate-800">Earnings</div>
                  <div className="divide-y divide-slate-100 p-2 space-y-1">
                    {Object.entries(JSON.parse(viewPayslip.earningsBreakdown || '{}')).map(([k, v]: any) => (
                      <div key={k} className="flex justify-between py-1 text-slate-700">
                        <span>{k.replace(/_/g, ' ')}</span>
                        <span className="font-mono font-semibold">{formatINR(v)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between py-2 font-bold text-slate-900 border-t border-slate-200">
                      <span>Gross Earnings</span>
                      <span className="font-mono text-emerald-700">{formatINR(viewPayslip.grossEarnings)}</span>
                    </div>
                  </div>
                </div>

                {/* Deductions */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-100 px-3 py-2 font-bold text-slate-800">Deductions</div>
                  <div className="divide-y divide-slate-100 p-2 space-y-1">
                    {Object.entries(JSON.parse(viewPayslip.deductionsBreakdown || '{}')).map(([k, v]: any) => (
                      <div key={k} className="flex justify-between py-1 text-slate-700">
                        <span>{k.replace(/_/g, ' ')}</span>
                        <span className="font-mono font-semibold">{formatINR(v)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between py-2 font-bold text-slate-900 border-t border-slate-200">
                      <span>Total Deductions</span>
                      <span className="font-mono text-rose-700">{formatINR(viewPayslip.totalDeductions)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Net Payout Callout */}
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 flex justify-between items-center">
                <div>
                  <span className="text-xs text-emerald-800 font-semibold block">NET TAKE-HOME SALARY</span>
                  <span className="text-2xl font-black text-emerald-900 font-mono">{formatINR(viewPayslip.netSalary)}</span>
                </div>
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm"
                >
                  <Printer className="h-4 w-4" /> Print / PDF
                </button>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setViewPayslip(null)}
                  className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
