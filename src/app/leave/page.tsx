'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import {
  Calendar,
  CalendarCheck,
  Plus,
  History,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  X,
  ShieldAlert,
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';

export default function LeavePage() {
  const { user } = useAuth();
  const [balances, setBalances] = useState<any[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [myRequests, setMyRequests] = useState<any[]>([]);
  const [teamRequests, setTeamRequests] = useState<any[]>([]);
  const [ledgerLogs, setLedgerLogs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'MY_LEAVES' | 'APPROVAL_QUEUE' | 'LEDGER_HISTORY'>('MY_LEAVES');
  const [loading, setLoading] = useState(true);

  // Apply modal
  const [isApplyOpen, setIsApplyOpen] = useState(false);
  const [leaveTypeId, setLeaveTypeId] = useState('');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [halfDaySession, setHalfDaySession] = useState<'FIRST_HALF' | 'SECOND_HALF'>('FIRST_HALF');
  const [reason, setReason] = useState('');
  const [applying, setApplying] = useState(false);

  const fetchLeaveData = async () => {
    setLoading(true);
    try {
      if (user?.employee?.id) {
        // Balances
        const bRes = await fetch(`/api/leave/balances?employeeId=${user.employee.id}`);
        if (bRes.ok) setBalances((await bRes.json()).balances || []);

        // Types
        const tRes = await fetch('/api/leave/types');
        if (tRes.ok) {
          const tData = await tRes.json();
          setLeaveTypes(tData.leaveTypes || []);
          if (tData.leaveTypes?.[0]) setLeaveTypeId(tData.leaveTypes[0].id);
        }

        // My requests
        const mRes = await fetch('/api/leave/requests?view=mine');
        if (mRes.ok) setMyRequests((await mRes.json()).requests || []);

        // Ledger logs
        const lRes = await fetch(`/api/leave/ledger?employeeId=${user.employee.id}`);
        if (lRes.ok) setLedgerLogs((await lRes.json()).transactions || []);
      }

      // Team requests if manager / admin
      const isManager = user?.roles.some((r) => ['MANAGER', 'HR_ADMIN', 'COMPANY_ADMIN'].includes(r));
      if (isManager) {
        const trRes = await fetch('/api/leave/requests?view=team');
        if (trRes.ok) setTeamRequests((await trRes.json()).requests || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaveData();
  }, [user]);

  const handleApplyLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    setApplying(true);
    try {
      const res = await fetch('/api/leave/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leaveTypeId,
          startDate,
          endDate,
          isHalfDay,
          halfDaySession: isHalfDay ? halfDaySession : undefined,
          reason,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setIsApplyOpen(false);
        setReason('');
        await fetchLeaveData();
      } else {
        alert(data.error || 'Failed to submit leave');
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setApplying(false);
    }
  };

  const handleApprove = async (id: string, decision: 'APPROVED' | 'REJECTED') => {
    try {
      const res = await fetch('/api/leave/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leaveRequestId: id,
          decision,
          notes: `${decision} by manager`,
        }),
      });

      if (res.ok) {
        await fetchLeaveData();
      } else {
        const d = await res.json();
        alert(d.error || 'Approval failed');
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const selectedPolicy = leaveTypes.find((t) => t.id === leaveTypeId)?.policy;

  return (
    <DashboardLayout title="Leave Management & Ledger" subtitle="Data-driven leave policies, double-entry ledger, and approvals">
      <div className="space-y-6">
        {/* Balance Cards Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {balances.map((b) => (
            <div key={b.leaveTypeId} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-semibold text-slate-700">{b.leaveTypeName}</span>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                  {b.leaveTypeCode}
                </span>
              </div>
              <div className="text-2xl font-black text-slate-900">{b.currentBalance}</div>
              <div className="text-[11px] text-slate-400 mt-1 flex justify-between">
                <span>Quota: {b.annualQuota}d</span>
                <span>Consumed: {b.totalConsumed}d</span>
              </div>
            </div>
          ))}
        </div>

        {/* Top Action & Tab Strip */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('MY_LEAVES')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-colors ${
                activeTab === 'MY_LEAVES' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              My Leaves & History
            </button>
            <button
              onClick={() => setActiveTab('APPROVAL_QUEUE')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 ${
                activeTab === 'APPROVAL_QUEUE' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Approval Queue
              {teamRequests.filter((r) => r.status === 'PENDING').length > 0 && (
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('LEDGER_HISTORY')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-colors ${
                activeTab === 'LEDGER_HISTORY' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Double-Entry Ledger
            </button>
          </div>

          <button
            onClick={() => setIsApplyOpen(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-xl shadow-sm shadow-emerald-600/20 flex items-center gap-1.5 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Apply Leave
          </button>
        </div>

        {/* Tab 1: My Leaves */}
        {activeTab === 'MY_LEAVES' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold">
                  <tr>
                    <th className="py-3 px-4">Leave Type</th>
                    <th className="py-3 px-4">Duration</th>
                    <th className="py-3 px-4">Total Days</th>
                    <th className="py-3 px-4">Reason</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Submitted At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {myRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-semibold text-slate-900">{req.leaveType?.name}</td>
                      <td className="py-3 px-4 text-slate-700">
                        {format(new Date(req.startDate), 'dd MMM yyyy')} – {format(new Date(req.endDate), 'dd MMM yyyy')}
                        {req.isHalfDay && <span className="ml-1 text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">Half Day</span>}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">{req.totalDays}d</td>
                      <td className="py-3 px-4 text-slate-600 italic">"{req.reason}"</td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            req.status === 'APPROVED'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : req.status === 'REJECTED'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {req.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400 text-[11px]">
                        {format(new Date(req.createdAt), 'dd MMM yyyy, hh:mm a')}
                      </td>
                    </tr>
                  ))}
                  {myRequests.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                        No leave requests applied yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Approval Queue */}
        {activeTab === 'APPROVAL_QUEUE' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold">
                  <tr>
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4">Leave Type</th>
                    <th className="py-3 px-4">Duration</th>
                    <th className="py-3 px-4">Days</th>
                    <th className="py-3 px-4">Reason</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {teamRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {req.employee?.firstName} {req.employee?.lastName}
                        <div className="text-[11px] text-slate-400 font-mono">{req.employee?.employeeCode}</div>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800">{req.leaveType?.name}</td>
                      <td className="py-3 px-4 text-slate-700">
                        {format(new Date(req.startDate), 'dd MMM')} – {format(new Date(req.endDate), 'dd MMM yyyy')}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">{req.totalDays}d</td>
                      <td className="py-3 px-4 text-slate-600 italic">"{req.reason}"</td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            req.status === 'APPROVED'
                              ? 'bg-emerald-50 text-emerald-700'
                              : req.status === 'REJECTED'
                              ? 'bg-rose-50 text-rose-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {req.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {req.status === 'PENDING' && (
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => handleApprove(req.id, 'APPROVED')}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium text-xs shadow-sm"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleApprove(req.id, 'REJECTED')}
                              className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg font-medium text-xs border border-rose-200"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {teamRequests.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                        No pending team leave approvals.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Double-Entry Ledger */}
        {activeTab === 'LEDGER_HISTORY' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center text-xs">
              <span className="font-semibold text-slate-800">Immutable Double-Entry Leave Ledger</span>
              <span className="text-slate-500 font-mono">Transactions are never deleted</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold font-mono">
                  <tr>
                    <th className="py-3 px-4">Tx Date</th>
                    <th className="py-3 px-4">Leave Type</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Debit / Credit</th>
                    <th className="py-3 px-4">Balance After</th>
                    <th className="py-3 px-4">Audit Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {ledgerLogs.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50/70 font-sans">
                      <td className="py-3 px-4 text-slate-500 text-xs font-mono">
                        {format(new Date(tx.transactionDate), 'dd MMM yyyy')}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900">{tx.leaveType?.name}</td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-700">{tx.transactionType}</td>
                      <td
                        className={`py-3 px-4 font-mono font-bold ${
                          tx.days > 0 ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {tx.days > 0 ? `+${tx.days}` : tx.days}d
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{tx.balanceAfter}d</td>
                      <td className="py-3 px-4 text-slate-600 text-xs italic">{tx.reason || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Apply Leave Modal */}
        {isApplyOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h3 className="font-semibold text-slate-900 text-base flex items-center gap-2">
                  <CalendarCheck className="h-5 w-5 text-emerald-600" />
                  Apply For Leave
                </h3>
                <button onClick={() => setIsApplyOpen(false)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleApplyLeave} className="space-y-4 text-xs">
                <div>
                  <label className="font-medium text-slate-700 block mb-1">Leave Type *</label>
                  <select
                    value={leaveTypeId}
                    onChange={(e) => setLeaveTypeId(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                  >
                    {leaveTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-medium text-slate-700 block mb-1">Start Date *</label>
                    <input
                      type="date"
                      required
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="font-medium text-slate-700 block mb-1">End Date *</label>
                    <input
                      type="date"
                      required
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="halfDay"
                    checked={isHalfDay}
                    onChange={(e) => setIsHalfDay(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <label htmlFor="halfDay" className="font-medium text-slate-700 cursor-pointer">
                    Half-Day Leave
                  </label>
                </div>

                {isHalfDay && (
                  <div className="grid grid-cols-2 gap-2 p-2 bg-slate-50 rounded-lg">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="session"
                        checked={halfDaySession === 'FIRST_HALF'}
                        onChange={() => setHalfDaySession('FIRST_HALF')}
                      />
                      <span>First Half</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="session"
                        checked={halfDaySession === 'SECOND_HALF'}
                        onChange={() => setHalfDaySession('SECOND_HALF')}
                      />
                      <span>Second Half</span>
                    </label>
                  </div>
                )}

                {selectedPolicy?.isSandwichRuleEnabled && (
                  <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                    <span>Sandwich Rule applies to this leave type (weekends in between are debited).</span>
                  </div>
                )}

                <div>
                  <label className="font-medium text-slate-700 block mb-1">Reason *</label>
                  <textarea
                    rows={3}
                    required
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg"
                    placeholder="Provide a clear reason for your leave request..."
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsApplyOpen(false)}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={applying}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-medium shadow-sm shadow-emerald-600/20"
                  >
                    {applying ? 'Submitting...' : 'Submit Request'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
