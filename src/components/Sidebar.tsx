'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  LayoutDashboard,
  Users,
  Clock,
  CalendarCheck,
  Banknote,
  History,
  Building2,
  Sparkles,
  UserPlus2,
  CheckSquare,
  FileSignature,
  Target,
  Receipt,
  Laptop,
  LogOut,
  Crown,
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const pathname = usePathname();
  const { user } = useAuth();

  const isCompanyAdmin = user?.roles.includes('COMPANY_ADMIN') || user?.roles.includes('PLATFORM_SUPER_ADMIN');
  const isHR = isCompanyAdmin || user?.roles.includes('HR_ADMIN') || user?.roles.includes('HR_EXECUTIVE');
  const isFinance = isCompanyAdmin || user?.roles.includes('FINANCE');
  const isManager = isCompanyAdmin || user?.roles.includes('MANAGER');

  const coreNav = [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Employees', href: '/employees', icon: Users },
    { label: 'Attendance', href: '/attendance', icon: Clock },
    { label: 'Leave Ledger', href: '/leave', icon: CalendarCheck },
    { label: 'Payroll & Tax', href: '/payroll', icon: Banknote },
  ];

  const lifecycleNav = [
    { label: 'Recruitment (ATS)', href: '/recruitment', icon: UserPlus2 },
    { label: 'Onboarding', href: '/onboarding', icon: CheckSquare },
    { label: 'Documents & E-Sign', href: '/documents', icon: FileSignature },
    { label: 'Performance & OKRs', href: '/performance', icon: Target },
    { label: 'Expenses', href: '/expenses', icon: Receipt },
    { label: 'Assets', href: '/assets', icon: Laptop },
    { label: 'Exit & Settlement', href: '/exit', icon: LogOut },
  ];

  const platformNav = [
    ...(isHR || isFinance || isCompanyAdmin
      ? [{ label: 'Audit Trail', href: '/audit', icon: History }]
      : []),
    ...(isCompanyAdmin
      ? [{ label: 'Super Admin', href: '/super-admin', icon: Crown }]
      : []),
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col h-screen sticky top-0 shrink-0 border-r border-slate-800">
      {/* Brand Header */}
      <div className="h-16 px-6 flex items-center gap-3 border-b border-slate-800">
        <div className="h-9 w-9 rounded-lg bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 font-bold">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <div className="font-semibold text-sm tracking-tight text-white flex items-center gap-1.5">
            AI Automation Labs
          </div>
          <div className="text-[11px] text-emerald-400 font-medium">Enterprise HRMS SaaS</div>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 py-4 px-3 space-y-4 overflow-y-auto text-xs">
        {/* Core HR */}
        <div>
          <div className="px-3 pb-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            Core HR & Payroll
          </div>
          <div className="space-y-0.5">
            {coreNav.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={true}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium transition-all duration-150 ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Full Lifecycle */}
        <div>
          <div className="px-3 pb-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            Talent & Operations
          </div>
          <div className="space-y-0.5">
            {lifecycleNav.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={true}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium transition-all duration-150 ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Governance & SaaS */}
        {platformNav.length > 0 && (
          <div>
            <div className="px-3 pb-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              Governance & Admin
            </div>
            <div className="space-y-0.5">
              {platformNav.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={true}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium transition-all duration-150 ${
                      isActive
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Tenant Indicator Footer */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/40">
        <div className="flex items-center gap-2 text-xs text-slate-400 mb-0.5">
          <Building2 className="h-3.5 w-3.5 text-emerald-400" />
          <span className="truncate font-medium text-slate-200">
            {user?.tenantName || 'AI Automation Labs'}
          </span>
        </div>
        <div className="text-[11px] text-slate-400">
          Tenant: <span className="font-mono text-slate-400">{user?.tenantSlug || 'ai-automation-labs'}</span>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
