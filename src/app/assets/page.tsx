"use client";

import React, { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";

interface Asset {
  id: string;
  asset_tag: string;
  name: string;
  category: string;
  serial_number: string;
  model: string;
  purchase_date: string;
  purchase_cost: number;
  status: "AVAILABLE" | "ASSIGNED" | "MAINTENANCE" | "RETIRED";
  assignments?: {
    id: string;
    employee: { id: string; first_name: string; last_name: string; employee_code: string };
    assigned_date: string;
    returned_date?: string;
    status: string;
  }[];
}

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  employee_code: string;
}

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assigneeId, setAssigneeId] = useState("");
  const [assignCondition, setAssignCondition] = useState("Brand New / Pristine");
  const [filterCategory, setFilterCategory] = useState("ALL");

  const fetchAssetsAndEmployees = async () => {
    try {
      setLoading(true);
      const [resAssets, resEmps] = await Promise.all([
        fetch("/api/assets"),
        fetch("/api/employees"),
      ]);
      const assetsData = await resAssets.json();
      const empsData = await resEmps.json();

      if (assetsData.assets) setAssets(assetsData.assets);
      if (empsData.employees) setEmployees(empsData.employees);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssetsAndEmployees();
  }, []);

  const handleAssign = async () => {
    if (!selectedAsset || !assigneeId) return;
    try {
      const res = await fetch(`/api/assets/${selectedAsset.id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: assigneeId,
          condition: assignCondition,
        }),
      });
      if (res.ok) {
        setShowAssignModal(false);
        setSelectedAsset(null);
        await fetchAssetsAndEmployees();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleReturn = async (assetId: string) => {
    try {
      const res = await fetch(`/api/assets/${assetId}/return`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          returnCondition: "Good - Inspected",
          remarks: "Returned during normal workflow / clearance",
        }),
      });
      if (res.ok) {
        await fetchAssetsAndEmployees();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const filteredAssets = assets.filter((a) => {
    if (filterCategory === "ALL") return true;
    return a.category === filterCategory;
  });

  const totalValue = assets.reduce((acc, a) => acc + (a.purchase_cost || 0), 0);
  const assignedCount = assets.filter((a) => a.status === "ASSIGNED").length;
  const availableCount = assets.filter((a) => a.status === "AVAILABLE").length;

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 antialiased font-sans overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-y-auto">
        {/* Header */}
        <header className="px-8 py-5 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-20 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400">
              Hardware & IT Asset Management
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Track lifecycle, assignments, warranty, serialized hardware & automated exit clearance reconciliation
            </p>
          </div>
          <div className="flex gap-3">
            <span className="px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-slate-300 text-xs font-semibold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              {assets.length} Total Inventory Units
            </span>
          </div>
        </header>

        <div className="p-8 space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 shadow-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Asset Value</span>
              <p className="text-3xl font-extrabold text-emerald-400 mt-2">
                ₹{totalValue.toLocaleString("en-IN")}
              </p>
              <span className="text-xs text-slate-500 mt-1 inline-block">Capital IT Equipment</span>
            </div>
            <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 shadow-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Assigned / In Use</span>
              <p className="text-3xl font-extrabold text-indigo-400 mt-2">{assignedCount}</p>
              <span className="text-xs text-indigo-300/80 mt-1 inline-block">Deployed to employees</span>
            </div>
            <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 shadow-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Available in Pool</span>
              <p className="text-3xl font-extrabold text-blue-400 mt-2">{availableCount}</p>
              <span className="text-xs text-blue-300/80 mt-1 inline-block">Ready for onboarding</span>
            </div>
            <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 shadow-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Exit Clearance Link</span>
              <p className="text-3xl font-extrabold text-purple-400 mt-2">100%</p>
              <span className="text-xs text-purple-300/80 mt-1 inline-block">Auto-checks unreturned items</span>
            </div>
          </div>

          {/* Category Filter */}
          <div className="flex gap-2 border-b border-slate-800 pb-2">
            {["ALL", "LAPTOP", "MONITOR", "MOBILE", "ACCESSORY"].map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`px-4 py-2 rounded-xl text-xs font-medium transition-all ${
                  filterCategory === cat
                    ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                }`}
              >
                {cat === "ALL" ? "All Categories" : cat}
              </button>
            ))}
          </div>

          {/* Asset Grid / Table */}
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 backdrop-blur-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-3.5">Asset Tag / Name</th>
                    <th className="px-6 py-3.5">Category & Model</th>
                    <th className="px-6 py-3.5">Serial Number</th>
                    <th className="px-6 py-3.5">Purchase Cost</th>
                    <th className="px-6 py-3.5">Current Status</th>
                    <th className="px-6 py-3.5">Assigned Employee</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                        Loading asset inventory...
                      </td>
                    </tr>
                  ) : filteredAssets.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                        No assets found in this category.
                      </td>
                    </tr>
                  ) : (
                    filteredAssets.map((asset) => {
                      const activeAssignment = asset.assignments?.find((a) => a.status === "ASSIGNED");
                      return (
                        <tr key={asset.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-semibold text-slate-100">{asset.name}</div>
                            <div className="text-slate-400 text-[11px] font-mono">{asset.asset_tag}</div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px] font-medium mr-2">
                              {asset.category}
                            </span>
                            <span className="text-slate-400 text-[11px]">{asset.model}</span>
                          </td>
                          <td className="px-6 py-4 font-mono text-[11px] text-slate-400">
                            {asset.serial_number}
                          </td>
                          <td className="px-6 py-4 font-semibold text-slate-200">
                            ₹{asset.purchase_cost?.toLocaleString("en-IN")}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase ${
                                asset.status === "AVAILABLE"
                                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                  : asset.status === "ASSIGNED"
                                  ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                                  : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                              }`}
                            >
                              {asset.status}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            {activeAssignment ? (
                              <div>
                                <div className="font-medium text-slate-200">
                                  {activeAssignment.employee?.first_name} {activeAssignment.employee?.last_name}
                                </div>
                                <div className="text-[10px] text-slate-500">
                                  Since {new Date(activeAssignment.assigned_date).toLocaleDateString("en-IN")}
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-500 italic text-[11px]">Unassigned (In IT Store)</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right space-x-2">
                            {asset.status === "AVAILABLE" ? (
                              <button
                                onClick={() => {
                                  setSelectedAsset(asset);
                                  setShowAssignModal(true);
                                }}
                                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs shadow-sm transition"
                              >
                                Assign
                              </button>
                            ) : asset.status === "ASSIGNED" ? (
                              <button
                                onClick={() => handleReturn(asset.id)}
                                className="px-3 py-1.5 rounded-lg bg-amber-900/40 hover:bg-amber-900/60 border border-amber-800/80 text-amber-300 font-medium text-xs transition"
                              >
                                Return Asset
                              </button>
                            ) : (
                              <span className="text-slate-500 text-xs">Locked</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Assignment Modal */}
      {showAssignModal && selectedAsset && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-100">Assign Asset</h3>
                <p className="text-xs text-slate-400">
                  {selectedAsset.name} ({selectedAsset.asset_tag})
                </p>
              </div>
              <button
                onClick={() => setShowAssignModal(false)}
                className="text-slate-400 hover:text-slate-200 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Select Employee</label>
                <select
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">-- Choose Employee --</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name} ({emp.employee_code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Handover Condition</label>
                <input
                  type="text"
                  value={assignCondition}
                  onChange={(e) => setAssignCondition(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-800">
              <button
                disabled={!assigneeId}
                onClick={handleAssign}
                className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs shadow-md shadow-indigo-500/20"
              >
                Confirm Asset Assignment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
