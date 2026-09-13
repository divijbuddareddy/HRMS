'use client';

import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { LogOut, Shield, UserCheck, Bell, ChevronDown } from 'lucide-react';

export const Header: React.FC<{ title?: string; subtitle?: string }> = ({
  title = 'AI Automation Labs HRMS',
  subtitle,
}) => {
  const { user, logout, switchRole } = useAuth();

  return (
    <header className="h-16 border-b border-slate-200 bg-white px-6 flex items-center justify-between sticky top-0 z-20">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-4">
        {/* Role Simulator Selector */}
        {user && user.roles.length > 1 && (
          <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 text-xs">
            <Shield className="h-3.5 w-3.5 text-emerald-600" />
            <span className="text-slate-500 font-medium">Role:</span>
            <select
              value={user.activeRole}
              onChange={(e) => switchRole(e.target.value)}
              className="bg-transparent font-semibold text-slate-800 focus:outline-none cursor-pointer"
            >
              {user.roles.map((r) => (
                <option key={r} value={r}>
                  {r.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Current Active Role Badge */}
        {user && user.roles.length === 1 && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <UserCheck className="h-3.5 w-3.5" />
            {user.activeRole.replace(/_/g, ' ')}
          </span>
        )}

        {/* User Profile info */}
        <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
          <div className="h-8 w-8 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs uppercase shadow-sm">
            {user?.employee?.firstName?.[0] || user?.email?.[0] || 'U'}
          </div>
          <div className="text-left hidden sm:block">
            <div className="text-xs font-semibold text-slate-900">
              {user?.employee?.displayName || user?.email.split('@')[0]}
            </div>
            <div className="text-[11px] text-slate-500">{user?.email}</div>
          </div>

          <button
            onClick={logout}
            title="Log Out"
            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors ml-1"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
