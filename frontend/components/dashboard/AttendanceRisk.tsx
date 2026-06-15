"use client";

import { useState, useRef, useEffect } from "react";
import { AlertCircle, Upload, CheckCircle2, ChevronRight, Download, Plus, Trash2, X } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { api } from "@/lib/api";
import { createClient } from "@/lib/supabase";
import { showPointsToast } from "@/lib/toast";

export interface AttendanceRecord {
  id: string;
  subject: string;
  course_code?: string;
  attended: number;
  total: number;
  percentage: number;
  risk_level: "safe" | "warning" | "danger";
  classes_can_miss: number;
}

export default function AttendanceRisk({
  records,
  onRefresh,
  onUploadSuccess,
}: {
  records: AttendanceRecord[];
  onRefresh: () => void;
  onUploadSuccess?: (data: AttendanceRecord[]) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [showCondonation, setShowCondonation] = useState(false);

  // Local attendance data state synchronized with records prop
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);

  useEffect(() => {
    setAttendanceData(records || []);
  }, [records]);

  // Manual entry rows state
  const [manualRows, setManualRows] = useState<{ subject: string; attended: string; total: string }[]>([
    { subject: "", attended: "", total: "" }
  ]);

  // Condonation states
  const [condonationSubject, setCondonationSubject] = useState("");
  const [absentDates, setAbsentDates] = useState<string[]>([]);
  const [newDate, setNewDate] = useState("");
  const [condonationReason, setCondonationReason] = useState("");
  const [generatingCondonation, setGeneratingCondonation] = useState(false);
  const [condonationSuccess, setCondonationSuccess] = useState(false);

  // ERP connection states
  const [erpStatus, setErpStatus] = useState<{ connected: boolean; erp_url?: string; username?: string; last_synced?: string | null }>({ connected: false });
  const [erpUrl, setErpUrl] = useState("http://localhost:8001");
  const [enrollmentNo, setEnrollmentNo] = useState("");
  const [password, setPassword] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    fetchErpStatus();
  }, []);

  const fetchErpStatus = async () => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await api.get("/api/attendance/erp-status", { headers });
      if (res.data) {
        setErpStatus(res.data);
        if (res.data.erp_url) setErpUrl(res.data.erp_url);
        if (res.data.username) setEnrollmentNo(res.data.username);
      }
    } catch (err) {
      console.error("Failed to fetch ERP status:", err);
    }
  };

  const handleConnectErp = async () => {
    setConnecting(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const res = await api.post("/api/attendance/connect-erp", {
        erp_url: erpUrl.trim(),
        username: enrollmentNo.trim(),
        password: password.trim()
      }, { headers });

      if (res.data?.success) {
        alert(`ERP Connected! ${res.data.subjects_synced} subjects synced`);
        setAttendanceData(res.data.attendance);
        if (onUploadSuccess) {
          onUploadSuccess(res.data.attendance);
        }
        showPointsToast(5, "+5 points for connecting ERP! 🏆");
        setPassword("");
        fetchErpStatus();
      }
    } catch (err) {
      alert("Failed to connect ERP. Please check your credentials.");
    } finally {
      setConnecting(false);
    }
  };

  const handleSyncErp = async () => {
    setSyncing(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const res = await api.post("/api/attendance/sync-erp", {}, { headers });
      alert(`ERP synced! ${res.data.synced} subjects updated.`);
      setAttendanceData(res.data.attendance);
      if (onUploadSuccess) {
        onUploadSuccess(res.data.attendance);
      }
      fetchErpStatus();
    } catch (err) {
      alert("Failed to sync ERP attendance.");
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnectErp = async () => {
    if (!confirm("Are you sure you want to disconnect from ERP?")) return;
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      await api.post("/api/attendance/disconnect-erp", {}, { headers });
      setErpStatus({ connected: false });
      setEnrollmentNo("");
      setPassword("");
      alert("ERP disconnected.");
      onRefresh();
    } catch (err) {
      alert("Failed to disconnect ERP.");
    }
  };

  // Handle screenshot upload
  const handleScreenshotUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    setUploading(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await api.post("/api/attendance/upload-screenshot", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${token}`
        }
      });
      alert("ERP screenshot processed successfully!");
      if (res.data && res.data.subjects) {
        setAttendanceData(res.data.subjects);
        if (onUploadSuccess) {
          onUploadSuccess(res.data.subjects);
        }
      }
    } catch {
      alert("Failed to parse attendance screenshot. Please try again or use manual entry.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Manual entry submission
  const handleManualSubmit = async () => {
    const entries = manualRows
      .filter(r => r.subject.trim() && r.attended.trim() && r.total.trim())
      .map(r => {
        const att = parseInt(r.attended);
        const tot = parseInt(r.total);
        return {
          subject: r.subject.trim(),
          attended: isNaN(att) ? 0 : att,
          total: isNaN(tot) ? 0 : tot
        };
      })
      .filter(r => r.total > 0);

    if (entries.length === 0) {
      alert("Please enter at least one valid subject with attended/total classes.");
      return;
    }

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      await api.post("/api/attendance/manual", { entries }, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });
      setShowManual(false);
      setManualRows([{ subject: "", attended: "", total: "" }]);
      onRefresh();
    } catch {
      alert("Failed to update attendance.");
    }
  };

  const handleAddManualRow = () => {
    setManualRows([...manualRows, { subject: "", attended: "", total: "" }]);
  };

  const handleRemoveManualRow = (index: number) => {
    if (manualRows.length === 1) return;
    setManualRows(manualRows.filter((_, i) => i !== index));
  };

  // Condonation modal trigger
  const handleOpenCondonation = (subject: string) => {
    setCondonationSubject(subject);
    setAbsentDates([]);
    setNewDate("");
    setCondonationReason("");
    setCondonationSuccess(false);
    setShowCondonation(true);
  };

  // Condonation date list management
  const handleAddDate = () => {
    if (!newDate) return;
    if (absentDates.includes(newDate)) return;
    setAbsentDates([...absentDates, newDate]);
    setNewDate("");
  };

  const handleRemoveDate = (date: string) => {
    setAbsentDates(absentDates.filter(d => d !== date));
  };

  const handleGenerateCondonation = async () => {
    if (absentDates.length === 0) {
      alert("Please add at least one absent date.");
      return;
    }
    if (!condonationReason.trim()) {
      alert("Please provide a reason for your absence.");
      return;
    }

    setGeneratingCondonation(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await api.post("/api/condonation/generate", {
        subject: condonationSubject,
        absent_dates: absentDates,
        reason: condonationReason.trim()
      }, {
        responseType: "blob",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      // Create download link for PDF
      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `condonation_${condonationSubject.replace(/\s+/g, "_")}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      setCondonationSuccess(true);
    } catch {
      alert("Failed to generate condonation letter.");
    } finally {
      setGeneratingCondonation(false);
    }
  };

  return (
    <Card>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Attendance Risk</h2>
        <input 
          type="file" 
          ref={fileInputRef} 
          accept="image/*" 
          className="hidden" 
          onChange={handleScreenshotUpload}
        />
        <div className="flex gap-2">
          <Button 
            variant="secondary" 
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="gap-2 px-3 py-1.5 text-xs rounded-lg"
          >
            <Upload size={14} />
            {uploading ? "Reading ERP..." : "Upload ERP Screenshot"}
          </Button>
          <Button 
            variant="secondary" 
            onClick={() => setShowManual(true)}
            className="px-3 py-1.5 text-xs rounded-lg"
          >
            Enter Manually
          </Button>
        </div>
      </div>

      {attendanceData.length === 0 ? (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-100 bg-amber-50 p-4">
          <AlertCircle size={18} className="mt-0.5 text-amber-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-700">
              No attendance data uploaded
            </p>
            <p className="mt-1 text-xs text-amber-600">
              Upload a screenshot of your ERP attendance table or click "Enter Manually" above to check if you are at risk of falling below the 75% attendance criteria.
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {attendanceData.map((r) => {
            const percentage = r.percentage;
            
            let barColor = "bg-emerald-500";
            let textColor = "text-emerald-700";
            let percentageBg = "bg-emerald-55 text-emerald-700 bg-emerald-50";
            let statusText = "Safe ✓";
            
            if (percentage < 75) {
              barColor = "bg-rose-500";
              textColor = "text-rose-700";
              percentageBg = "bg-rose-50 text-rose-700 font-bold";
              statusText = "Danger: Attend all classes";
            } else if (percentage < 80) {
              barColor = "bg-amber-500";
              textColor = "text-amber-700";
              percentageBg = "bg-amber-50 text-amber-700 font-semibold";
              statusText = `Warning: ${r.classes_can_miss} classes to danger`;
            }

            return (
              <div 
                key={r.id || r.subject} 
                className="relative rounded-xl border border-slate-100 bg-white p-4 shadow-sm overflow-hidden hover:shadow-md transition-all duration-200"
              >
                {/* Top-level progress bar */}
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-slate-100 overflow-hidden">
                  <div 
                    className={`h-full ${barColor} transition-all duration-500`} 
                    style={{ width: `${Math.min(r.percentage, 100)}%` }}
                  />
                </div>

                <div className="flex items-start justify-between pt-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">{r.subject}</h3>
                    {r.course_code && (
                      <p className="text-[10px] text-slate-400 font-normal mt-0.5 tracking-wider uppercase">{r.course_code}</p>
                    )}
                    <p className="text-xs text-slate-500 mt-2 font-medium">
                      Attended: <span className="font-bold text-slate-800">{r.attended}</span> / <span className="text-slate-650">{r.total}</span> classes
                    </p>
                  </div>
                  
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-sm font-bold px-2.5 py-0.5 rounded-lg ${percentageBg}`}>
                      {r.percentage}%
                    </span>
                    <span className="text-[10px] font-semibold text-slate-400 mt-1">{statusText}</span>
                  </div>
                </div>

                {percentage < 75 && (
                  <div className="mt-3 pt-3 border-t border-slate-100 flex justify-end">
                    <Button 
                      variant="primary" 
                      onClick={() => handleOpenCondonation(r.subject)}
                      className="px-2.5 py-1.5 h-7 text-[10px] bg-red-600 hover:bg-red-700 text-white border-none rounded-lg font-semibold flex items-center gap-1"
                    >
                      <Download size={10} />
                      Apply for Condonation
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* MANUAL ENTRY MODAL */}
      {showManual && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="relative flex flex-col w-full max-w-lg max-h-[90vh] bg-white rounded-2xl p-6 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">Enter Attendance Manually</h3>
              <button onClick={() => setShowManual(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-3 pr-1">
              {manualRows.map((row, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <input
                    type="text"
                    placeholder="Subject Name"
                    value={row.subject}
                    onChange={(e) => {
                      const updated = [...manualRows];
                      updated[idx].subject = e.target.value;
                      setManualRows(updated);
                    }}
                    className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <input
                    type="number"
                    placeholder="Attended"
                    value={row.attended}
                    onChange={(e) => {
                      const updated = [...manualRows];
                      updated[idx].attended = e.target.value;
                      setManualRows(updated);
                    }}
                    className="w-20 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <span className="text-slate-400 text-sm">/</span>
                  <input
                    type="number"
                    placeholder="Total"
                    value={row.total}
                    onChange={(e) => {
                      const updated = [...manualRows];
                      updated[idx].total = e.target.value;
                      setManualRows(updated);
                    }}
                    className="w-20 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button 
                    onClick={() => handleRemoveManualRow(idx)}
                    disabled={manualRows.length === 1}
                    className="text-red-400 hover:text-red-600 disabled:opacity-30 p-1"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}

              <Button 
                variant="secondary" 
                onClick={handleAddManualRow}
                className="mt-2 w-full gap-1 py-1.5 text-xs rounded-lg"
              >
                <Plus size={14} /> Add Subject Row
              </Button>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowManual(false)}>Cancel</Button>
              <Button onClick={handleManualSubmit}>Save Attendance</Button>
            </div>
          </div>
        </div>
      )}

      {/* CONDONATION MODAL */}
      {showCondonation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">Condonation Letter</h3>
              <button onClick={() => setShowCondonation(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <div className="py-4 space-y-4">
              <p className="text-xs text-slate-500">
                Generate a formal attendance condonation application for <strong className="font-semibold">{condonationSubject}</strong>.
              </p>

              {/* Absent dates multi select wrapper */}
              <div>
                <label className="text-xs font-semibold text-slate-600">Dates of Absence</label>
                <div className="flex gap-2 mt-1.5">
                  <input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="flex-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <Button onClick={handleAddDate} className="h-8 px-3 py-1 text-xs rounded-lg">Add</Button>
                </div>

                {/* Display added dates */}
                {absentDates.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {absentDates.map(date => (
                      <span 
                        key={date}
                        className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 text-[10px] px-2 py-0.5 rounded-full font-medium"
                      >
                        {date}
                        <button onClick={() => handleRemoveDate(date)} className="text-slate-400 hover:text-slate-600">
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600">Reason for Absence</label>
                <textarea
                  rows={3}
                  value={condonationReason}
                  onChange={(e) => setCondonationReason(e.target.value)}
                  placeholder="Medical grounds, family emergency, college event participation, etc."
                  className="w-full mt-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                />
              </div>

              {condonationSuccess && (
                <div className="rounded-lg bg-green-50 border border-green-100 p-3 flex items-start gap-2 text-green-700 text-xs">
                  <CheckCircle2 size={16} className="mt-0.5 text-green-500 flex-shrink-0" />
                  <p>Condonation letter downloaded. Submit it to your HOD.</p>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowCondonation(false)}>Close</Button>
              <Button 
                onClick={handleGenerateCondonation}
                disabled={generatingCondonation || absentDates.length === 0 || !condonationReason.trim()}
                className="gap-2"
              >
                <Download size={14} />
                {generatingCondonation ? "Generating..." : "Generate Letter"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Connect ERP (Auto-sync) section */}
      <div className="mt-6 border-t border-slate-100 pt-6">
        {!erpStatus.connected ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <span>🔗</span> Connect Your College ERP
            </h3>
            <p className="text-xs text-slate-500">Auto-sync attendance every Monday</p>
            
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">ERP URL</label>
                <input 
                  type="text" 
                  value={erpUrl}
                  onChange={(e) => setErpUrl(e.target.value)}
                  placeholder="http://localhost:8001"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Enrollment No</label>
                  <input 
                    type="text" 
                    value={enrollmentNo}
                    onChange={(e) => setEnrollmentNo(e.target.value)}
                    placeholder="e.g. 2024CSE001"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Password</label>
                  <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
            </div>

            <Button 
              onClick={handleConnectErp} 
              disabled={connecting || !enrollmentNo || !password}
              className="w-full text-xs py-2.5 rounded-xl shadow-sm hover:shadow"
            >
              {connecting ? "Verifying credentials..." : "Connect & Sync Now"}
            </Button>
            <p className="text-[10px] text-center text-slate-400">🔒 Credentials stored securely</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <span className="text-green-500 font-bold">✓</span> ERP Connected
              </h3>
              <span className="text-[10px] bg-green-50 text-green-600 font-semibold px-2 py-0.5 rounded border border-green-100">
                Connected
              </span>
            </div>
            <div className="text-xs text-slate-600 space-y-1">
              <p>Enrollment: <strong className="font-semibold">{erpStatus.username}</strong></p>
              <p>Last synced: <span className="font-mono text-[11px] text-slate-500">{erpStatus.last_synced ? new Date(erpStatus.last_synced).toLocaleString("en-IN") : "Never"}</span></p>
            </div>
            
            <div className="flex gap-2">
              <Button 
                onClick={handleSyncErp} 
                disabled={syncing}
                className="flex-1 text-xs py-2 rounded-xl"
              >
                {syncing ? "Syncing..." : "Sync Now"}
              </Button>
              <Button 
                variant="secondary" 
                onClick={handleDisconnectErp}
                className="flex-1 text-xs py-2 rounded-xl text-red-500 hover:text-red-700 hover:bg-red-50"
              >
                Disconnect
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

