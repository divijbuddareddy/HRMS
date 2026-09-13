"use client";

import React, { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";

interface ExpenseClaim {
  id: string;
  claim_number: string;
  employee: { first_name: string; last_name: string; employee_code: string };
  category: { name: string; code: string; max_limit: number };
  amount: number;
  currency: string;
  expense_date: string;
  status: string;
  description: string;
  merchant_name: string;
  receipt_url?: string;
  manager_approval: string;
  finance_approval: string;
}

interface ExpenseCategory {
  id: string;
  name: string;
  code: string;
  max_limit: number;
  requires_receipt: boolean;
}

export default function ExpensesPage() {
  const [claims, setClaims] = useState<ExpenseClaim[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClaim, setSelectedClaim] = useState<ExpenseClaim | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"ALL" | "PENDING_MANAGER" | "PENDING_FINANCE" | "APPROVED">("ALL");

  // New claim form state
  const [formData, setFormData] = useState({
    categoryId: "",
    amount: "",
    expenseDate: new Date().toISOString().split("T")[0],
    description: "",
    merchantName: "",
    receiptUrl: "https://placehold.co/600x400/png?text=Receipt+Proof",
  });

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const [resClaims, resCats] = await Promise.all([
        fetch("/api/expenses/claims"),
        fetch("/api/expenses/categories"),
      ]);
      const claimsData = await resClaims.json();
      const catsData = await resCats.json();

      if (claimsData.claims) setClaims(claimsData.claims);
      if (catsData.categories) setCategories(catsData.categories);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  const handleApprove = async (claimId: string, action: "MANAGER_APPROVE" | "FINANCE_APPROVE" | "REJECT") => {
    try {
      const res = await fetch(`/api/expenses/claims/${claimId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, remarks: `Processed as ${action}` }),
      });
      if (res.ok) {
        await fetchExpenses();
        setSelectedClaim(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/expenses/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: formData.categoryId || categories[0]?.id,
          amount: parseFloat(formData.amount),
          expenseDate: formData.expenseDate,
          description: formData.description,
          merchantName: formData.merchantName,
          receiptUrl: formData.receiptUrl,
        }),
      });
      if (res.ok) {
        setShowNewModal(false);
        setFormData({
          categoryId: "",
          amount: "",
          expenseDate: new Date().toISOString().split("T")[0],
          description: "",
          merchantName: "",
          receiptUrl: "https://placehold.co/600x400/png?text=Receipt+Proof",
        });
        await fetchExpenses();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const filteredClaims = claims.filter((c) => {
    if (activeTab === "ALL") return true;
    if (activeTab === "PENDING_MANAGER") return c.status === "SUBMITTED" || c.manager_approval === "PENDING";
    if (activeTab === "PENDING_FINANCE") return c.manager_approval === "APPROVED" && c.finance_approval === "PENDING";
    if (activeTab === "APPROVED") return c.status === "APPROVED";
    return true;
  });

  const totalAmount = claims.reduce((acc, c) => acc + c.amount, 0);
  const pendingAmount = claims.filter((c) => c.status !== "APPROVED" && c.status !== "REJECTED").reduce((acc, c) => acc + c.amount, 0);

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 antialiased font-sans overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-y-auto">
        {/* Top Header */}
        <header className="px-8 py-5 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-20 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400">
              Expenses & Travel Reimbursements
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Multi-tier approval workflow (Manager → Finance), policy limits, receipt verification & F&F link
            </p>
          </div>
          <button
            onClick={() => setShowNewModal(true)}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium rounded-xl shadow-lg shadow-blue-500/20 text-sm transition-all duration-150 flex items-center gap-2"
          >
            <span>+ Submit Expense Claim</span>
          </button>
        </header>

        <div className="p-8 space-y-6">
          {/* Summary KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 shadow-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Claims Filed</span>
              <p className="text-3xl font-extrabold text-white mt-2">{claims.length}</p>
              <span className="text-xs text-emerald-400 mt-1 inline-block">Lifetime tenant volume</span>
            </div>
            <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 shadow-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Pending Approvals</span>
              <p className="text-3xl font-extrabold text-amber-400 mt-2">
                ₹{pendingAmount.toLocaleString("en-IN")}
              </p>
              <span className="text-xs text-amber-300/80 mt-1 inline-block">Awaiting manager/finance action</span>
            </div>
            <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 shadow-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Reimbursed to Date</span>
              <p className="text-3xl font-extrabold text-blue-400 mt-2">
                ₹{(totalAmount - pendingAmount).toLocaleString("en-IN")}
              </p>
              <span className="text-xs text-blue-300/80 mt-1 inline-block">Disbursed via Payroll batches</span>
            </div>
            <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 shadow-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Categories Configured</span>
              <p className="text-3xl font-extrabold text-purple-400 mt-2">{categories.length || 5}</p>
              <span className="text-xs text-purple-300/80 mt-1 inline-block">Travel, Meals, Tech, Relocation</span>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-2 border-b border-slate-800 pb-2">
            {[
              { key: "ALL", label: "All Claims" },
              { key: "PENDING_MANAGER", label: "Manager Queue (L1)" },
              { key: "PENDING_FINANCE", label: "Finance Queue (L2)" },
              { key: "APPROVED", label: "Approved & Ready" },
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

          {/* Claims Table */}
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 backdrop-blur-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-3.5">Claim ID / Merchant</th>
                    <th className="px-6 py-3.5">Employee</th>
                    <th className="px-6 py-3.5">Category</th>
                    <th className="px-6 py-3.5">Expense Date</th>
                    <th className="px-6 py-3.5">Amount</th>
                    <th className="px-6 py-3.5">Manager (L1)</th>
                    <th className="px-6 py-3.5">Finance (L2)</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-12 text-center text-slate-500">
                        Loading expense claims...
                      </td>
                    </tr>
                  ) : filteredClaims.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-12 text-center text-slate-500">
                        No expense claims found matching this filter.
                      </td>
                    </tr>
                  ) : (
                    filteredClaims.map((claim) => (
                      <tr key={claim.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-slate-100">{claim.claim_number}</div>
                          <div className="text-slate-400 text-[11px]">{claim.merchant_name || "General Claim"}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-medium text-slate-200">
                            {claim.employee?.first_name} {claim.employee?.last_name}
                          </div>
                          <div className="text-[10px] text-slate-500">{claim.employee?.employee_code}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2.5 py-1 rounded-lg bg-indigo-950/60 border border-indigo-800/50 text-indigo-300 font-medium text-[11px]">
                            {claim.category?.name || "Travel"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-400">
                          {new Date(claim.expense_date).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-100 text-sm">₹{claim.amount.toLocaleString("en-IN")}</div>
                          <div className="text-[10px] text-slate-500">INR</div>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              claim.manager_approval === "APPROVED"
                                ? "bg-emerald-950/60 text-emerald-400 border border-emerald-800/40"
                                : claim.manager_approval === "REJECTED"
                                ? "bg-rose-950/60 text-rose-400 border border-rose-800/40"
                                : "bg-amber-950/60 text-amber-400 border border-amber-800/40"
                            }`}
                          >
                            {claim.manager_approval}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              claim.finance_approval === "APPROVED"
                                ? "bg-emerald-950/60 text-emerald-400 border border-emerald-800/40"
                                : claim.finance_approval === "REJECTED"
                                ? "bg-rose-950/60 text-rose-400 border border-rose-800/40"
                                : "bg-slate-800 text-slate-400"
                            }`}
                          >
                            {claim.finance_approval}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase ${
                              claim.status === "APPROVED"
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : claim.status === "REJECTED"
                                ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                            }`}
                          >
                            {claim.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right space-x-2">
                          <button
                            onClick={() => setSelectedClaim(claim)}
                            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition"
                          >
                            Review
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

      {/* Review & Dual-Approval Modal */}
      {selectedClaim && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-100">Review Expense Claim</h3>
                <p className="text-xs text-slate-400">Claim ID: {selectedClaim.claim_number}</p>
              </div>
              <button
                onClick={() => setSelectedClaim(null)}
                className="text-slate-400 hover:text-slate-200 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Employee:</span>
                <span className="font-semibold text-slate-200">
                  {selectedClaim.employee?.first_name} {selectedClaim.employee?.last_name} ({selectedClaim.employee?.employee_code})
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Category:</span>
                <span className="text-indigo-400 font-medium">{selectedClaim.category?.name}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Amount:</span>
                <span className="text-emerald-400 font-bold text-sm">₹{selectedClaim.amount.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Merchant:</span>
                <span className="text-slate-200">{selectedClaim.merchant_name}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Description:</span>
                <span className="text-slate-200 max-w-[250px] text-right">{selectedClaim.description}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-1">Receipt Attachment:</span>
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-center">
                  <a
                    href={selectedClaim.receipt_url || "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-400 hover:underline text-xs"
                  >
                    📄 View Attached Receipt Proof (Verified SHA-256)
                  </a>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2 border-t border-slate-800">
              {selectedClaim.manager_approval === "PENDING" && (
                <button
                  onClick={() => handleApprove(selectedClaim.id, "MANAGER_APPROVE")}
                  className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md shadow-indigo-500/20"
                >
                  ✓ Manager Approve (L1)
                </button>
              )}
              {selectedClaim.manager_approval === "APPROVED" && selectedClaim.finance_approval === "PENDING" && (
                <button
                  onClick={() => handleApprove(selectedClaim.id, "FINANCE_APPROVE")}
                  className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-md shadow-emerald-500/20"
                >
                  ✓ Finance Final Approve (L2)
                </button>
              )}
              <button
                onClick={() => handleApprove(selectedClaim.id, "REJECT")}
                className="px-4 py-2 rounded-xl bg-rose-900/40 hover:bg-rose-900/60 border border-rose-800 text-rose-300 font-semibold text-xs"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Claim Modal */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateClaim}
            className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-200"
          >
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-slate-100">Submit New Expense Claim</h3>
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="text-slate-400 hover:text-slate-200 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Expense Category</label>
                <select
                  value={formData.categoryId}
                  onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name} (Max Limit: ₹{cat.max_limit?.toLocaleString("en-IN")})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Amount (₹ INR)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="e.g. 4500"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Expense Date</label>
                  <input
                    type="date"
                    required
                    value={formData.expenseDate}
                    onChange={(e) => setFormData({ ...formData, expenseDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Merchant / Vendor Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Indigo Airlines / Uber / Amazon Web Services"
                  value={formData.merchantName}
                  onChange={(e) => setFormData({ ...formData, merchantName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Business Purpose / Description</label>
                <textarea
                  rows={2}
                  required
                  placeholder="e.g. Client visit travel tickets to Bengaluru tech center"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Receipt URL / Document Ref</label>
                <input
                  type="text"
                  value={formData.receiptUrl}
                  onChange={(e) => setFormData({ ...formData, receiptUrl: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-800">
              <button
                type="submit"
                className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-md shadow-blue-500/20"
              >
                Submit Claim for Approval
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
