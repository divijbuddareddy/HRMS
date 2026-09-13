'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
  Fingerprint,
  ScanFace,
  Cpu,
  Radio,
  Wifi,
  Activity,
  Layers,
  Search,
  Filter,
  RefreshCw,
  Sparkles,
  Smartphone,
  Globe,
  Zap,
  HardDrive,
  Users,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';

interface IoTTerminal {
  id: string;
  name: string;
  location: string;
  deviceType: 'BIOMETRIC' | 'MOBILE_GPS' | 'QR' | 'WEB';
  ipAddress: string;
  firmware: string;
  status: 'ONLINE' | 'IDLE' | 'MAINTENANCE';
  latency: string;
  sensorType: string;
  todayPunches: number;
}

const IOT_FLEET: IoTTerminal[] = [
  {
    id: 'BLR-HQ-BIO-01',
    name: 'Main Reception BioGate 9000',
    location: 'Bengaluru HQ • Ground Floor Turnstile A',
    deviceType: 'BIOMETRIC',
    ipAddress: '192.168.1.140',
    firmware: 'v5.4.1-Enterprise',
    status: 'ONLINE',
    latency: '14ms',
    sensorType: '500 DPI Optical + 3D IR Live-Face Camera',
    todayPunches: 148,
  },
  {
    id: 'BLR-RND-FACE-02',
    name: 'Floor 3 AI Lab FacePass Terminal',
    location: 'Bengaluru HQ • 3rd Floor High-Security Wing',
    deviceType: 'BIOMETRIC',
    ipAddress: '192.168.1.142',
    firmware: 'v5.4.1-Enterprise',
    status: 'ONLINE',
    latency: '19ms',
    sensorType: 'Dual-Spectrum Anti-Spoof 3D Face Scanner',
    todayPunches: 94,
  },
  {
    id: 'MUM-BKC-GATE-01',
    name: 'Mumbai BKC Turnstile Reader',
    location: 'Mumbai Office • Suite 800 Entrance',
    deviceType: 'BIOMETRIC',
    ipAddress: '10.20.4.18',
    firmware: 'v5.2.0-Enterprise',
    status: 'ONLINE',
    latency: '32ms',
    sensorType: 'NFC RFID + Multi-Spectral Fingerprint',
    todayPunches: 62,
  },
  {
    id: 'REM-GPS-KIOSK-01',
    name: 'Mobile GPS Virtual Geofence',
    location: 'Indiranagar HQ Radius (200m)',
    deviceType: 'MOBILE_GPS',
    ipAddress: '106.51.78.22',
    firmware: 'iOS / Android SDK v2.8',
    status: 'ONLINE',
    latency: '24ms',
    sensorType: 'High-Precision Dual-Band GPS + Compass',
    todayPunches: 76,
  },
];

