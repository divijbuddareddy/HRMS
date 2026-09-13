'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { History, Search, Shield, Filter, Calendar, User, Eye, X } from 'lucide-react';
import { format } from 'date-fns';

export default function AuditPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEntity, setSelectedEntity] = useState('ALL');
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const url = selectedEntity === 'ALL' ? '/api/audit-logs?limit=100' : `/api/audit-logs?entityType=${selectedEntity}&limit=100`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [selectedEntity]);

  return (
    <DashboardLayout title="Security & Audit Trail" subtitle="Immutable compliance log of mutations, overrides, and security events">
      <div className="space-y-6">
        {/* Controls */}
        <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3">
            <Filter className="h-4 w-4 text-slate-400" />
            <select
              value={selectedEntity}
              onChange={(e) => setSelectedEntity(e.target.value)}
              className="p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium"
            >
              <option value="ALL">All Event Types</option>
              <option value="USER">User & Auth</option>
              <option value="EMPLOYEE">Employee Master</option>
              <option value="LEAVE_REQUEST">Leave Requests</option>
              <option value="ATTENDANCE_REGULARIZATION">Attendance</option>
              <option value="PAYROLL_RUN">Payroll Runs</option>
              <option value="PAYROLL_ITEM">Payroll Overrides</option>
              <option value="STATUTORY_RULE_SET">Statutory Rules</option>
            </select>
          </div>

          <span className="text-xs text-slate-500 font-mono">Showing latest {logs.length} events</span>
        </div>

        {/* Audit Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold font-mono">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Entity Type</th>
                  <th className="py-3 px-4">Actor ID / Role</th>
                  <th className="py-3 px-4">Request ID</th>
                  <th className="py-3 px-4 text-right">Inspection</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70 font-sans">
                    <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                      {format(new Date(log.createdAt), 'dd MMM yyyy, hh:mm:ss a')}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                          log.action.includes('LOCK') || log.action.includes('OVERRIDE')
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : log.action.includes('APPROVE') || log.action.includes('CREATE')
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : log.action.includes('FAILED') || log.action.includes('REJECT')
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{log.entityType}</td>
                    <td className="py-3 px-4 text-slate-600 text-xs">
                      <div>{log.actorRole || 'SYSTEM'}</div>
                      <div className="text-[10px] text-slate-400 font-mono truncate max-w-[140px]">{log.actorId}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-400 font-mono text-[11px] truncate max-w-[120px]">
                      {log.requestId || '—'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {(log.beforeState || log.afterState) && (
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium flex items-center gap-1 ml-auto"
                        >
                          <Eye className="h-3 w-3" /> Diff
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Diff Inspection Modal */}
        {selectedLog && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h3 className="font-semibold text-slate-900 text-base flex items-center gap-2">
                  <Shield className="h-5 w-5 text-emerald-600" />
                  Audit State Diff Snapshot ({selectedLog.action})
                </h3>
                <button onClick={() => setSelectedLog(null)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                <div>
                  <span className="font-sans font-semibold text-slate-700 block mb-1">Before State</span>
                  <pre className="p-3 bg-slate-900 text-slate-100 rounded-xl overflow-x-auto max-h-60 text-[11px]">
                    {selectedLog.beforeState ? JSON.stringify(JSON.parse(selectedLog.beforeState), null, 2) : 'null'}
                  </pre>
                </div>
                <div>
                  <span className="font-sans font-semibold text-slate-700 block mb-1">After State</span>
                  <pre className="p-3 bg-slate-900 text-emerald-400 rounded-xl overflow-x-auto max-h-60 text-[11px]">
                    {selectedLog.afterState ? JSON.stringify(JSON.parse(selectedLog.afterState), null, 2) : 'null'}
                  </pre>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setSelectedLog(null)}
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
