'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import {
  UserPlus2,
  Sparkles,
  Plus,
  Briefcase,
  Users,
  ChevronRight,
  CheckCircle,
  X,
  Star,
  Send,
} from 'lucide-react';

export default function RecruitmentPage() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<any[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  // New Candidate modal
  const [isApplyOpen, setIsApplyOpen] = useState(false);
  const [jobId, setJobId] = useState('');
  const [candForm, setCandForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    currentCompany: '',
    expectedCtc: '1800000',
    skills: 'React, TypeScript, Next.js, Node.js, PostgreSQL',
  });

  const fetchATS = async () => {
    setLoading(true);
    try {
      const [jRes, cRes] = await Promise.all([
        fetch('/api/ats/jobs'),
        fetch('/api/ats/candidates'),
      ]);
      if (jRes.ok) {
        const jData = await jRes.json();
        setJobs(jData.jobs || []);
        if (jData.jobs?.[0]) setJobId(jData.jobs[0].id);
      }
      if (cRes.ok) setCandidates((await cRes.json()).candidates || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchATS();
  }, []);

  const handleCreateCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/ats/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...candForm,
          jobRequisitionId: jobId,
          skills: candForm.skills.split(',').map((s) => s.trim()),
          expectedCtc: parseFloat(candForm.expectedCtc),
        }),
      });
      if (res.ok) {
        setIsApplyOpen(false);
        await fetchATS();
      } else {
        const d = await res.json();
        alert(d.error || 'Failed to add candidate');
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleUpdateStage = async (id: string, stage: string) => {
    try {
      const res = await fetch(`/api/ats/candidates/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage }),
      });
      if (res.ok) {
        await fetchATS();
        if (selectedCandidate?.id === id) {
          setSelectedCandidate({ ...selectedCandidate, stage });
        }
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleHireCandidate = async (id: string) => {
    if (!confirm('Are you sure you want to hire this candidate and create an active Employee profile?')) return;
    try {
      const res = await fetch(`/api/ats/candidates/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'HIRE' }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(`🎉 Success! Candidate hired as Employee ${data.employee?.employeeCode}`);
        setSelectedCandidate(null);
        await fetchATS();
      } else {
        alert(data.error || 'Hire conversion failed');
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const stages = ['APPLIED', 'SCREENED', 'INTERVIEW', 'OFFERED', 'HIRED'];

  return (
    <DashboardLayout title="Recruitment & ATS Pipeline" subtitle="Manage job requisitions, candidate pipeline, AI resume match, and hiring">
      <div className="space-y-6">
        {/* Top Control Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <Briefcase className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Active Job Requisitions</h3>
              <p className="text-xs text-slate-500">{jobs.length} open position(s) published</p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setIsApplyOpen(true)}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-xl shadow-sm shadow-emerald-600/20 flex items-center gap-1.5 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Candidate
            </button>
          </div>
        </div>

        {/* Kanban Pipeline Board */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {stages.map((stage) => {
            const stageCandidates = candidates.filter((c) => c.stage === stage);
            return (
              <div key={stage} className="bg-slate-100/70 p-3 rounded-2xl border border-slate-200/80 flex flex-col min-h-[400px]">
                <div className="flex justify-between items-center mb-3 px-1">
                  <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">{stage}</span>
                  <span className="text-[11px] font-bold bg-white text-slate-700 px-2 py-0.5 rounded-full border border-slate-200">
                    {stageCandidates.length}
                  </span>
                </div>

                <div className="space-y-2.5 flex-1">
                  {stageCandidates.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => setSelectedCandidate(c)}
                      className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm hover:border-emerald-500 cursor-pointer transition-all space-y-2"
                    >
                      <div className="flex justify-between items-start">
                        <div className="font-semibold text-xs text-slate-900">
                          {c.firstName} {c.lastName}
                        </div>
                        {c.aiMatchScore && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <Sparkles className="h-2.5 w-2.5" /> {c.aiMatchScore}% Match
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-slate-500 truncate">
                        {c.jobRequisition?.title || 'Engineer'}
                      </div>

                      <div className="text-[10px] text-slate-400 font-mono">
                        Exp CTC: ₹{(c.expectedCtc / 100000).toFixed(1)}L
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Candidate Detail Modal / Drawer */}
        {selectedCandidate && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
              <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    {selectedCandidate.firstName} {selectedCandidate.lastName}
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">{selectedCandidate.email} • {selectedCandidate.phone || '+91 9876543210'}</p>
                </div>
                <button onClick={() => setSelectedCandidate(null)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-emerald-600" />
                    <div>
                      <span className="font-bold text-emerald-900 block">AI Resume Match Score</span>
                      <span className="text-[11px] text-emerald-700">Matched with {selectedCandidate.jobRequisition?.title}</span>
                    </div>
                  </div>
                  <span className="text-xl font-black text-emerald-800 font-mono">{selectedCandidate.aiMatchScore || 85}%</span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                  <div className="font-semibold text-slate-800">Candidate Info</div>
                  <div className="grid grid-cols-2 gap-2 text-slate-600">
                    <div>Current Company: <strong>{selectedCandidate.currentCompany || 'Freelance / Tech'}</strong></div>
                    <div>Notice Period: <strong>{selectedCandidate.noticePeriodDays} Days</strong></div>
                    <div>Expected CTC: <strong>₹{(selectedCandidate.expectedCtc || 1800000).toLocaleString('en-IN')}</strong></div>
                    <div>Current Stage: <strong className="text-emerald-600">{selectedCandidate.stage}</strong></div>
                  </div>
                </div>

                <div className="space-y-1.5 pt-2">
                  <span className="font-semibold text-slate-700 block">Move Candidate to Next Stage:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {stages.map((st) => (
                      <button
                        key={st}
                        onClick={() => handleUpdateStage(selectedCandidate.id, st)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border ${
                          selectedCandidate.stage === st
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
                <button
                  onClick={() => setSelectedCandidate(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-medium"
                >
                  Close
                </button>

                {selectedCandidate.stage !== 'HIRED' && (
                  <button
                    onClick={() => handleHireCandidate(selectedCandidate.id)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-emerald-600/20 flex items-center gap-1.5"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Hire as Active Employee
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Add Candidate Modal */}
        {isApplyOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h3 className="font-semibold text-slate-900 text-base flex items-center gap-2">
                  <UserPlus2 className="h-5 w-5 text-emerald-600" />
                  Add New Candidate
                </h3>
                <button onClick={() => setIsApplyOpen(false)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleCreateCandidate} className="space-y-3 text-xs">
                <div>
                  <label className="font-medium text-slate-700 block mb-1">Applying For Position *</label>
                  <select
                    value={jobId}
                    onChange={(e) => setJobId(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                  >
                    {jobs.map((j) => (
                      <option key={j.id} value={j.id}>{j.title} ({j.code})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-medium text-slate-700 block mb-1">First Name *</label>
                    <input
                      type="text"
                      required
                      value={candForm.firstName}
                      onChange={(e) => setCandForm({ ...candForm, firstName: e.target.value })}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                      placeholder="e.g. Maya"
                    />
                  </div>
                  <div>
                    <label className="font-medium text-slate-700 block mb-1">Last Name *</label>
                    <input
                      type="text"
                      required
                      value={candForm.lastName}
                      onChange={(e) => setCandForm({ ...candForm, lastName: e.target.value })}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                      placeholder="e.g. Nair"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-medium text-slate-700 block mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    value={candForm.email}
                    onChange={(e) => setCandForm({ ...candForm, email: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                    placeholder="maya.nair@email.com"
                  />
                </div>

                <div>
                  <label className="font-medium text-slate-700 block mb-1">Skills (comma separated for AI matching)</label>
                  <input
                    type="text"
                    value={candForm.skills}
                    onChange={(e) => setCandForm({ ...candForm, skills: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                    placeholder="React, TypeScript, Node.js"
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
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium shadow-sm"
                  >
                    Add to Pipeline
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
