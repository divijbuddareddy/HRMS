'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import {
  Clock,
  MapPin,
  Calendar,
  CheckCircle2,
  AlertCircle,
  FileEdit,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';

export default function AttendancePage() {
  const { user } = useAuth();
  const [records, setRecords] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [regularizations, setRegularizations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [activeTab, setActiveTab] = useState<'MY_TIMESHEET' | 'REGULARIZATION_QUEUE'>('MY_TIMESHEET');

  // Regularize modal
  const [isRegModalOpen, setIsRegModalOpen] = useState(false);
  const [regDate, setRegDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [proposedIn, setProposedIn] = useState('09:30');
  const [proposedOut, setProposedOut] = useState('18:30');
  const [regReason, setRegReason] = useState('');
  const [submittingReg, setSubmittingReg] = useState(false);

  // Web punch status
  const [punchStatus, setPunchStatus] = useState<any>(null);
  const [punching, setPunching] = useState(false);
  const [punchMsg, setPunchMsg] = useState<string | null>(null);

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/attendance/records?month=${month}&year=${year}`);
      if (res.ok) {
        const data = await res.json();
        setRecords(data.records || []);
        setSummary(data.summary);
      }

      const regRes = await fetch('/api/attendance/regularize?view=all');
      if (regRes.ok) {
        const rData = await regRes.json();
        setRegularizations(rData.requests || []);
      }

      const pRes = await fetch('/api/attendance/punch');
      if (pRes.ok) {
        setPunchStatus(await pRes.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
  }, [month, year]);

  const handlePunch = async (punchType: 'CHECK_IN' | 'CHECK_OUT') => {
    setPunching(true);
    setPunchMsg(null);
    try {
      const res = await fetch('/api/attendance/punch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          punchType,
          latitude: 12.9716, // Bengaluru HQ
          longitude: 77.5946,
          accuracy: 10,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setPunchMsg(`✅ ${data.message}`);
        await fetchAttendance();
      } else {
        setPunchMsg(`❌ ${data.error}`);
      }
    } catch (e: any) {
      setPunchMsg(`❌ ${e.message}`);
    } finally {
      setPunching(false);
    }
  };

  const handleSubmitRegularization = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingReg(true);
    try {
      const inDate = `${regDate}T${proposedIn}:00`;
      const outDate = `${regDate}T${proposedOut}:00`;

      const res = await fetch('/api/attendance/regularize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestedDate: regDate,
          proposedCheckIn: inDate,
          proposedCheckOut: outDate,
          reason: regReason,
        }),
      });

      if (res.ok) {
        setIsRegModalOpen(false);
        setRegReason('');
        await fetchAttendance();
      } else {
        const d = await res.json();
        alert(d.error || 'Failed to submit regularization');
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSubmittingReg(false);
    }
  };

  const handleApproveRegularization = async (id: string, decision: 'APPROVED' | 'REJECTED') => {
    try {
      const res = await fetch('/api/attendance/regularize', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          regularizationId: id,
          decision,
          notes: `${decision} by approver`,
        }),
      });
      if (res.ok) {
        await fetchAttendance();
      } else {
        const d = await res.json();
        alert(d.error || 'Failed to process regularization');
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <DashboardLayout title="Attendance & Time Management" subtitle="Web clock-in, geofencing, daily timesheets, and regularizations">
      <div className="space-y-6">
        {/* Top Control Strip */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Live Web Punch */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">Web Geofenced Clock</h3>
                    <p className="text-[11px] text-slate-500">Bengaluru HQ (500m radius)</p>
                  </div>
                </div>
                <span className="text-[10px] bg-emerald-50 text-emerald-700 font-semibold px-2 py-0.5 rounded-full border border-emerald-200">
                  ONLINE
                </span>
              </div>

              {punchMsg && (
                <div className="mb-3 p-2 bg-slate-100 text-slate-800 text-xs rounded-lg font-medium">
                  {punchMsg}
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-4">
              <button
                disabled={punching || punchStatus?.hasCheckedIn}
                onClick={() => handlePunch('CHECK_IN')}
                className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-medium text-xs rounded-xl shadow-sm transition-colors"
              >
                {punchStatus?.hasCheckedIn ? 'Checked In' : 'Punch In (09:30)'}
              </button>
              <button
                disabled={punching || !punchStatus?.hasCheckedIn || punchStatus?.hasCheckedOut}
                onClick={() => handlePunch('CHECK_OUT')}
                className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-200 disabled:text-slate-400 text-white font-medium text-xs rounded-xl shadow-sm transition-colors"
              >
                {punchStatus?.hasCheckedOut ? 'Checked Out' : 'Punch Out (18:30)'}
              </button>
            </div>
          </div>

          {/* Monthly Attendance Counters */}
          <div className="md:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-semibold text-slate-800">Monthly Cycle Metrics ({month}/{year})</h3>
              <button
                onClick={() => setIsRegModalOpen(true)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 font-medium text-xs rounded-lg border border-slate-200 flex items-center gap-1"
              >
                <FileEdit className="h-3.5 w-3.5" />
                Request Regularization
              </button>
            </div>

            <div className="grid grid-cols-4 gap-3 mt-2">
              <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100 text-center">
                <span className="text-[11px] text-emerald-700 font-semibold block">PRESENT</span>
                <span className="text-xl font-bold text-emerald-700">{summary?.presentDays ?? 0}</span>
                <span className="text-[10px] text-slate-400 block">Days</span>
              </div>
              <div className="p-3 bg-purple-50/50 rounded-xl border border-purple-100 text-center">
                <span className="text-[11px] text-purple-700 font-semibold block">HOURS</span>
                <span className="text-xl font-bold text-purple-700">{summary?.totalWorkedHours ?? 0}</span>
                <span className="text-[10px] text-slate-400 block">Worked</span>
              </div>
              <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-100 text-center">
                <span className="text-[11px] text-amber-700 font-semibold block">LATE MARKS</span>
                <span className="text-xl font-bold text-amber-700">{summary?.lateDays ?? 0}</span>
                <span className="text-[10px] text-slate-400 block">&gt; 15 min grace</span>
              </div>
              <div className="p-3 bg-rose-50/50 rounded-xl border border-rose-100 text-center">
                <span className="text-[11px] text-rose-700 font-semibold block">ABSENT / LOP</span>
                <span className="text-xl font-bold text-rose-700">{summary?.absentDays ?? 0}</span>
                <span className="text-[10px] text-slate-400 block">Unexcused</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex gap-2 border-b border-slate-200 pb-2">
          <button
            onClick={() => setActiveTab('MY_TIMESHEET')}
            className={`px-4 py-2 text-xs font-semibold rounded-xl transition-colors ${
              activeTab === 'MY_TIMESHEET'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            My Daily Timesheet ({records.length} days)
          </button>
          <button
            onClick={() => setActiveTab('REGULARIZATION_QUEUE')}
            className={`px-4 py-2 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 ${
              activeTab === 'REGULARIZATION_QUEUE'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Regularization Requests
            {regularizations.filter((r) => r.status === 'PENDING').length > 0 && (
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            )}
          </button>
        </div>

        {/* Tab 1: My Timesheet */}
        {activeTab === 'MY_TIMESHEET' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Shift</th>
                    <th className="py-3 px-4">Check In</th>
                    <th className="py-3 px-4">Check Out</th>
                    <th className="py-3 px-4">Worked Hours</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Exceptions / Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {records.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/70 font-sans">
                      <td className="py-3 px-4 font-medium text-slate-900">
                        {format(new Date(r.date), 'dd MMM yyyy (EEE)')}
                      </td>
                      <td className="py-3 px-4 text-slate-500 text-xs">
                        {r.shift?.name || 'Standard General (09:30 - 18:30)'}
                      </td>
                      <td className="py-3 px-4 font-mono font-medium text-slate-800">
                        {r.firstCheckIn ? format(new Date(r.firstCheckIn), 'hh:mm a') : '—'}
                      </td>
                      <td className="py-3 px-4 font-mono font-medium text-slate-800">
                        {r.lastCheckOut ? format(new Date(r.lastCheckOut), 'hh:mm a') : '—'}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {(r.totalWorkedMinutes / 60).toFixed(1)} hrs
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            r.status === 'PRESENT'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : r.status === 'WEEK_OFF'
                              ? 'bg-slate-100 text-slate-600'
                              : r.status === 'HALF_DAY'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500">
                        {r.isLate && <span className="text-amber-600 font-semibold mr-2">Late ({r.lateMinutes}m)</span>}
                        {r.isRegularized && <span className="text-emerald-600 font-semibold mr-2">✓ Regularized</span>}
                        {r.notes || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Regularization Queue */}
        {activeTab === 'REGULARIZATION_QUEUE' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold">
                  <tr>
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Proposed Times</th>
                    <th className="py-3 px-4">Reason</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {regularizations.map((reg) => (
                    <tr key={reg.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {reg.employee?.firstName} {reg.employee?.lastName}
                        <div className="text-[11px] text-slate-400 font-mono">{reg.employee?.employeeCode}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-800">
                        {format(new Date(reg.requestedDate), 'dd MMM yyyy')}
                      </td>
                      <td className="py-3 px-4 font-mono">
                        {format(new Date(reg.proposedCheckIn), 'hh:mm a')} – {format(new Date(reg.proposedCheckOut), 'hh:mm a')}
                      </td>
                      <td className="py-3 px-4 text-slate-600 italic">"{reg.reason}"</td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            reg.status === 'APPROVED'
                              ? 'bg-emerald-50 text-emerald-700'
                              : reg.status === 'REJECTED'
                              ? 'bg-rose-50 text-rose-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {reg.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {reg.status === 'PENDING' && (
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => handleApproveRegularization(reg.id, 'APPROVED')}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium text-xs shadow-sm"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleApproveRegularization(reg.id, 'REJECTED')}
                              className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg font-medium text-xs border border-rose-200"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Regularization Modal */}
        {isRegModalOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h3 className="font-semibold text-slate-900 text-base flex items-center gap-2">
                  <FileEdit className="h-5 w-5 text-emerald-600" />
                  Regularize Attendance Punch
                </h3>
                <button onClick={() => setIsRegModalOpen(false)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSubmitRegularization} className="space-y-4 text-xs">
                <div>
                  <label className="font-medium text-slate-700 block mb-1">Target Date *</label>
                  <input
                    type="date"
                    required
                    value={regDate}
                    onChange={(e) => setRegDate(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-medium text-slate-700 block mb-1">Proposed Check-In</label>
                    <input
                      type="time"
                      required
                      value={proposedIn}
                      onChange={(e) => setProposedIn(e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="font-medium text-slate-700 block mb-1">Proposed Check-Out</label>
                    <input
                      type="time"
                      required
                      value={proposedOut}
                      onChange={(e) => setProposedOut(e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-medium text-slate-700 block mb-1">Reason for Missed Punch / Late *</label>
                  <textarea
                    rows={3}
                    required
                    value={regReason}
                    onChange={(e) => setRegReason(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg"
                    placeholder="e.g. On-duty client visit at Indiranagar or missed biometric punch"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsRegModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingReg}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-medium shadow-sm shadow-emerald-600/20"
                  >
                    {submittingReg ? 'Submitting...' : 'Submit Regularization'}
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
