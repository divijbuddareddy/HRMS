'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import {
  CheckSquare,
  CheckCircle2,
  Clock,
  FileCheck,
  Laptop,
  Shield,
  UserCheck,
  Sparkles,
} from 'lucide-react';

export default function OnboardingPage() {
  const { user } = useAuth();
  const [instances, setInstances] = useState<any[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchOnboarding = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/onboarding/instances');
      if (res.ok) {
        const data = await res.json();
        setInstances(data.instances || []);
        if (data.instances?.[0]) setSelectedInstance(data.instances[0]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOnboarding();
  }, []);

  const handleToggleTask = async (itemId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'COMPLETED' ? 'PENDING' : 'COMPLETED';
    try {
      const res = await fetch(`/api/onboarding/items/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        await fetchOnboarding();
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <DashboardLayout title="Employee Onboarding & Provisioning" subtitle="Role-based checklist templates, IT setup, and verification workflow">
      <div className="space-y-6">
        {/* Top Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-xs text-slate-500 block">Total Active Onboardings</span>
            <span className="text-2xl font-bold text-slate-900">{instances.length}</span>
            <span className="text-[11px] text-emerald-600 block mt-0.5">Automated workflow tracking</span>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-xs text-slate-500 block">Completed Onboardings</span>
            <span className="text-2xl font-bold text-emerald-600">
              {instances.filter((i) => i.status === 'COMPLETED').length}
            </span>
            <span className="text-[11px] text-slate-400 block mt-0.5">100% verified & active</span>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-xs text-slate-500 block">Standard Checklist Template</span>
            <span className="text-xs font-semibold text-slate-800 block mt-2">Enterprise Engineering Onboarding</span>
            <span className="text-[11px] text-slate-400 block">5 mandatory verification gates</span>
          </div>
        </div>

        {/* Main Onboarding List & Checklist View */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left: Employee Onboarding Instances */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
            <h3 className="font-semibold text-xs text-slate-700 uppercase tracking-wider px-1">
              New Joiners Checklist ({instances.length})
            </h3>
            <div className="space-y-2">
              {instances.map((inst) => {
                const percent = Math.round((inst.completedTasksCount / (inst.totalTasksCount || 1)) * 100);
                const isSelected = selectedInstance?.id === inst.id;
                return (
                  <div
                    key={inst.id}
                    onClick={() => setSelectedInstance(inst)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200/80'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="font-semibold text-xs">
                        {inst.employee?.firstName} {inst.employee?.lastName}
                      </div>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          isSelected ? 'bg-emerald-500 text-white' : 'bg-emerald-50 text-emerald-700'
                        }`}
                      >
                        {percent}%
                      </span>
                    </div>
                    <div className={`text-[11px] font-mono mt-1 ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                      {inst.employee?.employeeCode} • {inst.status}
                    </div>

                    <div className="w-full bg-slate-200/60 rounded-full h-1.5 mt-2 overflow-hidden">
                      <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Task Checklist Details */}
          {selectedInstance && (
            <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
              <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    {selectedInstance.employee?.firstName} {selectedInstance.employee?.lastName} — Onboarding
                  </h2>
                  <p className="text-xs text-slate-500 font-mono">
                    {selectedInstance.employee?.employeeCode} • Template: {selectedInstance.template?.title}
                  </p>
                </div>
                <span className="text-xs font-bold bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full border border-emerald-200">
                  {selectedInstance.completedTasksCount} of {selectedInstance.totalTasksCount} Tasks Done
                </span>
              </div>

              {/* Task Items */}
              <div className="space-y-3">
                {selectedInstance.items?.map((item: any) => {
                  const isDone = item.status === 'COMPLETED' || item.status === 'VERIFIED';
                  return (
                    <div
                      key={item.id}
                      className={`p-4 rounded-xl border flex items-start justify-between gap-4 transition-all ${
                        isDone ? 'bg-emerald-50/40 border-emerald-200' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => handleToggleTask(item.id, item.status)}
                          className={`mt-0.5 h-5 w-5 rounded flex items-center justify-center border transition-colors ${
                            isDone
                              ? 'bg-emerald-600 border-emerald-600 text-white'
                              : 'bg-white border-slate-300 text-transparent hover:border-emerald-500'
                          }`}
                        >
                          ✓
                        </button>
                        <div>
                          <div className={`text-xs font-semibold ${isDone ? 'text-slate-900 line-through opacity-80' : 'text-slate-900'}`}>
                            {item.task?.taskTitle}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            Category: <span className="font-mono">{item.task?.category}</span> • Due within {item.task?.dueDaysFromJoining} days
                          </div>
                        </div>
                      </div>

                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isDone ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
