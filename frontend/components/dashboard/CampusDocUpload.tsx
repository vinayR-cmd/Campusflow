"use client";

import { useState } from "react";
import { X } from "lucide-react";
import Button from "@/components/ui/Button";
import { api } from "@/lib/api";
import { createClient } from "@/lib/supabase";
import { showPointsToast } from "@/lib/toast";

const DOC_TYPES = [
  "Syllabus",
  "Academic Calendar",
  "Hostel Rules",
  "Exam Schedule",
  "Placement Notice",
  "General Notice",
  "Other",
];

const BRANCHES = ["All", "CSE", "ECE", "EEE", "ME", "CE", "IT", "Other"];
const YEARS = ["All", "1", "2", "3", "4"];
const SECTIONS = ["All", "A", "B", "C", "D"];
const HOSTEL_WINGS = ["All", "Boys", "Girls"];

export default function CampusDocUpload({
  onClose,
  onUploaded,
}: {
  onClose: () => void;
  onUploaded: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState(DOC_TYPES[0]);
  const [branch, setBranch] = useState("All");
  const [year, setYear] = useState("All");
  const [section, setSection] = useState("All");
  const [hostelWing, setHostelWing] = useState("All");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async () => {
    if (!file) {
      setError("Please choose a file");
      return;
    }
    setUploading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes.user;
      if (!user) throw new Error("Not authenticated");

      const path = `${user.id}/${Date.now()}_${file.name}`;
      await supabase.storage.from("campus-docs").upload(path, file);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("doc_type", docType);
      formData.append("branch", branch);
      formData.append("year", year);
      formData.append("section", section);
      formData.append("hostel_wing", hostelWing);

      const sessionRes = await supabase.auth.getSession();
      const token = sessionRes.data.session?.access_token;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      await api.post("/api/kb/upload", formData, {
        headers: { 
          "Content-Type": "multipart/form-data",
          ...headers
        },
      });

      try {
        const res = await api.post(
          "/api/leaderboard/award-points",
          { action: "campus_kb_uploaded", description: "Uploaded campus document" },
          { headers }
        );
        if (res.data?.success) {
          showPointsToast(5, "+5 points for uploading campus document! 🏆");
        }
      } catch (pointErr) {
        console.error("Failed to award document points:", pointErr);
      }

      onUploaded();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.detail || err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Upload Campus Document</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">File</label>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Document type</label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {DOC_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Select label="Branch" value={branch} onChange={setBranch} options={BRANCHES} />
            <Select label="Year" value={year} onChange={setYear} options={YEARS} />
            <Select label="Section" value={section} onChange={setSection} options={SECTIONS} />
            <Select
              label="Hostel wing"
              value={hostelWing}
              onChange={setHostelWing}
              options={HOSTEL_WINGS}
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <Button onClick={handleUpload} disabled={uploading} className="w-full">
            {uploading ? "Uploading..." : "Upload"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}
