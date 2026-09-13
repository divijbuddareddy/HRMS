'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Sparkles, Lock, Mail, Building, ArrowRight, ShieldCheck } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('admin@aiautomationlabs.com');
  const [password, setPassword] = useState('Password@123');
  const [tenantSlug, setTenantSlug] = useState('ai-automation-labs');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await login(email, password, tenantSlug);
    if (!res.success) {
      setError(res.error || 'Authentication failed');
    }
    setLoading(false);
  };

  const quickLogin = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('Password@123');
    setTenantSlug('ai-automation-labs');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Brand Card */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-emerald-500 text-white shadow-xl shadow-emerald-500/25 mb-4">
            <Sparkles className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">AI Automation Labs HRMS</h1>
          <p className="text-sm text-slate-400 mt-1">
            Enterprise Core HR, Attendance, Leave & Indian Payroll
          </p>
        </div>

        {/* Login Form */}
        <div className="bg-white/95 backdrop-blur-md rounded-2xl p-7 shadow-2xl border border-white/20">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tenant Slug</label>
              <div className="relative">
                <Building className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  required
                  value={tenantSlug}
                  onChange={(e) => setTenantSlug(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="ai-automation-labs"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Work Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="you@aiautomationlabs.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-lg shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Logins */}
          <div className="mt-6 pt-5 border-t border-slate-200">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              Quick Demo Accounts (Password@123)
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => quickLogin('admin@aiautomationlabs.com')}
                className="p-2 bg-slate-100 hover:bg-slate-200 rounded text-left border border-slate-200 text-slate-800 font-medium"
              >
                👑 Company Admin
              </button>
              <button
                type="button"
                onClick={() => quickLogin('hr@aiautomationlabs.com')}
                className="p-2 bg-slate-100 hover:bg-slate-200 rounded text-left border border-slate-200 text-slate-800 font-medium"
              >
                📋 HR Admin
              </button>
              <button
                type="button"
                onClick={() => quickLogin('manager@aiautomationlabs.com')}
                className="p-2 bg-slate-100 hover:bg-slate-200 rounded text-left border border-slate-200 text-slate-800 font-medium"
              >
                👔 Engineering Mgr
              </button>
              <button
                type="button"
                onClick={() => quickLogin('emp1@aiautomationlabs.com')}
                className="p-2 bg-slate-100 hover:bg-slate-200 rounded text-left border border-slate-200 text-slate-800 font-medium"
              >
                💻 Employee (Priya)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
