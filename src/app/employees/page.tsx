'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import {
  Users,
  UserPlus,
  Upload,
  Search,
  Building,
  Briefcase,
  Shield,
  Eye,
  CheckCircle,
  AlertCircle,
  X,
  CreditCard,
  FileText,
} from 'lucide-react';
import { format } from 'date-fns';

export default function EmployeesPage() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [selectedEmp, setSelectedEmp] = useState<any | null>(null);

  // Modal states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [orgData, setOrgData] = useState<any>(null);

  // Add form state
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    workEmail: '',
    mobilePhone: '',
    gender: 'MALE',
    legalEntityId: '',
    branchLocationId: '',
    departmentId: '',
    designationId: '',
    panNumber: '',
    aadhaarNumber: '',
    bankAccountNumber: '',
    bankName: 'HDFC Bank',
  });

  // Import state
  const [csvText, setCsvText] = useState('');
  const [importResult, setImportResult] = useState<any | null>(null);
  const [importing, setImporting] = useState(false);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/employees');
      if (res.ok) {
        const data = await res.json();
        setEmployees(data.employees || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrg = async () => {
    try {
      const res = await fetch('/api/organization');
      if (res.ok) {
        const data = await res.json();
        setOrgData(data);
        if (data.legalEntities?.[0]) setFormData((f) => ({ ...f, legalEntityId: data.legalEntities[0].id }));
        if (data.branchLocations?.[0]) setFormData((f) => ({ ...f, branchLocationId: data.branchLocations[0].id }));
        if (data.departments?.[0]) setFormData((f) => ({ ...f, departmentId: data.departments[0].id }));
        if (data.designations?.[0]) setFormData((f) => ({ ...f, designationId: data.designations[0].id }));
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchEmployees();
    fetchOrg();
  }, []);

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setIsAddOpen(false);
        await fetchEmployees();
      } else {
        const d = await res.json();
        alert(d.error || 'Failed to create employee');
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleCsvImport = async () => {
    if (!csvText) return;
    setImporting(true);
    setImportResult(null);
    try {
      const res = await fetch('/api/employees/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvContent: csvText }),
      });
      const data = await res.json();
      setImportResult(data);
      if (res.ok) {
        await fetchEmployees();
      }
    } catch (e: any) {
      setImportResult({ error: e.message });
    } finally {
      setImporting(false);
    }
  };

  const sampleCsvTemplate = `firstName,lastName,workEmail,legalEntityCode,branchCode,departmentCode,designationCode,annualCtc,pan,aadhaar,bankAccount,bankName
Amit,Kapoor,amit.kapoor@aiautomationlabs.com,AIAL_IN,BLR_HQ,ENG,SR_DEV,1600000,ABCDE9988K,9876 1122 3344,50100998811223,HDFC Bank
Neha,Sharma,neha.sharma@aiautomationlabs.com,AIAL_IN,BLR_HQ,HR,HR_LEAD,1500000,ABCDE9988L,9876 1122 3345,50100998811224,ICICI Bank`;

  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch =
      emp.displayName?.toLowerCase().includes(search.toLowerCase()) ||
      emp.employeeCode?.toLowerCase().includes(search.toLowerCase()) ||
      emp.workEmail?.toLowerCase().includes(search.toLowerCase());
    const matchesDept = selectedDept === 'ALL' || emp.departmentId === selectedDept;
    return matchesSearch && matchesDept;
  });

  return (
    <DashboardLayout title="Employee Master & Directory" subtitle="Manage employee profiles, identity, bank, and lifecycle">
      <div className="space-y-6">
        {/* Action Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search name, code, email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg text-xs py-1.5 px-3 focus:outline-none"
            >
              <option value="ALL">All Departments</option>
              {orgData?.departments?.map((d: any) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => {
                setCsvText(sampleCsvTemplate);
                setIsImportOpen(true);
              }}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs rounded-xl flex items-center gap-1.5 border border-slate-200 transition-colors"
            >
              <Upload className="h-3.5 w-3.5" />
              Import CSV
            </button>
            <button
              onClick={() => setIsAddOpen(true)}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-xl flex items-center gap-1.5 shadow-sm shadow-emerald-600/20 transition-colors"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Add Employee
            </button>
          </div>
        </div>

        {/* Employees Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Department & Role</th>
                  <th className="py-3 px-4">Branch Location</th>
                  <th className="py-3 px-4">Identity (Masked)</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEmployees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-slate-800 text-white font-bold flex items-center justify-center text-xs">
                          {emp.firstName[0]}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900">{emp.displayName}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{emp.employeeCode} • {emp.workEmail}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-800">{emp.designation?.title || '—'}</div>
                      <div className="text-[11px] text-slate-500">{emp.department?.name || '—'}</div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      <div>{emp.branchLocation?.name || 'Bengaluru HQ'}</div>
                      <div className="text-[11px] text-slate-400">{emp.branchLocation?.state || 'KARNATAKA'}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="text-slate-700 font-mono text-[11px]">
                        PAN: {emp.identity?.panNumber || '—'}
                      </div>
                      <div className="text-slate-500 font-mono text-[11px]">
                        Aadhaar: {emp.identity?.aadhaarNumber || '—'}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {emp.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => setSelectedEmp(emp)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 rounded-lg text-slate-700 font-medium transition-colors border border-slate-200"
                      >
                        View Profile
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* View Profile Drawer / Modal */}
        {selectedEmp && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-sm">
                    {selectedEmp.firstName[0]}
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 text-base">{selectedEmp.displayName}</h3>
                    <p className="text-xs text-slate-500 font-mono">{selectedEmp.employeeCode} • {selectedEmp.workEmail}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedEmp(null)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div>
                    <span className="text-slate-500 block">Department</span>
                    <span className="font-semibold text-slate-900">{selectedEmp.department?.name}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Designation</span>
                    <span className="font-semibold text-slate-900">{selectedEmp.designation?.title}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Branch & State</span>
                    <span className="font-semibold text-slate-900">{selectedEmp.branchLocation?.name} ({selectedEmp.branchLocation?.state})</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Reporting Manager</span>
                    <span className="font-semibold text-slate-900">{selectedEmp.reportingManager?.firstName ? `${selectedEmp.reportingManager.firstName} ${selectedEmp.reportingManager.lastName}` : 'Direct to CEO'}</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                  <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5 text-emerald-600" />
                    Identity & Compliance (RBAC Protected)
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>PAN: <span className="font-mono font-medium">{selectedEmp.identity?.panNumber || '—'}</span></div>
                    <div>Aadhaar: <span className="font-mono font-medium">{selectedEmp.identity?.aadhaarNumber || '—'}</span></div>
                    <div>UAN: <span className="font-mono font-medium">{selectedEmp.identity?.uanNumber || '—'}</span></div>
                    <div>Bank Acc: <span className="font-mono font-medium">{selectedEmp.bank?.accountNumber || '—'}</span></div>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setSelectedEmp(null)}
                  className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Employee Modal */}
        {isAddOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 my-8">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
                <h3 className="font-semibold text-slate-900 text-base flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-emerald-600" />
                  Add New Employee
                </h3>
                <button onClick={() => setIsAddOpen(false)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleCreateEmployee} className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-medium text-slate-700 block mb-1">First Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                      placeholder="e.g. Rahul"
                    />
                  </div>
                  <div>
                    <label className="font-medium text-slate-700 block mb-1">Last Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                      placeholder="e.g. Verma"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-medium text-slate-700 block mb-1">Work Email *</label>
                    <input
                      type="email"
                      required
                      value={formData.workEmail}
                      onChange={(e) => setFormData({ ...formData, workEmail: e.target.value })}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                      placeholder="rahul.verma@aiautomationlabs.com"
                    />
                  </div>
                  <div>
                    <label className="font-medium text-slate-700 block mb-1">Mobile Phone</label>
                    <input
                      type="text"
                      value={formData.mobilePhone}
                      onChange={(e) => setFormData({ ...formData, mobilePhone: e.target.value })}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                      placeholder="+91 9876543210"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-medium text-slate-700 block mb-1">Department *</label>
                    <select
                      value={formData.departmentId}
                      onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                    >
                      {orgData?.departments?.map((d: any) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="font-medium text-slate-700 block mb-1">Designation *</label>
                    <select
                      value={formData.designationId}
                      onChange={(e) => setFormData({ ...formData, designationId: e.target.value })}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                    >
                      {orgData?.designations?.map((d: any) => (
                        <option key={d.id} value={d.id}>{d.title}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-medium text-slate-700 block mb-1">Branch Location *</label>
                    <select
                      value={formData.branchLocationId}
                      onChange={(e) => setFormData({ ...formData, branchLocationId: e.target.value })}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                    >
                      {orgData?.branchLocations?.map((b: any) => (
                        <option key={b.id} value={b.id}>{b.name} ({b.state})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="font-medium text-slate-700 block mb-1">Legal Entity *</label>
                    <select
                      value={formData.legalEntityId}
                      onChange={(e) => setFormData({ ...formData, legalEntityId: e.target.value })}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                    >
                      {orgData?.legalEntities?.map((l: any) => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <span className="font-semibold text-slate-700 block">Identity & Banking</span>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="PAN Number (e.g. ABCDE1234F)"
                      value={formData.panNumber}
                      onChange={(e) => setFormData({ ...formData, panNumber: e.target.value })}
                      className="p-2 bg-white border border-slate-200 rounded-lg"
                    />
                    <input
                      type="text"
                      placeholder="Aadhaar Number (e.g. 9876 5432 1098)"
                      value={formData.aadhaarNumber}
                      onChange={(e) => setFormData({ ...formData, aadhaarNumber: e.target.value })}
                      className="p-2 bg-white border border-slate-200 rounded-lg"
                    />
                    <input
                      type="text"
                      placeholder="Bank Account Number"
                      value={formData.bankAccountNumber}
                      onChange={(e) => setFormData({ ...formData, bankAccountNumber: e.target.value })}
                      className="p-2 bg-white border border-slate-200 rounded-lg"
                    />
                    <input
                      type="text"
                      placeholder="Bank Name"
                      value={formData.bankName}
                      onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                      className="p-2 bg-white border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setIsAddOpen(false)}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium shadow-sm shadow-emerald-600/20"
                  >
                    Create Employee
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* CSV Import Modal */}
        {isImportOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h3 className="font-semibold text-slate-900 text-base flex items-center gap-2">
                  <Upload className="h-5 w-5 text-emerald-600" />
                  Bulk Employee Import (CSV)
                </h3>
                <button onClick={() => setIsImportOpen(false)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <p className="text-xs text-slate-500">
                Paste your CSV content below. Required columns: <code>firstName, lastName, workEmail, legalEntityCode, branchCode, departmentCode, designationCode</code>
              </p>

              <textarea
                rows={8}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                className="w-full p-3 font-mono text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="firstName,lastName,workEmail..."
              />

              {importResult && (
                <div className={`p-3 rounded-xl text-xs ${importResult.failedCount > 0 ? 'bg-amber-50 border border-amber-200 text-amber-900' : 'bg-emerald-50 border border-emerald-200 text-emerald-900'}`}>
                  <div className="font-semibold mb-1">
                    {importResult.success ? `✅ Processed ${importResult.importedCount} employees successfully!` : `❌ Error: ${importResult.error}`}
                  </div>
                  {importResult.failedCount > 0 && (
                    <div className="space-y-1 mt-2 text-rose-700">
                      <div>Failed rows ({importResult.failedCount}):</div>
                      {importResult.errors?.map((err: any, idx: number) => (
                        <div key={idx}>• Row {err.row}: {err.message} ({err.email})</div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setIsImportOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-medium"
                >
                  Close
                </button>
                <button
                  disabled={importing || !csvText}
                  onClick={handleCsvImport}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-medium shadow-sm shadow-emerald-600/20 flex items-center gap-1.5"
                >
                  {importing ? 'Importing...' : 'Start Import'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
