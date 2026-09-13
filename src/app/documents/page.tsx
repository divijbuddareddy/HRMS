'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import {
  FileSignature,
  FileText,
  Plus,
  ShieldCheck,
  CheckCircle,
  Eye,
  X,
  Send,
  Lock,
} from 'lucide-react';
import { format } from 'date-fns';

export default function DocumentsPage() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  // Signing canvas / state
  const [signing, setSigning] = useState(false);

  const fetchDocs = async () => {
    setLoading(true);
    try {
      const [dRes, tRes] = await Promise.all([
        fetch('/api/documents'),
        fetch('/api/documents/templates'),
      ]);
      if (dRes.ok) setDocuments((await dRes.json()).documents || []);
      if (tRes.ok) setTemplates((await tRes.json()).templates || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocs();
  }, []);

  const handleSignDocument = async (docId: string) => {
    setSigning(true);
    try {
      const res = await fetch(`/api/documents/${docId}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signatureDataUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="30"><text y="20" font-family="cursive" font-size="18" fill="%2316a34a">Digital Signature</text></svg>',
        }),
      });
      const data = await res.json();
      if (res.ok) {
        alert('✅ Document digitally signed and sealed with SHA-256 checksum!');
        setSelectedDoc(null);
        await fetchDocs();
      } else {
        alert(data.error || 'Signing failed');
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSigning(false);
    }
  };

  return (
    <DashboardLayout title="Documents & Internal E-Sign" subtitle="Versioned legal templates, merge tags, and digital signature audit trail">
      <div className="space-y-6">
        {/* Top Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-xs text-slate-500 block">Total Issued Documents</span>
            <span className="text-2xl font-bold text-slate-900">{documents.length}</span>
            <span className="text-[11px] text-emerald-600 block mt-0.5">SHA-256 tamper-evident</span>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-xs text-slate-500 block">Signed & Executed</span>
            <span className="text-2xl font-bold text-emerald-600">
              {documents.filter((d) => d.status === 'SIGNED').length}
            </span>
            <span className="text-[11px] text-slate-400 block mt-0.5">Legally binding internal e-sign</span>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-xs text-slate-500 block">Active HR Templates</span>
            <span className="text-xs font-semibold text-slate-800 block mt-2">Offer, Appointment, NDA, Relieving</span>
            <span className="text-[11px] text-slate-400 block">Dynamic merge tags</span>
          </div>
        </div>

        {/* Documents Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center text-xs">
            <span className="font-semibold text-slate-800">Employment & Legal Documents</span>
            <span className="text-slate-500 font-mono">Immutable Signed Store</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4">Document Title</th>
                  <th className="py-3 px-4">Recipient Employee</th>
                  <th className="py-3 px-4">Checksum (SHA-256)</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-emerald-600" />
                        {doc.title}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-700 font-medium">
                      {doc.employee?.displayName || doc.employee?.firstName}
                      <span className="text-[11px] text-slate-400 font-mono block">{doc.employee?.employeeCode}</span>
                    </td>
                    <td className="py-3 px-4 text-slate-500 font-mono text-[11px] truncate max-w-[140px]">
                      {doc.checksumSha256}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          doc.status === 'SIGNED'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {doc.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setSelectedDoc(doc)}
                        className="px-3 py-1 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 font-medium rounded-lg text-xs transition-colors border border-slate-200"
                      >
                        View & Sign
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* View & Sign Modal */}
        {selectedDoc && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 my-8 space-y-4">
              <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">{selectedDoc.title}</h3>
                  <p className="text-xs text-slate-500 font-mono">Checksum: {selectedDoc.checksumSha256}</p>
                </div>
                <button onClick={() => setSelectedDoc(null)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div
                className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-800 leading-relaxed max-h-80 overflow-y-auto font-sans"
                dangerouslySetInnerHTML={{ __html: selectedDoc.contentHtml }}
              />

              {selectedDoc.status === 'SIGNED' ? (
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center gap-2 text-xs text-emerald-800 font-semibold">
                  <CheckCircle className="h-5 w-5 text-emerald-600" />
                  Digitally Signed by {selectedDoc.signature?.signer?.firstName || 'Employee'} on {format(new Date(selectedDoc.signedAt || new Date()), 'dd MMM yyyy, hh:mm a')}
                </div>
              ) : (
                <div className="p-4 bg-slate-100 rounded-xl border border-slate-200 space-y-2 text-xs">
                  <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <FileSignature className="h-4 w-4 text-emerald-600" />
                    Digital Signature Placement
                  </div>
                  <p className="text-slate-500 text-[11px]">
                    Clicking "Apply Digital Signature" will securely stamp your verified certificate and cryptographic SHA-256 hash onto this document.
                  </p>
                </div>
              )}

              <div className="pt-2 flex justify-between items-center">
                <button
                  onClick={() => setSelectedDoc(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-medium"
                >
                  Close
                </button>

                {selectedDoc.status !== 'SIGNED' && (
                  <button
                    disabled={signing}
                    onClick={() => handleSignDocument(selectedDoc.id)}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-sm shadow-emerald-600/20 flex items-center gap-1.5"
                  >
                    <FileSignature className="h-4 w-4" />
                    {signing ? 'Signing...' : 'Apply Digital Signature'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
