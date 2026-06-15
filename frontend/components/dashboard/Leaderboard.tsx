"use client";

import { useState, useEffect } from "react";
import { Trophy, ChevronDown, ChevronUp, Loader2, Sparkles } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { api } from "@/lib/api";
import { createClient } from "@/lib/supabase";

interface LeaderboardEntry {
  student_id: string;
  name: string;
  college: string;
  branch: string;
  year: number;
  linkedin_url: string | null;
  total_points: number;
  actions_count: number;
  is_current_user: boolean;
  rank: number;
}

interface LeaderboardData {
  leaderboard: LeaderboardEntry[];
  college: string | null;
  current_user_rank: LeaderboardEntry | null;
  total_students: number;
}

interface PointsHistory {
  id: string;
  action: string;
  points: number;
  description: string;
  earned_at: string;
}

interface PointsData {
  total_points: number;
  history: PointsHistory[];
  breakdown: Record<string, { count: number; total_points: number }>;
}

export default function Leaderboard() {
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardData | null>(null);
  const [pointsData, setPointsData] = useState<PointsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showHowToEarn, setShowHowToEarn] = useState(false);
  
  // Visibility and LinkedIn states
  const [showName, setShowName] = useState(true);
  const [togglingVisibility, setTogglingVisibility] = useState(false);
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [isEditingLinkedin, setIsEditingLinkedin] = useState(false);
  const [savingLinkedin, setSavingLinkedin] = useState(false);

  useEffect(() => {
    fetchLeaderboardAndPoints();
  }, []);

  const fetchLeaderboardAndPoints = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      // Fetch points and leaderboard scores
      const [scoresRes, pointsRes] = await Promise.all([
        api.get("/api/leaderboard/scores", { headers }),
        api.get("/api/leaderboard/my-points", { headers }),
      ]);

      setLeaderboardData(scoresRes.data);
      setPointsData(pointsRes.data);

      // Fetch user profile to get initial states
      if (session?.user?.id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("show_on_leaderboard, linkedin_url")
          .eq("student_id", session.user.id)
          .maybeSingle();
        
        if (profile) {
          setShowName(profile.show_on_leaderboard ?? true);
          setLinkedinUrl(profile.linkedin_url || "");
        }
      }
    } catch (err) {
      console.error("Failed to fetch leaderboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleVisibility = async () => {
    setTogglingVisibility(true);
    const nextVal = !showName;
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      await api.patch(
        "/api/leaderboard/toggle-visibility",
        { show_name: nextVal },
        { headers }
      );
      setShowName(nextVal);
      // Re-fetch leaderboard to update current display name instantly
      const scoresRes = await api.get("/api/leaderboard/scores", { headers });
      setLeaderboardData(scoresRes.data);
    } catch (err) {
      console.error("Failed to toggle visibility:", err);
      alert("Failed to update visibility settings.");
    } finally {
      setTogglingVisibility(false);
    }
  };

  const handleSaveLinkedin = async () => {
    setSavingLinkedin(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      await api.put(
        "/api/profile/update-linkedin",
        { linkedin_url: linkedinUrl.trim() },
        { headers }
      );
      setIsEditingLinkedin(false);
      // Re-fetch scores and profiles to sync
      const scoresRes = await api.get("/api/leaderboard/scores", { headers });
      setLeaderboardData(scoresRes.data);
      alert("LinkedIn profile updated successfully!");
    } catch (err) {
      console.error("Failed to save LinkedIn url:", err);
      alert("Failed to update LinkedIn URL.");
    } finally {
      setSavingLinkedin(false);
    }
  };

  const getOrdinalYear = (n: number) => {
    if (n === 1) return "1st Year";
    if (n === 2) return "2nd Year";
    if (n === 3) return "3rd Year";
    if (n === 4) return "4th Year";
    return `${n}th Year`;
  };

  const getRankEmoji = (rank: number) => {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return null;
  };

  const getRowStyle = (entry: LeaderboardEntry) => {
    if (entry.is_current_user) {
      return "bg-purple-50/80 border-2 border-purple-200 shadow-sm transition-all";
    }
    if (entry.rank === 1) {
      return "bg-amber-50/50 hover:bg-amber-50/70 border border-amber-200/50 transition-all";
    }
    if (entry.rank === 2) {
      return "bg-slate-50/50 hover:bg-slate-50/70 border border-slate-200/50 transition-all";
    }
    if (entry.rank === 3) {
      return "bg-orange-50/40 hover:bg-orange-50/60 border border-orange-200/40 transition-all";
    }
    return "hover:bg-slate-50/30 transition-all";
  };

  const getRankBadgeStyle = (rank: number) => {
    if (rank === 1) return "bg-amber-100 text-amber-800 border-amber-200";
    if (rank === 2) return "bg-slate-100 text-slate-800 border-slate-200";
    if (rank === 3) return "bg-orange-100 text-orange-800 border-orange-200";
    return "bg-slate-100/60 text-slate-500 border-slate-200/40";
  };

  const breakdown = pointsData?.breakdown || {};

  return (
    <div className="space-y-6">
      {loading ? (
        <Card className="flex items-center justify-center py-20 text-xs text-slate-400">
          <Loader2 size={16} className="animate-spin mr-2" />
          Loading college leaderboard...
        </Card>
      ) : (
        <div className="space-y-6">
          {/* SECTION 1 - My Points Card */}
          <Card className="border border-slate-100 bg-white">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 pb-4 border-b border-slate-100">
              <div className="space-y-2">
                <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <Trophy size={16} className="text-amber-500 fill-amber-50" />
                  🏆 Your Score
                </h2>
                <div className="flex items-baseline gap-4 mt-2">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold text-slate-900 leading-none">
                      {pointsData?.total_points || 0}
                    </span>
                    <span className="text-slate-400 text-xs font-semibold">pts</span>
                  </div>
                  
                  <div className="bg-purple-50 text-purple-700 px-3 py-1 rounded-xl text-xs font-bold border border-purple-100">
                    Rank #{leaderboardData?.current_user_rank?.rank || "N/A"}
                  </div>
                </div>
              </div>

              {/* Edit LinkedIn details & settings */}
              <div className="flex flex-col gap-3 min-w-[240px]">
                <div className="flex items-center justify-between text-xs border-b border-slate-50 pb-2">
                  <span className="text-slate-500 font-medium">Show name on board:</span>
                  <button 
                    onClick={handleToggleVisibility}
                    disabled={togglingVisibility}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${showName ? 'bg-purple-600' : 'bg-slate-200'}`}
                  >
                    <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${showName ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                </div>

                <div className="text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Your LinkedIn:</span>
                    {!isEditingLinkedin && (
                      <button 
                        onClick={() => setIsEditingLinkedin(true)}
                        className="text-primary hover:underline font-semibold"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                  {isEditingLinkedin ? (
                    <div className="flex gap-1.5 mt-1">
                      <input 
                        type="url"
                        value={linkedinUrl}
                        onChange={(e) => setLinkedinUrl(e.target.value)}
                        placeholder="https://linkedin.com/in/..."
                        className="flex-1 text-[11px] border rounded-lg px-2 py-1 focus:outline-none focus:border-primary"
                      />
                      <Button 
                        disabled={savingLinkedin} 
                        onClick={handleSaveLinkedin}
                        className="px-2.5 py-1 text-[10px] rounded-lg"
                      >
                        Save
                      </Button>
                      <Button 
                        variant="secondary"
                        onClick={() => setIsEditingLinkedin(false)}
                        className="px-2 py-1 text-[10px] rounded-lg"
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-700 truncate font-mono">
                      {linkedinUrl || <span className="italic text-slate-400">Not set</span>}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Points Breakdown details */}
            <div className="mt-4">
              <h3 className="text-xs font-bold text-slate-700 mb-3 uppercase tracking-wider">Points Breakdown</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                <div className="p-2.5 rounded-xl border border-slate-50 bg-slate-50/20 text-xs flex justify-between items-center">
                  <span className="text-slate-600">✅ Tasks completed (on-time):</span>
                  <span className="font-bold text-slate-800">{breakdown.task_completed_on_time?.count || 0} × 10 pts</span>
                </div>
                <div className="p-2.5 rounded-xl border border-slate-50 bg-slate-50/20 text-xs flex justify-between items-center">
                  <span className="text-slate-600">⏰ Tasks completed (late):</span>
                  <span className="font-bold text-slate-800">{breakdown.task_completed_late?.count || 0} × 3 pts</span>
                </div>
                <div className="p-2.5 rounded-xl border border-slate-50 bg-slate-50/20 text-xs flex justify-between items-center">
                  <span className="text-slate-600">📊 Attendance bonus (&gt;80%):</span>
                  <span className="font-bold text-slate-800">{breakdown.attendance_above_80?.count || 0} × 5 pts</span>
                </div>
                <div className="p-2.5 rounded-xl border border-slate-50 bg-slate-50/20 text-xs flex justify-between items-center">
                  <span className="text-slate-600">💚 Wellness checkins:</span>
                  <span className="font-bold text-slate-800">{breakdown.wellness_checkin?.count || 0} × 2 pts</span>
                </div>
                <div className="p-2.5 rounded-xl border border-slate-50 bg-slate-50/20 text-xs flex justify-between items-center">
                  <span className="text-slate-600">📚 Campus docs uploaded:</span>
                  <span className="font-bold text-slate-800">{breakdown.campus_kb_uploaded?.count || 0} × 5 pts</span>
                </div>
                <div className="p-2.5 rounded-xl border border-slate-50 bg-slate-50/20 text-xs flex justify-between items-center">
                  <span className="text-slate-600">📧 Gmail connected:</span>
                  <span className="font-bold text-slate-800">{breakdown.gmail_connected?.count || 0} × 3 pts</span>
                </div>
              </div>
            </div>
          </Card>

          {/* SECTION 2 - Leaderboard Table */}
          <Card className="border border-slate-100 bg-white">
            <h2 className="text-sm font-bold text-slate-800 mb-4 flex items-center justify-between">
              <span>Leaderboard — {leaderboardData?.college || "My College"}</span>
              <span className="text-xs text-slate-400 font-semibold">{leaderboardData?.total_students || 0} student(s)</span>
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-semibold">
                    <th className="py-3 px-4 w-16 text-center">Rank</th>
                    <th className="py-3 px-4">Name</th>
                    <th className="py-3 px-4">Branch & Year</th>
                    <th className="py-3 px-4 text-center">Points</th>
                    <th className="py-3 px-4 text-center w-24">LinkedIn</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {leaderboardData?.leaderboard.map((entry) => {
                    const rankEmoji = getRankEmoji(entry.rank);
                    return (
                      <tr key={entry.student_id} className={`group ${getRowStyle(entry)}`}>
                        <td className="py-4 px-4 text-center">
                          <span className={`inline-flex items-center justify-center h-7 w-7 rounded-lg border font-bold text-sm ${getRankBadgeStyle(entry.rank)}`}>
                            {rankEmoji ? rankEmoji : entry.rank}
                          </span>
                        </td>
                        <td className="py-4 px-4 font-semibold text-slate-800">
                          <div className="flex items-center gap-2">
                            {entry.linkedin_url ? (
                              <a 
                                href={entry.linkedin_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 hover:underline font-bold"
                              >
                                {entry.name}
                              </a>
                            ) : (
                              <span>{entry.name}</span>
                            )}
                            {entry.is_current_user && (
                              <span className="text-[10px] bg-purple-600 text-white font-bold px-1.5 py-0.5 rounded shadow-sm">
                                You
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-4 text-slate-500">
                          {entry.branch} • {getOrdinalYear(entry.year)}
                        </td>
                        <td className="py-4 px-4 text-center font-extrabold text-slate-900">
                          <div className="flex items-center justify-center gap-1">
                            <Trophy size={14} className="text-amber-500 fill-amber-50" />
                            {entry.total_points}
                          </div>
                        </td>
                        <td className="py-4 px-4 text-center">
                          {entry.linkedin_url ? (
                            <a 
                              href={entry.linkedin_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center text-blue-600 hover:text-blue-800 hover:scale-110 transition p-1.5 rounded-lg bg-blue-50/50"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                              </svg>
                            </a>
                          ) : (
                            <span className="text-slate-400 font-semibold">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* SECTION 3 - How to Earn Points */}
          <div className="border border-slate-100 rounded-2xl bg-white overflow-hidden shadow-sm">
            <button
              onClick={() => setShowHowToEarn(!showHowToEarn)}
              className="w-full flex items-center justify-between p-4 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 transition text-left"
            >
              <span className="flex items-center gap-1.5">
                <Sparkles size={14} className="text-purple-600 animate-pulse" />
                How to earn points
              </span>
              {showHowToEarn ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {showHowToEarn && (
              <div className="p-4 border-t border-slate-100 divide-y divide-slate-50 bg-white">
                <div className="flex justify-between py-2.5 text-xs text-slate-600">
                  <span>Complete task on time</span>
                  <span className="font-bold text-purple-600">+10 pts</span>
                </div>
                <div className="flex justify-between py-2.5 text-xs text-slate-600">
                  <span>Attendance above 80%</span>
                  <span className="font-bold text-purple-600">+5 pts</span>
                </div>
                <div className="flex justify-between py-2.5 text-xs text-slate-600">
                  <span>Weekly wellness check-in</span>
                  <span className="font-bold text-purple-600">+2 pts</span>
                </div>
                <div className="flex justify-between py-2.5 text-xs text-slate-600">
                  <span>Upload PYQ paper</span>
                  <span className="font-bold text-purple-600">+3 pts</span>
                </div>
                <div className="flex justify-between py-2.5 text-xs text-slate-600">
                  <span>Upload campus document</span>
                  <span className="font-bold text-purple-600">+5 pts</span>
                </div>
                <div className="flex justify-between py-2.5 text-xs text-slate-600">
                  <span>Connect Gmail</span>
                  <span className="font-bold text-purple-600">+3 pts</span>
                </div>
                <div className="flex justify-between py-2.5 text-xs text-slate-600">
                  <span>Connect WhatsApp</span>
                  <span className="font-bold text-purple-600">+3 pts</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
