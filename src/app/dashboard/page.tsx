'use client';

import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import {
  Clock,
  Calendar,
  Users,
  Banknote,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  MapPin,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { format } from 'date-fns';

export default function DashboardPage() {
  const { user } = useAuth();
  const [punchStatus, setPunchStatus] = useState<any>(null);
  const [leaveBalances, setLeaveBalances] = useState<any[]>([]);
  const [teamRequests, setTeamRequests] = useState<any[]>([]);
  const [attendanceSummary, setAttendanceSummary] = useState<any>(null);
  const [employeesCount, setEmployeesCount] = useState<number>(0);
  const [punching, setPunching] = useState(false);
  const [punchMessage, setPunchMessage] = useState<string | null>(null);

  const activeRole = user?.activeRole || 'EMPLOYEE';
  const isManagerOrAdmin = ['COMPANY_ADMIN', 'HR_ADMIN', 'MANAGER'].includes(activeRole);

  const loadData = async () => {
    try {
      // 1. Fetch today's punch status
      if (user?.employee?.id) {
        const punchRes = await fetch('/api/attendance/punch');
        if (punchRes.ok) {
          const pData = await punchRes.json();
          setPunchStatus(pData);
        }

        // 2. Fetch leave balances
        const leaveRes = await fetch(`/api/leave/balances?employeeId=${user.employee.id}`);
        if (leaveRes.ok) {
          const lData = await leaveRes.json();
          setLeaveBalances(lData.balances || []);
        }

        // 3. Fetch monthly attendance summary
        const attRes = await fetch(`/api/attendance/records?employeeId=${user.employee.id}`);
        if (attRes.ok) {
          const aData = await attRes.json();
          setAttendanceSummary(aData.summary);
        }
      }

      // 4. Fetch team pending requests if manager or admin
      if (isManagerOrAdmin) {
        const leaveReqRes = await fetch('/api/leave/requests?view=team');
        if (leaveReqRes.ok) {
          const lrData = await leaveReqRes.json();
          setTeamRequests(lrData.requests?.filter((r: any) => r.status === 'PENDING') || []);
        }

        const empRes = await fetch('/api/employees');
        if (empRes.ok) {
          const eData = await empRes.json();
          setEmployeesCount(eData.employees?.length || 0);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
  }, [user, activeRole]);

  const handleQuickPunch = async (punchType: 'CHECK_IN' | 'CHECK_OUT') => {
    setPunching(true);
    setPunchMessage(null);
    try {
      const res = await fetch('/api/attendance/punch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          punchType,
          latitude: 12.9716, // Indiranagar HQ coords
          longitude: 77.5946,
          accuracy: 10,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setPunchMessage(`✅ ${data.message}`);
        await loadData();
      } else {
        setPunchMessage(`❌ ${data.error}`);
      }
    } catch (err: any) {
      setPunchMessage(`❌ ${err.message}`);
    } finally {
      setPunching(false);
    }
  };

  return (
    <DashboardLayout
      title={`Welcome back, ${user?.employee?.firstName || user?.email.split('@')[0]}!`}
      subtitle={`Tenant: ${user?.tenantName} • Role: ${activeRole.replace(/_/g, ' ')}`}
    >
      <div className="space-y-6">
        {/* Top Summary Banner / Quick Punch */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Web Punch Card */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">Today's Attendance</h3>
                  <p className="text-xs text-slate-500">{format(new Date(), 'EEEE, dd MMMM yyyy')}</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                <MapPin className="h-3 w-3" /> Geofenced
              </span>
            </div>

            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-100 mb-4 text-xs space-y-1.5">
              <div className="flex justify-between text-slate-600">
                <span>Check-In:</span>
                <span className="font-semibold text-slate-900 font-mono">
                  {punchStatus?.todayRecord?.firstCheckIn
                    ? format(new Date(punchStatus.todayRecord.firstCheckIn), 'hh:mm a')
                    : '—'}
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Check-Out:</span>
                <span className="font-semibold text-slate-900 font-mono">
                  {punchStatus?.todayRecord?.lastCheckOut
                    ? format(new Date(punchStatus.todayRecord.lastCheckOut), 'hh:mm a')
                    : '—'}
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Shift Status:</span>
                <span className="font-semibold text-emerald-600">
                  {punchStatus?.todayRecord?.status || 'NOT_STARTED'}
                </span>
              </div>
            </div>

            {punchMessage && (
              <div className="mb-3 text-xs p-2 rounded bg-slate-100 text-slate-800 border border-slate-200 font-medium">
                {punchMessage}
              </div>
            )}

            <div className="flex gap-2">
              <button
                disabled={punching || punchStatus?.hasCheckedIn}
                onClick={() => handleQuickPunch('CHECK_IN')}
                className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-medium text-xs rounded-lg transition-colors shadow-sm"
              >
                {punchStatus?.hasCheckedIn ? 'Checked In' : 'Clock In'}
              </button>
              <button
                disabled={punching || !punchStatus?.hasCheckedIn || punchStatus?.hasCheckedOut}
                onClick={() => handleQuickPunch('CHECK_OUT')}
                className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-200 disabled:text-slate-400 text-white font-medium text-xs rounded-lg transition-colors shadow-sm"
              >
                {punchStatus?.hasCheckedOut ? 'Checked Out' : 'Clock Out'}
              </button>
            </div>
          </div>

          {/* Leave Balances Widget */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">Leave Balances</h3>
                    <p className="text-xs text-slate-500">Ledger-derived live credits</p>
                  </div>
                </div>
                <Link href="/leave" className="text-xs text-emerald-600 font-medium hover:underline flex items-center gap-0.5">
                  Apply <ArrowRight className="h-3 w-3" />
                </Link>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-3">
                {leaveBalances.slice(0, 3).map((lb) => (
                  <div key={lb.leaveTypeId} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-center">
                    <div className="text-[11px] font-semibold text-slate-500 uppercase">{lb.leaveTypeCode}</div>
                    <div className="text-lg font-bold text-slate-900 mt-0.5">{lb.currentBalance}</div>
                    <div className="text-[10px] text-slate-400">Available</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex justify-between">
              <span>Next Holiday: <strong>Gandhi Jayanti</strong> (02 Oct)</span>
            </div>
          </div>

          {/* Quick Metrics / Month Tracker */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Monthly Snapshot</h3>
                <p className="text-xs text-slate-500">{format(new Date(), 'MMMM yyyy')}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-500 block">Present Days</span>
                <span className="text-lg font-bold text-emerald-600">{attendanceSummary?.presentDays ?? '—'}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-500 block">Worked Hours</span>
                <span className="text-lg font-bold text-purple-600">{attendanceSummary?.totalWorkedHours ?? '—'}h</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-500 block">Late Marks</span>
                <span className="text-lg font-bold text-amber-600">{attendanceSummary?.lateDays ?? 0}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-500 block">LOP / Absent</span>
                <span className="text-lg font-bold text-rose-600">{attendanceSummary?.absentDays ?? 0}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Manager / Admin Section: Team Approvals & Headcount */}
        {isManagerOrAdmin && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Team Pending Approvals Queue */}
            <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
                    <AlertCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">Pending Team Approvals</h3>
                    <p className="text-xs text-slate-500">Leaves and Attendance Regularizations awaiting action</p>
                  </div>
                </div>
                <Link href="/leave" className="text-xs text-emerald-600 font-medium hover:underline">
                  View all in Leave Queue →
                </Link>
              </div>

              {teamRequests.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500/60" />
                  All caught up! No pending leave requests in your approval queue.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {teamRequests.map((req) => (
                    <div key={req.id} className="py-3 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-semibold text-slate-900">
                          {req.employee?.firstName} {req.employee?.lastName}{' '}
                          <span className="font-normal text-slate-500 font-mono">({req.employee?.employeeCode})</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {req.leaveType?.name} • {req.totalDays} Day(s) •{' '}
                          {format(new Date(req.startDate), 'dd MMM')} to {format(new Date(req.endDate), 'dd MMM')}
                        </div>
                        <div className="text-[11px] text-slate-600 italic mt-0.5">"{req.reason}"</div>
                      </div>
                      <Link
                        href="/leave"
                        className="px-3 py-1.5 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 font-medium text-xs rounded-lg border border-slate-200 transition-colors"
                      >
                        Review
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Admin Summary */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Organization Master</h3>
                  <p className="text-xs text-slate-500">Live tenant overview</p>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-xs text-slate-600">Total Active Employees</span>
                  <span className="text-base font-bold text-slate-900">{employeesCount}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-xs text-slate-600">Active Salary Structure</span>
                  <span className="text-xs font-semibold text-emerald-600">Standard Tech CTC</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-xs text-slate-600">Statutory Compliance</span>
                  <span className="text-xs font-semibold text-slate-800">EPF + ESI + PT + TDS</span>
                </div>
              </div>

              <div className="pt-2">
                <Link
                  href="/payroll"
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm"
                >
                  <Banknote className="h-4 w-4" />
                  <span>Run Monthly Payroll</span>
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
