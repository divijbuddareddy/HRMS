'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import {
  Target,
  Award,
  TrendingUp,
  Star,
  CheckCircle,
  Plus,
  X,
  Sliders,
} from 'lucide-react';

export default function PerformancePage() {
  const { user } = useAuth();
  const [cycles, setCycles] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [appraisals, setAppraisals] = useState<any[]>([]);
  const [selectedCycle, setSelectedCycle] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<'GOALS' | 'APPRAISALS'>('GOALS');
  const [loading, setLoading] = useState(true);

  // Review modal
  const [reviewAppraisal, setReviewAppraisal] = useState<any | null>(null);
  const [rating, setRating] = useState('4.5');
  const [notes, setNotes] = useState('');
  const [increment, setIncrement] = useState('12');
  const [promotion, setPromotion] = useState(false);

  const fetchPerformance = async () => {
    setLoading(true);
    try {
      const [cRes, gRes, aRes] = await Promise.all([
        fetch('/api/performance/cycles'),
        fetch('/api/performance/goals'),
        fetch('/api/performance/appraisals'),
      ]);
      if (cRes.ok) {
        const cData = await cRes.json();
        setCycles(cData.cycles || []);
        if (cData.cycles?.[0]) setSelectedCycle(cData.cycles[0]);
      }
      if (gRes.ok) setGoals((await gRes.json()).goals || []);
      if (aRes.ok) setAppraisals((await aRes.json()).appraisals || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPerformance();
  }, []);

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewAppraisal) return;
    try {
      const res = await fetch('/api/performance/appraisals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'MANAGER_REVIEW',
          cycleId: reviewAppraisal.performanceCycleId,
          employeeId: reviewAppraisal.employeeId,
          managerRating: rating,
          managerReviewNotes: notes,
          incrementPercent: increment,
          promotionRecommend: promotion,
        }),
      });
      if (res.ok) {
        setReviewAppraisal(null);
        await fetchPerformance();
      } else {
        alert('Failed to submit appraisal review');
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <DashboardLayout title="Performance Management & OKRs" subtitle="Goal setting, 360 appraisals, rating calibration, and promotion recommendations">
      <div className="space-y-6">
        {/* Top Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-xs text-slate-500 block">Active Cycle</span>
            <span className="text-base font-bold text-slate-900 block mt-1">
              {selectedCycle?.title || 'FY26 Annual Appraisal'}
            </span>
            <span className="text-[11px] text-emerald-600 block">Evaluation & Calibration Phase</span>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-xs text-slate-500 block">My OKR Goals</span>
            <span className="text-2xl font-bold text-purple-700">{goals.length}</span>
            <span className="text-[11px] text-slate-400 block mt-0.5">Weighted performance metrics</span>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-xs text-slate-500 block">Appraisal Submissions</span>
            <span className="text-2xl font-bold text-emerald-600">{appraisals.length}</span>
            <span className="text-[11px] text-slate-400 block mt-0.5">Team reviews in progress</span>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex gap-2 border-b border-slate-200 pb-2">
          <button
            onClick={() => setActiveTab('GOALS')}
            className={`px-4 py-2 text-xs font-semibold rounded-xl transition-colors ${
              activeTab === 'GOALS' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            My Goals & Key Results (OKRs)
          </button>
          <button
            onClick={() => setActiveTab('APPRAISALS')}
            className={`px-4 py-2 text-xs font-semibold rounded-xl transition-colors ${
              activeTab === 'APPRAISALS' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Team Appraisal Reviews ({appraisals.length})
          </button>
        </div>

        {/* Tab 1: Goals */}
        {activeTab === 'GOALS' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {goals.map((g) => (
              <div key={g.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-bold bg-purple-50 text-purple-700 px-2 py-0.5 rounded border border-purple-200">
                      {g.category} • Weight {g.weight}%
                    </span>
                    <h3 className="font-bold text-sm text-slate-900 mt-2">{g.title}</h3>
                  </div>
                  <span className="text-xs font-bold text-emerald-600 font-mono">{g.progressPercent}%</span>
                </div>

                <p className="text-xs text-slate-500">{g.description || 'Deliver high performance deliverables on schedule.'}</p>

                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${g.progressPercent}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab 2: Appraisals */}
        {activeTab === 'APPRAISALS' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold">
                  <tr>
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4">Self Rating</th>
                    <th className="py-3 px-4">Manager Rating</th>
                    <th className="py-3 px-4">Final Calibrated Rating</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {appraisals.map((app) => (
                    <tr key={app.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {app.employee?.displayName || app.employee?.firstName}
                        <span className="text-[11px] text-slate-400 font-mono block">{app.employee?.employeeCode}</span>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-800 font-mono">
                        {app.selfRating ? `${app.selfRating} / 5.0` : '—'}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-800 font-mono">
                        {app.managerRating ? `${app.managerRating} / 5.0` : '—'}
                      </td>
                      <td className="py-3 px-4 font-bold text-emerald-700 font-mono">
                        {app.finalRating ? `${app.finalRating} / 5.0` : '—'}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            app.status === 'COMPLETED'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {app.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => {
                            setReviewAppraisal(app);
                            setRating(String(app.managerRating || 4.5));
                            setNotes(app.managerReviewNotes || '');
                          }}
                          className="px-3 py-1 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 font-medium rounded-lg text-xs transition-colors border border-slate-200"
                        >
                          Evaluate & Rate
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Evaluate Modal */}
        {reviewAppraisal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h3 className="font-semibold text-slate-900 text-base flex items-center gap-2">
                  <Award className="h-5 w-5 text-emerald-600" />
                  Appraisal Rating & Recommendation
                </h3>
                <button onClick={() => setReviewAppraisal(null)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSubmitReview} className="space-y-3 text-xs">
                <div>
                  <label className="font-medium text-slate-700 block mb-1">Performance Rating (1.0 to 5.0) *</label>
                  <input
                    type="number"
                    step="0.1"
                    min="1.0"
                    max="5.0"
                    required
                    value={rating}
                    onChange={(e) => setRating(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="font-medium text-slate-700 block mb-1">Manager Review Feedback & Strengths *</label>
                  <textarea
                    rows={3}
                    required
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg"
                    placeholder="Exemplary leadership, delivered high-impact engineering milestones..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div>
                    <label className="font-medium text-slate-700 block mb-1">Recommended Hike %</label>
                    <input
                      type="number"
                      value={increment}
                      onChange={(e) => setIncrement(e.target.value)}
                      className="w-full p-1.5 bg-white border border-slate-200 rounded-lg font-mono font-bold"
                    />
                  </div>
                  <div className="flex items-center pt-4">
                    <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                      <input
                        type="checkbox"
                        checked={promotion}
                        onChange={(e) => setPromotion(e.target.checked)}
                        className="rounded text-emerald-600"
                      />
                      <span>Promote to Next Level</span>
                    </label>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setReviewAppraisal(null)}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium shadow-sm shadow-emerald-600/20"
                  >
                    Save & Finalize Appraisal
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