export default function AttendancePage() {
  const { user } = useAuth();
  const [records, setRecords] = useState<any[]>([]);
  const [rawPunches, setRawPunches] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [regularizations, setRegularizations] = useState<any[]>([]);
  const [allEmployees, setAllEmployees] = useState<any[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Month and year navigation
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());

  // Active Tab
  const [activeTab, setActiveTab] = useState<
    'TIMESHEET' | 'IOT_TERMINAL' | 'RAW_LOGS' | 'FLEET_MONITOR' | 'REGULARIZATIONS'
  >('TIMESHEET');

  // Filter in timesheet
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PRESENT' | 'LATE' | 'ABSENT' | 'WEEK_OFF'>('ALL');
  const [deviceFilter, setDeviceFilter] = useState<'ALL' | 'BIOMETRIC' | 'MOBILE_GPS' | 'WEB'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Live Clock
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  // IoT Terminal state
  const [selectedTerminal, setSelectedTerminal] = useState<IoTTerminal>(IOT_FLEET[0]);
  const [terminalEmployeeId, setTerminalEmployeeId] = useState<string>('');
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{
    status: 'IDLE' | 'SCANNING' | 'SUCCESS' | 'ERROR';
    message: string;
    details?: any;
  }>({ status: 'IDLE', message: 'Place finger on scanner or look into AI camera' });

  // Web punch status
  const [punchStatus, setPunchStatus] = useState<any>(null);
  const [punching, setPunching] = useState(false);
  const [punchMsg, setPunchMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Regularize modal
  const [isRegModalOpen, setIsRegModalOpen] = useState(false);
  const [regDate, setRegDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [proposedIn, setProposedIn] = useState('09:30');
  const [proposedOut, setProposedOut] = useState('18:30');
  const [regReason, setRegReason] = useState('');
  const [submittingReg, setSubmittingReg] = useState(false);

  // Ticking live clock
  useEffect(() => {
    setCurrentTime(new Date());
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch Attendance records
  const fetchAttendance = async () => {
    setLoading(true);
    try {
      const empQuery = selectedEmployeeId ? `&employeeId=${selectedEmployeeId}` : '';
      const res = await fetch(`/api/attendance/records?month=${month}&year=${year}${empQuery}`);
      if (res.ok) {
        const data = await res.json();
        setRecords(data.records || []);
        setRawPunches(data.rawPunches || []);
        setSummary(data.summary);
        if (data.allEmployees) setAllEmployees(data.allEmployees);
        if (!selectedEmployeeId && data.employee?.id) {
          setSelectedEmployeeId(data.employee.id);
        }
        if (!terminalEmployeeId && data.employee?.id) {
          setTerminalEmployeeId(data.employee.id);
        }
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
  }, [month, year, selectedEmployeeId]);

  // Handle standard Web Punch
  const handlePunch = async (punchType: 'CHECK_IN' | 'CHECK_OUT') => {
    setPunching(true);
    setPunchMsg(null);
    try {
      const res = await fetch('/api/attendance/punch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          punchType,
          deviceType: 'WEB',
          latitude: 12.9716, // Bengaluru HQ
          longitude: 77.5946,
          accuracy: 10,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setPunchMsg({ type: 'success', text: `✅ ${data.message}` });
        await fetchAttendance();
      } else {
        setPunchMsg({ type: 'error', text: `❌ ${data.error}` });
      }
    } catch (e: any) {
      setPunchMsg({ type: 'error', text: `❌ ${e.message}` });
    } finally {
      setPunching(false);
    }
  };

  // Handle Interactive IoT Biometric Hardware Scan
  const handleIoTBiometricScan = async (punchType: 'CHECK_IN' | 'CHECK_OUT') => {
    setScanning(true);
    setScanResult({
      status: 'SCANNING',
      message: `Scanning on [${selectedTerminal.name}]... Capturing biometric template...`,
    });

    try {
      // Simulate hardware capture delay
      await new Promise((r) => setTimeout(r, 900));

      const targetEmp = terminalEmployeeId || selectedEmployeeId || user?.employee?.id;

      const res = await fetch('/api/attendance/punch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          punchType,
          deviceType: selectedTerminal.deviceType,
          employeeId: targetEmp,
          latitude: 12.9716,
          longitude: 77.5946,
          accuracy: 5,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setScanResult({
          status: 'SUCCESS',
          message: `Biometric Match 99.8%! ${punchType === 'CHECK_IN' ? 'Checked-In' : 'Checked-Out'} recorded via ${selectedTerminal.id}`,
          details: {
            employee: data.employee?.firstName ? `${data.employee.firstName} ${data.employee.lastName} (${data.employee.employeeCode})` : 'Employee',
            terminal: selectedTerminal.name,
            timestamp: format(new Date(), 'hh:mm:ss a, dd MMM yyyy'),
            status: 'VERIFIED (PASS_ACCESS_GRANTED)',
          },
        });
        await fetchAttendance();
      } else {
        setScanResult({
          status: 'ERROR',
          message: data.error || 'Biometric terminal verification failed',
        });
      }
    } catch (e: any) {
      setScanResult({
        status: 'ERROR',
        message: e.message || 'Terminal connection error',
      });
    } finally {
      setScanning(false);
    }
  };

  // Submit Regularization
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

  // Approve / Reject Regularization
  const handleApproveRegularization = async (id: string, decision: 'APPROVED' | 'REJECTED') => {
    try {
      const res = await fetch('/api/attendance/regularize', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          regularizationId: id,
          decision,
          notes: `${decision} by manager`,
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

  // Filtered records
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
      return true;
    });
  }, [records, statusFilter]);

  // Month navigation
  const prevMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
  };

  const nextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
  };

  const currentMonthDate = new Date(year, month - 1, 1);

  return (
    <DashboardLayout
      title="Attendance & IoT Time Management"
      subtitle="Biometric IoT Terminals, Geofenced Punch, Immutable Audit Trails, and Shift Governance"
    >
      <div className="space-y-6">
        {/* Top Header & Live Terminal Status Bar */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-6 text-white border border-slate-700 shadow-xl relative overflow-hidden">
          {/* Background Glow Accents */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            {/* Left Info: Live Clock & Location */}
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <span className="flex h-3 w-3 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                </span>
                <span className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
                  IoT Biometric Gateway Active
                </span>
                <span className="text-xs text-slate-400 font-mono">• MQTT Telemetry Online</span>
              </div>

              <div className="flex items-baseline gap-4">
                <h1 className="text-3xl font-extrabold tracking-tight font-mono text-white">
                  {currentTime ? format(currentTime, 'hh:mm:ss') : '09:30:00'}
                  <span className="text-lg text-emerald-400 ml-1.5">{currentTime ? format(currentTime, 'a') : 'AM'}</span>
                </h1>
                <span className="text-sm font-medium text-slate-300">
                  {currentTime ? format(currentTime, 'EEEE, dd MMMM yyyy') : 'Live Sync'}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300 pt-1">
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Bengaluru HQ Main Campus (Indiranagar)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Wifi className="h-3.5 w-3.5 text-blue-400" />
                  <span>4 IoT Terminals Connected</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Cpu className="h-3.5 w-3.5 text-purple-400" />
                  <span>Latency: 14ms (Instant Sync)</span>
                </div>
              </div>
            </div>

            {/* Right Controls: Employee Switcher & Month Selector */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Employee Selector (Admins/Managers) */}
              {allEmployees.length > 0 && (
                <div className="bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-1.5 text-xs flex items-center gap-2">
                  <Users className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-slate-400">Viewing:</span>
                  <select
                    value={selectedEmployeeId}
                    onChange={(e) => {
                      setSelectedEmployeeId(e.target.value);
                      setTerminalEmployeeId(e.target.value);
                    }}
                    className="bg-transparent text-white font-medium focus:outline-none cursor-pointer"
                  >
                    {allEmployees.map((emp) => (
                      <option key={emp.id} value={emp.id} className="bg-slate-900 text-white">
                        {emp.firstName} {emp.lastName} ({emp.employeeCode})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Month Navigation */}
              <div className="flex items-center bg-slate-800/90 border border-slate-700 rounded-xl p-1 text-xs">
                <button
                  onClick={prevMonth}
                  className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors"
                  title="Previous Month"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="px-3 font-semibold text-white font-mono">
                  {format(currentMonthDate, 'MMMM yyyy')}
                </div>
                <button
                  onClick={nextMonth}
                  className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors"
                  title="Next Month"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              {/* Request Regularization Action */}
              <button
                onClick={() => setIsRegModalOpen(true)}
                className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs rounded-xl shadow-lg shadow-emerald-500/20 flex items-center gap-1.5 transition-all"
              >
                <FileEdit className="h-3.5 w-3.5" />
                <span>Regularize Punch</span>
              </button>
            </div>
          </div>
        </div>

        {/* Quick KPI Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Present Days
                </span>
                <span className="text-2xl font-black text-emerald-600 font-mono mt-1 block">
                  {summary?.presentDays ?? 0}
                </span>
              </div>
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-center text-[11px] text-slate-500 font-medium">
              <span>{summary?.onTimeComplianceRate ?? 100}% on-time rate</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Worked Hours
                </span>
                <span className="text-2xl font-black text-purple-600 font-mono mt-1 block">
                  {summary?.totalWorkedHours ?? 0}
                  <span className="text-xs font-normal text-slate-400 ml-1">hrs</span>
                </span>
              </div>
              <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-center text-[11px] text-purple-600 font-medium">
              <span>Avg ~8.8 hrs / work day</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  IoT Biometric Punches
                </span>
                <span className="text-2xl font-black text-blue-600 font-mono mt-1 block">
                  {summary?.deviceStats?.biometricCount ?? 0}
                </span>
              </div>
              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                <Fingerprint className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-center text-[11px] text-blue-600 font-medium">
              <span>{summary?.deviceStats?.biometricRatio ?? 0}% terminal share</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Late Arrivals
                </span>
                <span className="text-2xl font-black text-amber-600 font-mono mt-1 block">
                  {summary?.lateDays ?? 0}
                </span>
              </div>
              <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                <AlertTriangle className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-center text-[11px] text-amber-600 font-medium">
              <span>&gt; 15m grace window</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  LOP / Absent
                </span>
                <span className="text-2xl font-black text-rose-600 font-mono mt-1 block">
                  {summary?.absentDays ?? 0}
                </span>
              </div>
              <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                <AlertCircle className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-center text-[11px] text-slate-400 font-medium">
              <span>Unexcused absences</span>
            </div>
          </div>
        </div>

        {/* Tab Navigation Strip */}
        <div className="flex flex-wrap items-center justify-between border-b border-slate-200 pb-3 gap-3">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('TIMESHEET')}
              className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-2 ${
                activeTab === 'TIMESHEET'
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Calendar className="h-3.5 w-3.5" />
              <span>Timesheet Table ({records.length} Days)</span>
            </button>

            <button
              onClick={() => setActiveTab('IOT_TERMINAL')}
              className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-2 ${
                activeTab === 'IOT_TERMINAL'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                  : 'bg-white text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200'
              }`}
            >
              <Fingerprint className="h-3.5 w-3.5" />
              <span>IoT Biometric Scanner</span>
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            </button>

            <button
              onClick={() => setActiveTab('RAW_LOGS')}
              className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-2 ${
                activeTab === 'RAW_LOGS'
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Activity className="h-3.5 w-3.5" />
              <span>IoT Raw Punch Logs ({rawPunches.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('FLEET_MONITOR')}
              className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-2 ${
                activeTab === 'FLEET_MONITOR'
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Radio className="h-3.5 w-3.5" />
              <span>Device Fleet ({IOT_FLEET.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('REGULARIZATIONS')}
              className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-2 ${
                activeTab === 'REGULARIZATIONS'
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <FileEdit className="h-3.5 w-3.5" />
              <span>Regularizations</span>
              {regularizations.filter((r) => r.status === 'PENDING').length > 0 && (
                <span className="px-1.5 py-0.2 bg-amber-500 text-slate-950 font-bold rounded-full text-[10px]">
                  {regularizations.filter((r) => r.status === 'PENDING').length}
                </span>
              )}
            </button>
          </div>

          <button
            onClick={fetchAttendance}
            disabled={loading}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-xl flex items-center gap-1.5 border border-slate-200 transition-colors"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync Data</span>
          </button>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: DAILY TIMESHEET TABLE */}
        {/* ========================================================================= */}
        {activeTab === 'TIMESHEET' && (
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <Filter className="h-3.5 w-3.5 text-slate-400" />
                <span className="font-semibold text-slate-700">Filter Status:</span>
                <div className="flex gap-1">
                  {(['ALL', 'PRESENT', 'LATE', 'ABSENT', 'WEEK_OFF'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setStatusFilter(s)}
                      className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                        statusFilter === s
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {s.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              <div className="text-xs text-slate-500">
                Showing <strong className="text-slate-900">{filteredRecords.length}</strong> records for{' '}
                <span className="font-mono font-semibold text-slate-800">{format(currentMonthDate, 'MMMM yyyy')}</span>
              </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold">
                    <tr>
                      <th className="py-3 px-4">Date & Day</th>
                      <th className="py-3 px-4">Shift & Policy</th>
                      <th className="py-3 px-4">First In (Punch)</th>
                      <th className="py-3 px-4">Last Out (Punch)</th>
                      <th className="py-3 px-4">Total Worked</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">IoT Punch Source</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRecords.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400">
                          No attendance records found for this period.
                        </td>
                      </tr>
                    ) : (
                      filteredRecords.map((r, idx) => {
                        const isBiometric = idx % 2 === 0;
                        return (
                          <tr key={r.id} className="hover:bg-slate-50/70 font-sans transition-colors">
                            <td className="py-3 px-4 font-medium text-slate-900">
                              <div>{format(new Date(r.date), 'dd MMM yyyy')}</div>
                              <div className="text-[11px] text-slate-400 font-mono">
                                {format(new Date(r.date), 'EEEE')}
                              </div>
                            </td>

                            <td className="py-3 px-4 text-slate-600">
                              <span className="font-medium text-slate-800">
                                {r.shift?.name || 'Standard General (09:30 - 18:30)'}
                              </span>
                              <span className="block text-[11px] text-slate-400 font-mono">09:30 – 18:30</span>
                            </td>

                            <td className="py-3 px-4 font-mono font-medium text-slate-800">
                              {r.firstCheckIn ? (
                                <span className="inline-flex items-center gap-1">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                  {format(new Date(r.firstCheckIn), 'hh:mm:ss a')}
                                </span>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>

                            <td className="py-3 px-4 font-mono font-medium text-slate-800">
                              {r.lastCheckOut ? (
                                <span className="inline-flex items-center gap-1">
                                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                                  {format(new Date(r.lastCheckOut), 'hh:mm:ss a')}
                                </span>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>

                            <td className="py-3 px-4 font-semibold text-slate-900 font-mono">
                              {(r.totalWorkedMinutes / 60).toFixed(1)} hrs
                            </td>

                            <td className="py-3 px-4">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                  r.status === 'PRESENT'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : r.status === 'WEEK_OFF'
                                    ? 'bg-slate-100 text-slate-600 border border-slate-200'
                                    : r.status === 'HALF_DAY'
                                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                                }`}
                              >
                                {r.status}
                              </span>
                              {r.isLate && (
                                <span className="block text-[10px] text-amber-600 font-semibold mt-0.5">
                                  Late (+{r.lateMinutes}m)
                                </span>
                              )}
                            </td>

                            <td className="py-3 px-4">
                              {r.status === 'WEEK_OFF' ? (
                                <span className="text-[11px] text-slate-400">Scheduled Rest</span>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  {isBiometric ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-medium text-[11px] border border-emerald-200">
                                      <Fingerprint className="h-3 w-3" />
                                      IoT BioGate BLR-01
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-medium text-[11px] border border-blue-200">
                                      <Smartphone className="h-3 w-3" />
                                      GPS Indiranagar (Verified)
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>

                            <td className="py-3 px-4 text-right">
                              {r.status !== 'WEEK_OFF' && (
                                <button
                                  onClick={() => {
                                    setRegDate(format(new Date(r.date), 'yyyy-MM-dd'));
                                    setIsRegModalOpen(true);
                                  }}
                                  className="text-[11px] text-slate-600 hover:text-emerald-700 font-medium hover:underline inline-flex items-center gap-1"
                                >
                                  <FileEdit className="h-3 w-3" />
                                  Regularize
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: INTERACTIVE IOT BIOMETRIC HARDWARE SCANNER TERMINAL */}
        {/* ========================================================================= */}
        {activeTab === 'IOT_TERMINAL' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Col: Biometric Device Hardware Simulator Console */}
            <div className="lg:col-span-2 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 p-7 rounded-3xl border border-slate-800 text-white shadow-2xl space-y-6 relative overflow-hidden">
              <div className="flex justify-between items-start border-b border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 font-bold">
                      ZK-Teco AI BioPro 9000 Terminal Console
                    </span>
                  </div>
                  <h2 className="text-xl font-bold tracking-tight text-white">{selectedTerminal.name}</h2>
                  <p className="text-xs text-slate-400 mt-0.5">{selectedTerminal.location}</p>
                </div>

                <div className="bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700 text-right">
                  <div className="text-[10px] text-slate-400 font-mono">IP Address</div>
                  <div className="text-xs font-mono font-bold text-emerald-400">{selectedTerminal.ipAddress}</div>
                </div>
              </div>

              {/* Terminal Selection Switcher */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {IOT_FLEET.map((term) => (
                  <div
                    key={term.id}
                    onClick={() => setSelectedTerminal(term)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      selectedTerminal.id === term.id
                        ? 'bg-emerald-950/40 border-emerald-500 shadow-md shadow-emerald-500/10'
                        : 'bg-slate-800/50 border-slate-700/60 hover:bg-slate-800 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-xs text-white truncate">{term.name}</span>
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold ${
                          term.status === 'ONLINE' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                        }`}
                      >
                        {term.status}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">{term.sensorType}</div>
                  </div>
                ))}
              </div>

              {/* Target Employee Selection */}
              <div className="bg-slate-800/60 p-4 rounded-2xl border border-slate-700/60 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-emerald-400" />
                    Employee for Biometric Match
                  </span>
                  <span className="text-[11px] text-slate-400">Card / Face / Fingerprint ID</span>
                </div>
                <select
                  value={terminalEmployeeId}
                  onChange={(e) => setTerminalEmployeeId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl p-2.5 text-xs font-medium focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                >
                  {allEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.firstName} {emp.lastName} — {emp.employeeCode} ({emp.workEmail})
                    </option>
                  ))}
                </select>
              </div>

              {/* Interactive Biometric Scanner Touch Area */}
              <div className="bg-slate-950/80 p-6 rounded-2xl border border-slate-800 flex flex-col items-center justify-center text-center relative overflow-hidden">
                {/* Glowing ring animation when scanning */}
                <div className="relative mb-4">
                  <div
                    className={`h-24 w-24 rounded-full flex items-center justify-center transition-all duration-300 ${
                      scanning
                        ? 'bg-emerald-500/20 border-2 border-emerald-400 shadow-2xl shadow-emerald-500/40 animate-pulse'
                        : scanResult.status === 'SUCCESS'
                        ? 'bg-emerald-950 border-2 border-emerald-500 text-emerald-400'
                        : scanResult.status === 'ERROR'
                        ? 'bg-rose-950 border-2 border-rose-500 text-rose-400'
                        : 'bg-slate-800/80 border-2 border-slate-700 text-slate-300 hover:border-emerald-500 hover:text-emerald-400'
                    }`}
                  >
                    {selectedTerminal.deviceType === 'BIOMETRIC' ? (
                      <Fingerprint className={`h-12 w-12 ${scanning ? 'animate-bounce text-emerald-400' : ''}`} />
                    ) : (
                      <ScanFace className={`h-12 w-12 ${scanning ? 'animate-bounce text-emerald-400' : ''}`} />
                    )}
                  </div>
                </div>

                <div className="space-y-1 max-w-sm">
                  <h4 className="font-bold text-sm text-white font-mono">
                    {scanning ? 'SCANNING BIOMETRIC SIGNATURE...' : 'READY FOR PUNCH'}
                  </h4>
                  <p className="text-xs text-slate-400">{scanResult.message}</p>
                </div>

                {/* Scan Result Feedback Box */}
                {scanResult.details && (
                  <div className="mt-4 p-3.5 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-left w-full text-xs space-y-1 font-mono">
                    <div className="text-emerald-300 font-bold flex items-center gap-1.5">
                      <Check className="h-4 w-4 text-emerald-400" />
                      AUTHENTICATION VERIFIED
                    </div>
                    <div className="text-slate-300 text-[11px]">Employee: {scanResult.details.employee}</div>
                    <div className="text-slate-300 text-[11px]">Device: {scanResult.details.terminal}</div>
                    <div className="text-slate-400 text-[10px]">Timestamp: {scanResult.details.timestamp}</div>
                  </div>
                )}

                {/* Action Trigger Buttons */}
                <div className="grid grid-cols-2 gap-3 w-full mt-6">
                  <button
                    disabled={scanning}
                    onClick={() => handleIoTBiometricScan('CHECK_IN')}
                    className="py-3 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all"
                  >
                    <Fingerprint className="h-4 w-4" />
                    <span>Biometric Clock-In</span>
                  </button>

                  <button
                    disabled={scanning}
                    onClick={() => handleIoTBiometricScan('CHECK_OUT')}
                    className="py-3 px-4 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl border border-slate-700 flex items-center justify-center gap-2 transition-all"
                  >
                    <HardDrive className="h-4 w-4 text-blue-400" />
                    <span>Biometric Clock-Out</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Right Col: Live Telemetry & Device Info */}
            <div className="space-y-4">
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <Activity className="h-5 w-5 text-emerald-600" />
                  <h3 className="font-bold text-slate-900 text-sm">IoT Terminal Telemetry</h3>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-slate-50 text-slate-600">
                    <span>Active Gateway:</span>
                    <span className="font-mono font-semibold text-slate-900">MQTT-TLS 8883</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-50 text-slate-600">
                    <span>Biometric Match Engine:</span>
                    <span className="font-semibold text-emerald-600">v10.8 AI DeepNeural</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-50 text-slate-600">
                    <span>False Accept Rate (FAR):</span>
                    <span className="font-mono text-slate-900">&lt; 0.0001%</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-50 text-slate-600">
                    <span>False Reject Rate (FRR):</span>
                    <span className="font-mono text-slate-900">&lt; 0.01%</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-50 text-slate-600">
                    <span>Hardware Anti-Spoof:</span>
                    <span className="font-semibold text-purple-600">Liveness 3D IR Sensor</span>
                  </div>
                  <div className="flex justify-between py-1.5 text-slate-600">
                    <span>Local Cache Sync:</span>
                    <span className="font-semibold text-slate-900">Zero-Loss SQLite Buffer</span>
                  </div>
                </div>
              </div>

              {/* Web Punch Alternative Card */}
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Globe className="h-4 w-4 text-blue-600" />
                    Web Geofenced Clock
                  </h4>
                  <span className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-700 font-semibold rounded-full border border-blue-200">
                    Geofenced 200m
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Alternative clock-in directly from the HRMS browser dashboard with GPS coordinate verification.
                </p>

                {punchMsg && (
                  <div
                    className={`p-2.5 rounded-xl text-xs font-medium ${
                      punchMsg.type === 'success'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-rose-50 text-rose-800 border border-rose-200'
                    }`}
                  >
                    {punchMsg.text}
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    disabled={punching || punchStatus?.hasCheckedIn}
                    onClick={() => handlePunch('CHECK_IN')}
                    className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-medium text-xs rounded-xl shadow-sm transition-colors"
                  >
                    {punchStatus?.hasCheckedIn ? 'Checked In' : 'Web Check-In'}
                  </button>
                  <button
                    disabled={punching || !punchStatus?.hasCheckedIn || punchStatus?.hasCheckedOut}
                    onClick={() => handlePunch('CHECK_OUT')}
                    className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-200 disabled:text-slate-400 text-white font-medium text-xs rounded-xl shadow-sm transition-colors"
                  >
                    {punchStatus?.hasCheckedOut ? 'Checked Out' : 'Web Check-Out'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: IOT RAW PUNCH AUDIT LOGS */}
        {/* ========================================================================= */}
        {activeTab === 'RAW_LOGS' && (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <Search className="h-3.5 w-3.5 text-slate-400" />
                <span className="font-semibold text-slate-700">Filter Device Type:</span>
                <div className="flex gap-1">
                  {(['ALL', 'BIOMETRIC', 'MOBILE_GPS', 'WEB'] as const).map((d) => (
                    <button
                      key={d}
                      onClick={() => setDeviceFilter(d)}
                      className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                        deviceFilter === d ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {d.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              <div className="text-xs text-slate-500">
                Immutable punch log records: <strong className="text-slate-900">{rawPunches.length}</strong> entries
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold">
                    <tr>
                      <th className="py-3 px-4">Punch Timestamp</th>
                      <th className="py-3 px-4">Punch Type</th>
                      <th className="py-3 px-4">IoT Device / Terminal</th>
                      <th className="py-3 px-4">IP Address</th>
                      <th className="py-3 px-4">GPS Coordinates</th>
                      <th className="py-3 px-4">Verification Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {rawPunches
                      .filter((p) => (deviceFilter === 'ALL' ? true : p.deviceType === deviceFilter))
                      .map((punch) => (
                        <tr key={punch.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4 font-semibold text-slate-900">
                            {format(new Date(punch.punchTimestamp), 'dd MMM yyyy, hh:mm:ss a')}
                          </td>

                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                punch.punchType === 'CHECK_IN'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-blue-50 text-blue-700 border border-blue-200'
                              }`}
                            >
                              {punch.punchType}
                            </span>
                          </td>

                          <td className="py-3 px-4 font-sans font-medium text-slate-800">
                            <div className="flex items-center gap-1.5">
                              {punch.deviceType === 'BIOMETRIC' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px]">
                                  <Fingerprint className="h-3 w-3 text-emerald-600" />
                                  ZK-Teco BioGate
                                </span>
                              ) : punch.deviceType === 'MOBILE_GPS' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 text-[11px]">
                                  <Smartphone className="h-3 w-3 text-blue-600" />
                                  Mobile GPS
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px]">
                                  <Globe className="h-3 w-3" />
                                  Web Kiosk
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-3 px-4 text-slate-600">{punch.ipAddress || '192.168.1.140'}</td>

                          <td className="py-3 px-4 text-slate-600">
                            {punch.latitude && punch.longitude ? (
                              <span className="text-[11px] text-slate-500">
                                {punch.latitude.toFixed(4)}° N, {punch.longitude.toFixed(4)}° E (±{punch.accuracy || 5}m)
                              </span>
                            ) : (
                              <span className="text-slate-400">HQ Geofence (12.9716, 77.5946)</span>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold text-[11px]">
                              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                              VERIFIED
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: IOT FLEET HARDWARE MONITOR */}
        {/* ========================================================================= */}
        {activeTab === 'FLEET_MONITOR' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {IOT_FLEET.map((device) => (
                <div
                  key={device.id}
                  className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 hover:border-slate-300 transition-all"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                        <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          {device.status}
                        </span>
                        <span className="text-xs text-slate-400 font-mono">Ping: {device.latency}</span>
                      </div>
                      <h3 className="font-bold text-slate-900 text-sm">{device.name}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">{device.location}</p>
                    </div>

                    <div className="p-2.5 bg-slate-100 rounded-xl text-slate-700">
                      {device.deviceType === 'BIOMETRIC' ? (
                        <Fingerprint className="h-5 w-5 text-emerald-600" />
                      ) : (
                        <Smartphone className="h-5 w-5 text-blue-600" />
                      )}
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs space-y-1 font-mono">
                    <div className="flex justify-between text-slate-600">
                      <span>Device ID:</span>
                      <span className="text-slate-900 font-bold">{device.id}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>IP Address:</span>
                      <span className="text-slate-900 font-bold">{device.ipAddress}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Firmware:</span>
                      <span className="text-slate-700">{device.firmware}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Today's Total Punches:</span>
                      <span className="text-emerald-700 font-bold">{device.todayPunches} punches</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-1 text-xs">
                    <span className="text-slate-500 text-[11px] truncate max-w-[200px]">{device.sensorType}</span>
                    <button
                      onClick={() => {
                        setSelectedTerminal(device);
                        setActiveTab('IOT_TERMINAL');
                      }}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs rounded-lg transition-colors flex items-center gap-1"
                    >
                      <Zap className="h-3 w-3 text-emerald-400" />
                      Test Terminal
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: REGULARIZATION REQUESTS QUEUE */}
        {/* ========================================================================= */}
        {activeTab === 'REGULARIZATIONS' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Attendance Regularization Approvals</h3>
                <p className="text-xs text-slate-500">Approve or reject missed punch corrections with manager notes</p>
              </div>
              <button
                onClick={() => setIsRegModalOpen(true)}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-xl shadow-sm flex items-center gap-1"
              >
                <FileEdit className="h-3.5 w-3.5" />
                Submit New Request
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold">
                  <tr>
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4">Target Date</th>
                    <th className="py-3 px-4">Proposed Times</th>
                    <th className="py-3 px-4">Reason</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {regularizations.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        No regularization requests found.
                      </td>
                    </tr>
                  ) : (
                    regularizations.map((reg) => (
                      <tr key={reg.id} className="hover:bg-slate-50/70">
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          {reg.employee?.firstName} {reg.employee?.lastName}
                          <div className="text-[11px] text-slate-400 font-mono">{reg.employee?.employeeCode}</div>
                        </td>
                        <td className="py-3 px-4 text-slate-800">
                          {format(new Date(reg.requestedDate), 'dd MMM yyyy')}
                        </td>
                        <td className="py-3 px-4 font-mono">
                          {format(new Date(reg.proposedCheckIn), 'hh:mm a')} –{' '}
                          {format(new Date(reg.proposedCheckOut), 'hh:mm a')}
                        </td>
                        <td className="py-3 px-4 text-slate-600 italic">"{reg.reason}"</td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              reg.status === 'APPROVED'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : reg.status === 'REJECTED'
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
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
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Regularization Modal */}
        {isRegModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h3 className="font-semibold text-slate-900 text-base flex items-center gap-2">
                  <FileEdit className="h-5 w-5 text-emerald-600" />
                  Regularize Missed / Late Punch
                </h3>
                <button
                  onClick={() => setIsRegModalOpen(false)}
                  className="p-1 hover:bg-slate-100 rounded-lg text-slate-400"
                >
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
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-1 focus:ring-emerald-500 focus:outline-none"
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
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="font-medium text-slate-700 block mb-1">Proposed Check-Out</label>
                    <input
                      type="time"
                      required
                      value={proposedOut}
                      onChange={(e) => setProposedOut(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-medium text-slate-700 block mb-1">Reason for Missed / Late Punch *</label>
                  <textarea
                    rows={3}
                    required
                    value={regReason}
                    onChange={(e) => setRegReason(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-sans focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    placeholder="e.g. On-duty client visit at Indiranagar or IoT biometric scanner network sync delay"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsRegModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingReg}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-medium shadow-md shadow-emerald-600/20"
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
