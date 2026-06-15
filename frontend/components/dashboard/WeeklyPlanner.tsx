"use client";

import { useState, useEffect } from "react";
import { CheckSquare, Square, RefreshCw, CheckCircle2, AlertCircle, Compass, Calendar, ChevronRight } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { api } from "@/lib/api";
import { createClient } from "@/lib/supabase";

interface DayPlan {
  day: string;
  tasks: string[];
}

export default function WeeklyPlanner() {
  const [weeklyPlanId, setWeeklyPlanId] = useState<string | null>(null);
  const [plan, setPlan] = useState<DayPlan[]>([]);
  const [approved, setApproved] = useState(false);
  const [weekStart, setWeekStart] = useState("");
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);

  // Checked tasks stored by day-index-taskIndex string key: e.g. "Monday-0"
  const [completedTasks, setCompletedTasks] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchPlan();
  }, []);

  useEffect(() => {
    // Load completed checklist items from localStorage if available
    if (weekStart) {
      const stored = localStorage.getItem(`cf-planner-completed-${weekStart}`);
      if (stored) {
        try {
          setCompletedTasks(JSON.parse(stored));
        } catch (e) {
          console.error(e);
        }
      } else {
        setCompletedTasks({});
      }
    }
  }, [weekStart]);

  const toggleTask = (day: string, taskIdx: number) => {
    const key = `${day}-${taskIdx}`;
    const next = { ...completedTasks, [key]: !completedTasks[key] };
    setCompletedTasks(next);
    if (weekStart) {
      localStorage.setItem(`cf-planner-completed-${weekStart}`, JSON.stringify(next));
    }
  };

  const fetchPlan = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const res = await api.get("/api/planner/weekly", { headers });
      if (res.data) {
        setWeeklyPlanId(res.data.id);
        setPlan(res.data.plan || []);
        setApproved(res.data.approved || false);
        setWeekStart(res.data.week_start || "");
      }
    } catch (err) {
      console.error("Failed to load weekly plan:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      await api.post("/api/planner/weekly/approve", { approved: true }, { headers });
      setApproved(true);
      alert("Weekly plan approved and locked!");
    } catch (err) {
      console.error("Failed to approve plan:", err);
      alert("Failed to approve plan");
    }
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const res = await api.post("/api/planner/weekly/regenerate", {}, { headers });
      if (res.data) {
        setWeeklyPlanId(res.data.id);
        setPlan(res.data.plan || []);
        setApproved(res.data.approved || false);
        setWeekStart(res.data.week_start || "");
        setCompletedTasks({}); // Reset checked states on regeneration
        if (res.data.week_start) {
          localStorage.removeItem(`cf-planner-completed-${res.data.week_start}`);
        }
      }
    } catch (err) {
      console.error("Failed to regenerate plan:", err);
      alert("Failed to regenerate weekly plan");
    } finally {
      setRegenerating(false);
    }
  };

  const formatDateRange = (mondayStr: string) => {
    if (!mondayStr) return "";
    const monday = new Date(mondayStr);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    
    const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
    return `${monday.toLocaleDateString("en-US", options)} - ${sunday.toLocaleDateString("en-US", options)}`;
  };

  const currentDayPlan = plan[selectedDayIndex];

  return (
    <Card className="flex flex-col h-full">
      <div className="flex items-start justify-between border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-1.5">
            <Compass className="text-primary" size={18} />
            Academic Study Planner
          </h2>
          <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
            <Calendar size={12} className="text-slate-400" />
            Week: {formatDateRange(weekStart)}
          </p>
        </div>

        {/* Status indicator */}
        {!loading && plan.length > 0 && (
          <div className="flex items-center gap-2">
            {approved ? (
              <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border border-green-200 bg-green-50 text-green-700 font-semibold">
                <CheckCircle2 size={10} />
                Approved Plan
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border border-amber-200 bg-amber-50 text-amber-700 font-semibold animate-pulse">
                <AlertCircle size={10} />
                Draft Plan
              </span>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center py-12 text-xs text-slate-400">
          Loading your personalized academic plan...
        </div>
      ) : plan.length > 0 ? (
        <div className="flex-1 flex flex-col md:flex-row gap-4 mt-4 min-h-[300px]">
          {/* Days sidebar list */}
          <div className="flex flex-row md:flex-col overflow-x-auto md:overflow-x-visible pb-2 md:pb-0 gap-1 md:w-36 border-b md:border-b-0 md:border-r border-slate-100 pr-0 md:pr-3 shrink-0">
            {plan.map((dayPlan, idx) => {
              const dayTasksCount = dayPlan.tasks.length;
              const completedCount = dayPlan.tasks.filter((_, taskIdx) => completedTasks[`${dayPlan.day}-${taskIdx}`]).length;
              const isSelected = selectedDayIndex === idx;

              return (
                <button
                  key={dayPlan.day}
                  onClick={() => setSelectedDayIndex(idx)}
                  className={`flex items-center justify-between gap-2 px-3 py-2 text-left text-xs font-semibold rounded-xl transition-all duration-150 whitespace-nowrap md:whitespace-normal w-full border border-transparent ${
                    isSelected
                      ? "bg-primary text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <span>{dayPlan.day}</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                    isSelected ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                  }`}>
                    {completedCount}/{dayTasksCount}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Selected day plan list */}
          <div className="flex-1 flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-slate-800 text-xs flex items-center gap-1.5 mb-3 border-b border-slate-50 pb-2">
                {currentDayPlan?.day}'s Focus Areas
                <ChevronRight size={12} className="text-slate-400" />
              </h3>

              <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                {currentDayPlan?.tasks.map((task, taskIdx) => {
                  const isCompleted = completedTasks[`${currentDayPlan.day}-${taskIdx}`] || false;
                  return (
                    <div
                      key={taskIdx}
                      onClick={() => toggleTask(currentDayPlan.day, taskIdx)}
                      className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer select-none transition ${
                        isCompleted
                          ? "bg-slate-50 border-slate-200 text-slate-400 line-through"
                          : "bg-white border-slate-100 hover:border-slate-200 text-slate-700 shadow-sm"
                      }`}
                    >
                      <button className="mt-0.5 shrink-0 transition text-slate-400 hover:text-primary">
                        {isCompleted ? (
                          <CheckSquare size={16} className="text-primary" />
                        ) : (
                          <Square size={16} />
                        )}
                      </button>
                      <span className="text-xs font-medium leading-relaxed">{task}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom control panel */}
            <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4 mt-4">
              <Button
                variant="ghost"
                onClick={handleRegenerate}
                disabled={regenerating}
                className="text-slate-500 hover:text-slate-700 text-xs px-3 py-2 gap-1 rounded-xl"
              >
                <RefreshCw size={12} className={regenerating ? "animate-spin" : ""} />
                {regenerating ? "Regenerating..." : "Regenerate study plan"}
              </Button>

              {!approved && (
                <Button
                  onClick={handleApprove}
                  className="px-4 py-2 text-xs rounded-xl shadow-sm hover:shadow"
                >
                  Lock & Approve Plan
                </Button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-12">
          <AlertCircle className="mx-auto text-slate-300 mb-2" size={24} />
          <p className="text-xs font-medium text-slate-500">No study plan available</p>
          <Button onClick={handleRegenerate} disabled={regenerating} className="mt-3 text-xs rounded-xl">
            {regenerating ? "Generating..." : "Generate Weekly Study Plan"}
          </Button>
        </div>
      )}
    </Card>
  );
}
