"use client";

import { useState, useEffect } from "react";
import { Smile, Frown, ShieldAlert, Heart, Calendar, Activity, Zap, Brain } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { api } from "@/lib/api";
import { createClient } from "@/lib/supabase";
import { showPointsToast } from "@/lib/toast";

interface MoodLog {
  id: string;
  stress_score: number;
  emoji: string;
  note: string;
  logged_at: string;
}

interface TwinState {
  wellness_flag: boolean;
  exam_week: boolean;
  ahs_score: number;
  cognitive_load: number;
  average_stress_score: number;
}

const EMOJIS = [
  { char: "😁", score: 2, label: "Excited / Joyful" },
  { char: "😊", score: 4, label: "Calm / Relaxed" },
  { char: "🙂", score: 6, label: "Neutral / Balanced" },
  { char: "😐", score: 8, label: "Tired / Stressed" },
  { char: "😞", score: 10, label: "Overwhelmed" },
];

export default function WellnessTracker({ onUpdate }: { onUpdate?: () => void }) {
  const [twin, setTwin] = useState<TwinState | null>(null);
  const [history, setHistory] = useState<MoodLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [selectedEmoji, setSelectedEmoji] = useState(EMOJIS[2]);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchWellnessData();
  }, []);

  const fetchWellnessData = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const [twinRes, historyRes] = await Promise.all([
        api.get("/api/wellness/twin", { headers }),
        api.get("/api/wellness/history", { headers }),
      ]);

      setTwin(twinRes.data);
      setHistory(historyRes.data || []);
    } catch (err) {
      console.error("Failed to fetch wellness data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogMood = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      await api.post(
        "/api/wellness/mood",
        {
          stress_score: selectedEmoji.score,
          emoji: selectedEmoji.char,
          note: note.trim(),
        },
        { headers }
      );

      // Award points
      try {
        await api.post(
          "/api/leaderboard/award-points",
          { action: "wellness_checkin", description: "Weekly mood check-in" },
          { headers }
        );
        showPointsToast(2, "+2 points for checking in! 💚");
      } catch (pointErr) {
        console.error("Failed to award points:", pointErr);
      }

      setNote("");
      await fetchWellnessData();
      if (onUpdate) onUpdate();
      alert("Mood logged successfully!");
    } catch (err) {
      console.error("Failed to log mood:", err);
      alert("Failed to log mood.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleExam = async () => {
    if (!twin) return;
    const nextVal = !twin.exam_week;
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      await api.post("/api/wellness/twin/toggle-exam", { exam_week: nextVal }, { headers });
      setTwin({ ...twin, exam_week: nextVal });
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error("Failed to toggle exam mode:", err);
    }
  };

  const handleToggleWellnessFlag = async () => {
    if (!twin) return;
    const nextVal = !twin.wellness_flag;
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      await api.post("/api/wellness/twin/toggle-wellness", { wellness_flag: nextVal }, { headers });
      setTwin({ ...twin, wellness_flag: nextVal });
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error("Failed to toggle wellness flag:", err);
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Card className="flex flex-col h-full">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-1.5">
            <Heart className="text-red-500 fill-red-50" size={18} />
            Wellness & Mood Tracker
          </h2>
          <p className="text-xs text-slate-500">Sync wellness metrics with your digital twin</p>
        </div>
      </div>

      {loading ? (
        <p className="text-center py-12 text-xs text-slate-400">Loading wellness dashboard...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-4 flex-1">
          {/* Left panel: twin metrics + controls */}
          <div className="space-y-4">
            {/* Twin Status Summary Card */}
            <div className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Activity size={12} className="text-slate-400" />
                  Digital Twin State
                </span>
                {twin?.wellness_flag ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full border border-red-200 bg-red-50 text-red-600 font-semibold animate-pulse">
                    Wellness Alert Active
                  </span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-full border border-slate-200 bg-slate-100 text-slate-500 font-semibold">
                    Wellness Balanced
                  </span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm">
                  <p className="text-[10px] font-semibold text-slate-400">AHS Score</p>
                  <p className={`text-base font-extrabold mt-1 ${
                    (twin?.ahs_score ?? 0) >= 80 ? "text-green-600" : ((twin?.ahs_score ?? 0) >= 65 ? "text-amber-600" : "text-red-600")
                  }`}>{twin?.ahs_score}</p>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm">
                  <p className="text-[10px] font-semibold text-slate-400">Cognitive Load</p>
                  <p className={`text-base font-extrabold mt-1 ${
                    (twin?.cognitive_load ?? 0) >= 70 ? "text-red-600" : ((twin?.cognitive_load ?? 0) >= 40 ? "text-amber-600" : "text-green-600")
                  }`}>{twin?.cognitive_load}%</p>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm">
                  <p className="text-[10px] font-semibold text-slate-400">Weekly Stress</p>
                  <p className={`text-base font-extrabold mt-1 ${
                    (twin?.average_stress_score ?? 0) >= 7 ? "text-red-600" : ((twin?.average_stress_score ?? 0) >= 4 ? "text-amber-600" : "text-green-600")
                  }`}>{twin?.average_stress_score}/10</p>
                </div>
              </div>
            </div>

            {/* Quick toggles */}
            <div className="flex gap-2">
              {/* Exam mode toggle */}
              <button
                onClick={handleToggleExam}
                className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-semibold transition ${
                  twin?.exam_week
                    ? "bg-amber-500 text-white border-amber-500 shadow-sm"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                <Zap size={14} className={twin?.exam_week ? "fill-white" : ""} />
                {twin?.exam_week ? "Disable Exam Mode" : "Enable Exam Mode"}
              </button>

              {/* Request Wellness check-in flag toggle */}
              <button
                onClick={handleToggleWellnessFlag}
                className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-semibold transition ${
                  twin?.wellness_flag
                    ? "bg-red-600 text-white border-red-600 shadow-sm"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                <ShieldAlert size={14} />
                {twin?.wellness_flag ? "Clear Wellness Flag" : "Flag High Stress"}
              </button>
            </div>

            {/* Recent logs */}
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                <Calendar size={11} />
                Recent Mood Logs
              </p>
              <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-1">
                {history.length > 0 ? (
                  history.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-start justify-between p-2.5 rounded-xl border border-slate-50 bg-white text-[11px]"
                    >
                      <div className="flex items-start gap-2 min-w-0">
                        <span className="text-sm shrink-0 mt-0.5">{log.emoji}</span>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-700 leading-tight">
                            Stress: {log.stress_score}/10
                          </p>
                          <p className="text-slate-500 mt-0.5 truncate leading-tight">
                            {log.note || <span className="italic text-slate-400">No comment</span>}
                          </p>
                        </div>
                      </div>
                      <span className="text-[9px] text-slate-400 shrink-0 self-center">
                        {formatTimeAgo(log.logged_at)}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs italic text-slate-400 py-3 text-center">No logged moods yet</p>
                )}
              </div>
            </div>
          </div>

          {/* Right panel: Log new mood form */}
          <form onSubmit={handleLogMood} className="flex flex-col justify-between border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-5 space-y-4">
            <div className="space-y-3">
              <h3 className="font-semibold text-slate-900 text-xs flex items-center gap-1.5">
                <Smile className="text-primary" size={14} />
                Log Current Stress Level
              </h3>
              
              <div className="flex justify-between items-center bg-slate-50/50 p-3 rounded-2xl border border-slate-100">
                {EMOJIS.map((emoji) => {
                  const isSelected = selectedEmoji.score === emoji.score;
                  return (
                    <button
                      key={emoji.score}
                      type="button"
                      onClick={() => setSelectedEmoji(emoji)}
                      className={`text-2xl p-2 rounded-xl transition duration-150 transform hover:scale-125 ${
                        isSelected
                          ? "bg-primary-light/10 shadow-sm border border-primary/25 scale-110"
                          : "opacity-60 hover:opacity-100"
                      }`}
                      title={emoji.label}
                    >
                      {emoji.char}
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-center font-bold text-primary mt-1">
                {selectedEmoji.label} (Stress Score: {selectedEmoji.score}/10)
              </p>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Brain size={11} />
                  How are you feeling? (Optional)
                </label>
                <textarea
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Share what is causing stress or mood details..."
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary resize-none"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl py-2.5 text-xs shadow-sm hover:shadow"
            >
              {submitting ? "Logging..." : "Log Mood"}
            </Button>
          </form>
        </div>
      )}
    </Card>
  );
}
