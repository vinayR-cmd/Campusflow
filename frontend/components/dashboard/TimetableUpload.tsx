"use client";

import { useState, useCallback } from "react";
import { Upload } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { api } from "@/lib/api";
import { createClient } from "@/lib/supabase";

interface Slot {
  day: string;
  time_start: string;
  time_end: string;
  subject: string;
  room: string;
  faculty: string;
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function TimetableUpload({ onConfirmed }: { onConfirmed: () => void }) {
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = async (file: File) => {
    setUploading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes.user;
      if (!user) throw new Error("Not authenticated");

      const ext = file.name.split(".").pop();
      const path = `${user.id}/timetable.${ext}`;
      await supabase.storage.from("timetables").upload(path, file, { upsert: true });

      const formData = new FormData();
      formData.append("file", file);
      const res = await api.post("/api/timetable/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setSlots(res.data.slots);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }, []);

  const updateSlot = (index: number, field: keyof Slot, value: string) => {
    if (!slots) return;
    const next = [...slots];
    next[index] = { ...next[index], [field]: value };
    setSlots(next);
  };

  const removeSlot = (index: number) => {
    if (!slots) return;
    setSlots(slots.filter((_, i) => i !== index));
  };

  const handleConfirm = async () => {
    if (!slots) return;
    setConfirming(true);
    setError(null);
    try {
      await api.post("/api/timetable/confirm", { slots });
      onConfirmed();
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to save timetable");
    } finally {
      setConfirming(false);
    }
  };

  return (
    <Card>
      <h2 className="text-lg font-semibold text-slate-900">Upload your timetable</h2>
      <p className="mt-1 text-sm text-slate-500">
        Upload a photo or PDF of your class timetable and we'll extract your schedule
        automatically.
      </p>

      {!slots && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`mt-4 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-10 text-center transition ${
            dragOver ? "border-primary bg-primary/5" : "border-slate-200"
          }`}
        >
          <Upload size={28} className="text-slate-400" />
          <p className="text-sm text-slate-500">Drag & drop your timetable here, or</p>
          <label className="cursor-pointer text-sm font-medium text-primary">
            browse files
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
          </label>
          <p className="text-xs text-slate-400">PDF, JPG, PNG, or WEBP</p>
          {uploading && (
            <p className="mt-2 text-sm text-primary">Extracting timetable with Gemini...</p>
          )}
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

      {slots && (
        <div className="mt-4">
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">Day</th>
                  <th className="px-3 py-2 text-left">Start</th>
                  <th className="px-3 py-2 text-left">End</th>
                  <th className="px-3 py-2 text-left">Subject</th>
                  <th className="px-3 py-2 text-left">Room</th>
                  <th className="px-3 py-2 text-left">Faculty</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {slots.map((slot, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="px-2 py-1">
                      <select
                        value={slot.day}
                        onChange={(e) => updateSlot(i, "day", e.target.value)}
                        className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                      >
                        {DAYS.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-1">
                      <input
                        value={slot.time_start}
                        onChange={(e) => updateSlot(i, "time_start", e.target.value)}
                        className="w-20 rounded border border-slate-200 px-2 py-1 text-xs"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        value={slot.time_end}
                        onChange={(e) => updateSlot(i, "time_end", e.target.value)}
                        className="w-20 rounded border border-slate-200 px-2 py-1 text-xs"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        value={slot.subject}
                        onChange={(e) => updateSlot(i, "subject", e.target.value)}
                        className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        value={slot.room}
                        onChange={(e) => updateSlot(i, "room", e.target.value)}
                        className="w-20 rounded border border-slate-200 px-2 py-1 text-xs"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        value={slot.faculty}
                        onChange={(e) => updateSlot(i, "faculty", e.target.value)}
                        className="w-28 rounded border border-slate-200 px-2 py-1 text-xs"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <button onClick={() => removeSlot(i)} className="text-xs text-red-500">
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex gap-3">
            <Button variant="secondary" onClick={() => setSlots(null)}>
              Re-upload
            </Button>
            <Button onClick={handleConfirm} disabled={confirming}>
              {confirming ? "Saving..." : "Confirm Schedule"}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
