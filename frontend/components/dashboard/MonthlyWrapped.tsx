"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, Sparkles } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { api } from "@/lib/api";
import { createClient } from "@/lib/supabase";
import html2canvas from "html2canvas";

interface WrappedData {
  month: string;
  student_name: string;
  attend_start: number;
  attend_end: number;
  tasks_hit: number;
  tasks_total: number;
  ahs_start: number;
  ahs_end: number;
  busiest_week: string;
  ai_insight: string;
}

export default function MonthlyWrapped() {
  const [wrapped, setWrapped] = useState<WrappedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchWrapped();
  }, []);

  const fetchWrapped = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const res = await api.get("/api/wrapped/latest", { headers });
      if (res.data && res.data.month) {
        setWrapped(res.data);
      } else {
        setWrapped(null);
      }
    } catch (err) {
      console.error("Failed to fetch wrapped:", err);
      setWrapped(null);
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = async () => {
    setGenerating(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const res = await api.post("/api/wrapped/generate", {}, { headers });
      if (res.data) {
        setWrapped(res.data);
      }
    } catch (err) {
      console.error("Failed to generate wrapped:", err);
      alert("Failed to compile your Academic Wrapped for this month.");
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async () => {
    if (!cardRef.current) return;
    try {
      const canvas = await html2canvas(cardRef.current, {
        useCORS: true,
        scale: 2, // better quality PNG
        backgroundColor: "#ffffff", // solid white background for high quality download
      });
      const dataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = `academic-wrapped-${wrapped?.month || "month"}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Failed to export image:", err);
      alert("Could not export wrapped card as image");
    }
  };

  return (
    <div className="space-y-6">
      {loading ? (
        <Card className="flex items-center justify-center py-20 text-xs text-slate-400">
          <Loader2 size={16} className="animate-spin mr-2" />
          Loading your Academic Wrapped...
        </Card>
      ) : !wrapped ? (
        <Card className="p-10 text-center space-y-4 bg-white">
          <Sparkles className="mx-auto text-indigo-500 animate-bounce" size={36} />
          <h2 className="text-base font-bold text-slate-800">Your Monthly Academic Wrapped</h2>
          <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
            Generate an infographic review of your month's study habits, attendance progression, deadlines met, and twin scores.
          </p>
          <Button onClick={handleRegenerate} disabled={generating} className="gap-2 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700">
            {generating ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Creating your monthly summary...
              </>
            ) : (
              <>
                <Sparkles size={14} />
                Generate My Academic Wrapped
              </>
            )}
          </Button>
        </Card>
      ) : (
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Infographic card wrapper for download */}
          <div
            ref={cardRef}
            id="academic-wrapped-card"
            className="bg-white border border-gray-100 rounded-3xl p-8 shadow-sm"
          >
            {/* Header */}
            <div className="text-center mb-8">
              <p className="text-sm text-purple-600 font-medium uppercase tracking-widest mb-1">
                Academic Review
              </p>
              <h2 className="text-3xl font-bold text-gray-900">
                {wrapped.month}
              </h2>
              <p className="text-gray-500 mt-1">{wrapped.student_name}'s Month</p>
            </div>

            {/* Stats Grid - 4 cards */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              
              {/* Attendance Card */}
              <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-sm">
                    📊
                  </div>
                  <span className="text-sm font-medium text-gray-500">Attendance</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{wrapped.attend_end}%</p>
                <p className="text-sm text-green-600 mt-1">
                  ↑ from {wrapped.attend_start}%
                </p>
              </div>

              {/* Deadlines Card */}
              <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center text-sm">
                    ✅
                  </div>
                  <span className="text-sm font-medium text-gray-500">Deadlines</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{wrapped.tasks_hit}/{wrapped.tasks_total}</p>
                <p className="text-sm text-gray-500 mt-1">submitted on time</p>
              </div>

              {/* AHS Card */}
              <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center text-sm">
                    🎯
                  </div>
                  <span className="text-sm font-medium text-gray-500">AHS Score</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{wrapped.ahs_end}</p>
                <p className="text-sm text-purple-600 mt-1">+{wrapped.ahs_end - wrapped.ahs_start} this month</p>
              </div>

              {/* Busiest Week Card */}
              <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center text-sm">
                    🔥
                  </div>
                  <span className="text-sm font-medium text-gray-500">Peak Week</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{wrapped.busiest_week}</p>
                <p className="text-sm text-gray-500 mt-1">most intense</p>
              </div>

            </div>

            {/* AI Insight - minimal */}
            <div className="bg-purple-50 border-l-4 border-purple-500 rounded-r-xl p-4">
              <p className="text-xs font-semibold text-purple-500 uppercase tracking-wider mb-1">
                AI Insight
              </p>
              <p className="text-gray-700 italic text-sm leading-relaxed">
                "{wrapped.ai_insight}"
              </p>
            </div>

          </div>

          {/* Action buttons */}
          <div className="flex gap-3 justify-center">
            <button
              onClick={handleRegenerate}
              disabled={generating}
              className="px-5 py-2 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Regenerate
            </button>
            <button
              onClick={handleDownload}
              className="px-5 py-2 text-sm bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors flex items-center gap-2"
            >
              ↓ Download
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
