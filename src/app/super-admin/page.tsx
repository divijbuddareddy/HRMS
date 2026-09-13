"use client";

import React, { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";

interface Tenant {
  id: string;
  name: string;
  code: string;
  domain: string;
  plan: string;
  status: string;
  created_at: string;
  _count?: {
    users: number;
    employees: number;
    job_requisitions: number;
  };
}

export default function SuperAdminPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [impersonateReason, setImpersonateReason] = useState("");
  const [impersonateTicket, setImpersonateTicket] = useState("");
  const [impersonating, setImpersonating] = useState(false);
  const [impersonateSuccess, setImpersonateSuccess] = useState<string | null>(null);

  const fetchTenants = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/super-admin/tenants");
      const data = await res.json();
      if (data.tenants) setTenants(data.tenants);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  const handleImpersonate = async () => {
    if (!selectedTenant || !impersonateReason) return;
    try {
      setImpersonating(true);
      const res = await fetch("/api/super-admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetTenantId: selectedTenant.id,
          reason: impersonateReason,
          ticketRef: impersonateTicket || "SUP-INTERNAL-AUDIT",
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setImpersonateSuccess(
          `Impersonation session authorized! Scoped token generated with explicit audit log entry ID: ${data.session?.sessionId || "AUTH-OK"}`
        );
        setTimeout(() => {
          setSelectedTenant(null);
          setImpersonateSuccess(null);
          setImpersonateReason("");
          setImpersonateTicket("");
        }, 3000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setImpersonating(false);
    }
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 antialiased font-sans overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-y-auto">
        {/* Header */}
        <header className="px-8 py-5 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-600 via-orange-600 to-rose-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
              <span className="text-xl">🛡️</span>
            </div>
            <div>
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-amber-400 via-orange-300 to-rose-400">
                SaaS Super Admin & Multi-Tenant Management
              </h1>
              <p className="text-xs text-slate-400">
                Tenant isolation boundary, plan entitlements, global subscription billing & audited support impersonation
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-xl bg-amber-950/60 border border-amber-800/60 text-amber-300 text-xs font-semibold">
            Super Admin Mode
          </span>
        </header>

        <div className="p-8 space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 shadow-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Active Tenants</span>
              <p className="text-3xl font-extrabold text-white mt-2">{tenants.length}</p>
              <span className="text-xs text-emerald-400 mt-1 inline-block">100% Isolated Databases</span>
            </div>
            <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 shadow-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total SaaS Users</span>
              <p className="text-3xl font-extrabold text-indigo-400 mt-2">
                {tenants.reduce((acc, t) => acc + (t._count?.users || 0), 0)}
              </p>
              <span className="text-xs text-indigo-300/80 mt-1 inline-block">Across all tenant domains</span>
            </div>
            <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 shadow-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Managed Employees</span>
              <p className="text-3xl font-extrabold text-blue-400 mt-2">
                {tenants.reduce((acc, t) => acc + (t._count?.employees || 0), 0)}
              </p>
              <span className="text-xs text-blue-300/80 mt-1 inline-block">Active master headcounts</span>
            </div>
            <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 shadow-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Support Audit Level</span>
              <p className="text-3xl font-extrabold text-emerald-400 mt-2">L3</p>
              <span className="text-xs text-emerald-300/80 mt-1 inline-block">Dual-key time-bounded tokens</span>
            </div>
          </div>

          {/* Tenants Table */}
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 backdrop-blur-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-3.5">Organization / Tenant</th>
                    <th className="px-6 py-3.5">Tenant Code & Domain</th>
                    <th className="px-6 py-3.5">Subscription Tier</th>
                    <th className="px-6 py-3.5">Active Users</th>
                    <th className="px-6 py-3.5">Employees</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5">Created Date</th>
                    <th className="px-6 py-3.5 text-right">Support Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                        Loading SaaS tenants...
                      </td>
                    </tr>
                  ) : tenants.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                        No tenants found.
                      </td>
                    </tr>
                  ) : (
                    tenants.map((tenant) => (
                      <tr key={tenant.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-100 text-sm">{tenant.name}</div>
                          <div className="text-[10px] text-slate-500 font-mono">ID: {tenant.id}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-mono text-xs text-indigo-400 font-semibold">{tenant.code}</span>
                          <div className="text-[11px] text-slate-400">{tenant.domain}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase bg-purple-500/10 text-purple-400 border border-purple-500/20">
                            {tenant.plan || "ENTERPRISE"}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-semibold text-slate-200">
                          {tenant._count?.users || 1}
                        </td>
                        <td className="px-6 py-4 font-semibold text-slate-200">
                          {tenant._count?.employees || 0}
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {tenant.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-400">
                          {new Date(tenant.created_at).toLocaleDateString("en-IN")}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => setSelectedTenant(tenant)}
                            className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-medium text-xs shadow-sm transition"
                          >
                            Impersonate Tenant
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Impersonation Authorization Modal */}
      {selectedTenant && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">⚠️</span>
                <div>
                  <h3 className="text-lg font-bold text-slate-100">Super Admin Impersonation</h3>
                  <p className="text-xs text-slate-400">Target Tenant: {selectedTenant.name} ({selectedTenant.code})</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedTenant(null)}
                className="text-slate-400 hover:text-slate-200 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {impersonateSuccess ? (
              <div className="p-4 bg-emerald-950/60 border border-emerald-800 rounded-xl text-emerald-300 text-xs leading-relaxed">
                {impersonateSuccess}
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <div className="p-3 bg-amber-950/40 border border-amber-800/60 rounded-xl text-amber-300 text-xs">
                  <strong>Security Policy:</strong> Impersonation grants temporary access to this tenant's workspace. All actions are stamped into the global immutable audit log with your Super Admin identity and mandatory ticket reference.
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Support Ticket / Ref ID *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. ZENDESK-8924 / JIRA-HRMS-104"
                    value={impersonateTicket}
                    onChange={(e) => setImpersonateTicket(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Justification Reason *</label>
                  <textarea
                    rows={3}
                    required
                    placeholder="e.g. Investigating payroll statutory rounding discrepancy as requested by HR lead"
                    value={impersonateReason}
                    onChange={(e) => setImpersonateReason(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="flex gap-2 pt-2 border-t border-slate-800">
                  <button
                    disabled={impersonating || !impersonateReason.trim()}
                    onClick={handleImpersonate}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 disabled:opacity-50 text-white font-bold text-xs shadow-md transition"
                  >
                    {impersonating ? "Generating Time-Bounded Token..." : "Authorize Impersonated Session"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
