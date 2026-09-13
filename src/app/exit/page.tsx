"use client";

import React, { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";

interface ExitRequest {
  id: string;
  resignation_date: string;
  last_working_day: string;
  reason: string;
  status: string;
  notice_period_required: number;
  notice_period_served: number;
  notice_shortfall_days: number;
  it_clearance: string;
  finance_clearance: string;
  admin_clearance: string;
  hr_clearance: string;
  employee: {
    id: string;
    first_name: string;
    last_name: string;
    employee_code: string;
    department: { name: string };
    designation: { title: string };
    date_of_joining: string;
  };
  fnf_settlement?: {
    id: string;
    payable_days: number;
    earned_salary: number;
    leave_encashment_amount: number;
    gratuity_amount: number;
    notice_recovery_amount: number;
    net_payable: number;
    status: string;
    settled_date?: string;
  };
}

export default function ExitPage() {
  const [exits, setExits] = useState<ExitRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedExit, setSelectedExit] = useState<ExitRequest | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [activeTab, setActiveTab] = useState<"ACTIVE" | "SETTLED">("ACTIVE");

  const fetchExits = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/exit/requests");
      const data = await res.json();
      if (data.exitRequests) setExits(data.exitRequests);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExits();
  }, []);

  const handleCalculateFnF = async (exitId: string) => {
    try {
      setCalculating(true);
      const res = await fetch(`/api/exit/requests/${exitId}/calculate`, {
        method: "POST",
      });
      if (res.ok) {
        await fetchExits();
        const updated = await fetch("/api/exit/requests").then((r) => r.json());
        const found = updated.exitRequests?.find((e: ExitRequest) => e.id === exitId);
        if (found) setSelectedExit(found);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCalculating(false);
    }
  };

  const handleSettleFnF = async (exitId: string) => {
    try {
      const res = await fetch(`/api/exit/requests/${exitId}/settle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentReference: `NEFT-FNF-${Date.now().toString().slice(-6)}` }),
      });
      if (res.ok) {
        await fetchExits();
        setSelectedExit(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const filteredExits = exits.filter((e) => {
    if (activeTab === "ACTIVE") return e.status !== "SETTLED";
    return e.status === "SETTLED";
  });

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 antialiased font-sans overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-y-auto">
        {/* Header */}
        <header className="px-8 py-5 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-20 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400">
              Separation & Full & Final (F&F) Settlement
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Automated notice period recovery, leave balance encashment, statutory gratuity & multi-dept clearance
            </p>
          </div>
          <div className="flex gap-2">
            <span className="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold">
              {exits.length} Total Exit Cases
            </span>
          </div>
        </header>

        <div className="p-8 space-y-6">
          {/* Summary KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 shadow-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Active Resignations</span>
              <p className="text-3xl font-extrabold text-amber-400 mt-2">
                {exits.filter((e) => e.status === "RESIGNED" || e.status === "NOTICE_PERIOD").length}
              </p>
              <span className="text-xs text-amber-300/80 mt-1 inline-block">Serving notice period</span>
            </div>
            <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 shadow-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">In Clearance Queue</span>
              <p className="text-3xl font-extrabold text-indigo-400 mt-2">
                {exits.filter((e) => e.status === "CLEARANCE").length}
              </p>
              <span className="text-xs text-indigo-300/80 mt-1 inline-block">IT / Finance / HR checks</span>
            </div>
            <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 shadow-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Ready for F&F Payout</span>
              <p className="text-3xl font-extrabold text-blue-400 mt-2">
                {exits.filter((e) => e.status === "FNF_PENDING").length}
              </p>
              <span className="text-xs text-blue-300/80 mt-1 inline-block">Statements calculated</span>
            </div>
            <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 shadow-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Fully Settled</span>
              <p className="text-3xl font-extrabold text-emerald-400 mt-2">
                {exits.filter((e) => e.status === "SETTLED").length}
              </p>
              <span className="text-xs text-emerald-300/80 mt-1 inline-block">Relieved & Archived</span>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-2 border-b border-slate-800 pb-2">
            {[
              { key: "ACTIVE", label: "Active Exit Pipeline" },
              { key: "SETTLED", label: "Settled & Relieved Records" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`px-4 py-2 rounded-xl text-xs font-medium transition-all ${
                  activeTab === tab.key
                    ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Exit Records Table */}
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 backdrop-blur-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-3.5">Employee</th>
                    <th className="px-6 py-3.5">Designation & Dept</th>
                    <th className="px-6 py-3.5">Resigned Date</th>
                    <th className="px-6 py-3.5">Last Working Day</th>
                    <th className="px-6 py-3.5">Notice Status</th>
                    <th className="px-6 py-3.5">Clearances</th>
                    <th className="px-6 py-3.5">F&F Net Settlement</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-12 text-center text-slate-500">
                        Loading exit cases...
                      </td>
                    </tr>
                  ) : filteredExits.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-12 text-center text-slate-500">
                        No exit records in this view.
                      </td>
                    </tr>
                  ) : (
                    filteredExits.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-slate-100">
                            {item.employee?.first_name} {item.employee?.last_name}
                          </div>
                          <div className="text-[11px] text-slate-500">{item.employee?.employee_code}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-medium text-slate-300">{item.employee?.designation?.title}</div>
                          <div className="text-[10px] text-slate-500">{item.employee?.department?.name}</div>
                        </td>
                        <td className="px-6 py-4 text-slate-400">
                          {new Date(item.resignation_date).toLocaleDateString("en-IN")}
                        </td>
                        <td className="px-6 py-4 text-slate-200 font-medium">
                          {new Date(item.last_working_day).toLocaleDateString("en-IN")}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-slate-200">
                            {item.notice_period_served} / {item.notice_period_required} days
                          </div>
                          {item.notice_shortfall_days > 0 ? (
                            <div className="text-[10px] text-rose-400 font-semibold">
                              Shortfall: {item.notice_shortfall_days}d (Recoverable)
                            </div>
                          ) : (
                            <div className="text-[10px] text-emerald-400">Full notice served</div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-1">
                            <span
                              title="IT Clearance"
                              className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                                item.it_clearance === "CLEARED"
                                  ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                                  : "bg-amber-950 text-amber-400 border border-amber-800"
                              }`}
                            >
                              IT
                            </span>
                            <span
                              title="Finance Clearance"
                              className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                                item.finance_clearance === "CLEARED"
                                  ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                                  : "bg-amber-950 text-amber-400 border border-amber-800"
                              }`}
                            >
                              FN
                            </span>
                            <span
                              title="Admin Clearance"
                              className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                                item.admin_clearance === "CLEARED"
                                  ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                                  : "bg-amber-950 text-amber-400 border border-amber-800"
                              }`}
                            >
                              AD
                            </span>
                            <span
                              title="HR Clearance"
                              className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                                item.hr_clearance === "CLEARED"
                                  ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                                  : "bg-amber-950 text-amber-400 border border-amber-800"
                              }`}
                            >
                              HR
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {item.fnf_settlement ? (
                            <div>
                              <div className="font-bold text-emerald-400 text-sm">
                                ₹{item.fnf_settlement.net_payable?.toLocaleString("en-IN")}
                              </div>
                              <div className="text-[10px] text-slate-500">
                                Status: {item.fnf_settlement.status}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-500 italic text-[11px]">Not Calculated</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase ${
                              item.status === "SETTLED"
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : item.status === "FNF_PENDING"
                                ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right space-x-2">
                          <button
                            onClick={() => setSelectedExit(item)}
                            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition"
                          >
                            F&F Statement
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

      {/* F&F Settlement Statement Modal */}
      {selectedExit && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-100">Full & Final Settlement Worksheet</h3>
                <p className="text-xs text-slate-400">
                  {selectedExit.employee?.first_name} {selectedExit.employee?.last_name} ({selectedExit.employee?.employee_code})
                </p>
              </div>
              <button
                onClick={() => setSelectedExit(null)}
                className="text-slate-400 hover:text-slate-200 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {/* Employee Tenure & Resignation Detail */}
            <div className="grid grid-cols-2 gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 text-xs">
              <div>
                <span className="text-slate-500 block">Date of Joining:</span>
                <span className="text-slate-200 font-medium">
                  {new Date(selectedExit.employee?.date_of_joining).toLocaleDateString("en-IN")}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Last Working Date:</span>
                <span className="text-slate-200 font-medium">
                  {new Date(selectedExit.last_working_day).toLocaleDateString("en-IN")}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Notice Required vs Served:</span>
                <span className="text-slate-200 font-medium">
                  {selectedExit.notice_period_required}d required / {selectedExit.notice_period_served}d served
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Notice Shortfall:</span>
                <span
                  className={`font-semibold ${
                    selectedExit.notice_shortfall_days > 0 ? "text-rose-400" : "text-emerald-400"
                  }`}
                >
                  {selectedExit.notice_shortfall_days} days
                </span>
              </div>
            </div>

            {/* Settlement Breakdown Sheet */}
            {selectedExit.fnf_settlement ? (
              <div className="space-y-2 text-xs">
                <h4 className="font-semibold text-slate-300 uppercase tracking-wider text-[11px]">
                  Computation Breakdown
                </h4>
                <div className="border border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-800/60 bg-slate-950/40">
                  <div className="flex justify-between p-3">
                    <span className="text-slate-400">Earned Salary (Prorated for {selectedExit.fnf_settlement.payable_days} days):</span>
                    <span className="font-semibold text-slate-200">
                      ₹{selectedExit.fnf_settlement.earned_salary?.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="flex justify-between p-3">
                    <span className="text-slate-400">Leave Balance Encashment (Earned/Paid Leave):</span>
                    <span className="font-semibold text-emerald-400">
                      + ₹{selectedExit.fnf_settlement.leave_encashment_amount?.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="flex justify-between p-3">
                    <span className="text-slate-400">Statutory Gratuity (Payment of Gratuity Act 1972):</span>
                    <span className="font-semibold text-emerald-400">
                      + ₹{selectedExit.fnf_settlement.gratuity_amount?.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="flex justify-between p-3 bg-rose-950/20">
                    <span className="text-rose-300">Notice Period Recovery (Shortfall Deduction):</span>
                    <span className="font-semibold text-rose-400">
                      - ₹{selectedExit.fnf_settlement.notice_recovery_amount?.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="flex justify-between p-3 bg-indigo-950/40 text-sm">
                    <span className="font-bold text-white">Net Final Settlement Payout:</span>
                    <span className="font-extrabold text-emerald-400">
                      ₹{selectedExit.fnf_settlement.net_payable?.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center bg-slate-950/50 rounded-xl border border-slate-800">
                <p className="text-xs text-slate-400 mb-3">
                  Click below to trigger automated F&F computation engine (bridges leave ledger, salary structure, and gratuity rules).
                </p>
                <button
                  disabled={calculating}
                  onClick={() => handleCalculateFnF(selectedExit.id)}
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium rounded-xl text-xs shadow-md transition"
                >
                  {calculating ? "Calculating..." : "⚡ Run Automated F&F Engine"}
                </button>
              </div>
            )}

            {/* Settlement Action */}
            <div className="flex gap-2 pt-2 border-t border-slate-800">
              {selectedExit.fnf_settlement && selectedExit.status !== "SETTLED" && (
                <button
                  onClick={() => handleSettleFnF(selectedExit.id)}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-500/20"
                >
                  ✓ Approve Payout & Mark Employee as Relieved
                </button>
              )}
              {selectedExit.status === "SETTLED" && (
                <div className="flex-1 p-2 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-center text-xs text-emerald-400 font-semibold">
                  ✓ Full and Final Settlement Executed & Relieving Letter Dispatched
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
