"use client";

import { useState, useRef, useEffect } from "react";
import { CheckCircle2, Trash2 } from "lucide-react";
import Card from "@/components/ui/Card";
import { api } from "@/lib/api";
import { createClient } from "@/lib/supabase";
import { showPointsToast } from "@/lib/toast";

interface Task {
  id: string;
  task: string;
  subject: string | null;
  deadline: string | null;
  priority: string;
  type: string;
  status: string;
}

const PRIORITY_STYLES: Record<string, string> = {
  high: "bg-red-100 text-red-600",
  medium: "bg-amber-100 text-amber-600",
  low: "bg-slate-100 text-slate-500",
};

export default function TasksDeadlines({
  tasks,
  setTasks,
}: {
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
}) {
  const [filter, setFilter] = useState<"all" | "pending" | "done">("all");
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const confirmTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handle ticking task as done/pending
  const toggleStatus = async (task: Task) => {
    const nextStatus = task.status === "done" ? "pending" : "done";
    
    // Save previous state for rollback
    const originalStatus = task.status;
    
    // Optimistic UI update
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: nextStatus } : t));
    
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      await api.patch(`/api/tasks/${task.id}/status`, { status: nextStatus }, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });

      if (nextStatus === "done") {
        try {
          let action = "task_completed_on_time";
          let points = 10;
          if (task.deadline) {
            const deadlineDate = new Date(task.deadline);
            const now = new Date();
            if (deadlineDate.getTime() < now.getTime()) {
              action = "task_completed_late";
              points = 3;
            }
          }
          await api.post("/api/leaderboard/award-points", {
            action,
            description: task.task
          }, {
            headers: {
              Authorization: `Bearer ${token}`
            }
          });
          showPointsToast(points);
        } catch (pointErr) {
          console.error("Point award failed:", pointErr);
        }
      }
    } catch (err) {
      console.error("Failed to update status:", err);
      // Revert optimistic update
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: originalStatus } : t));
      alert("Failed to update task status.");
    }
  };

  // Handle delete action
  const handleDeleteClick = (taskId: string) => {
    if (confirmingDelete === taskId) {
      executeDelete(taskId);
      setConfirmingDelete(null);
      if (confirmTimeoutRef.current) {
        clearTimeout(confirmTimeoutRef.current);
      }
    } else {
      setConfirmingDelete(taskId);
      if (confirmTimeoutRef.current) {
        clearTimeout(confirmTimeoutRef.current);
      }
      confirmTimeoutRef.current = setTimeout(() => {
        setConfirmingDelete(null);
      }, 2000);
    }
  };

  const executeDelete = async (taskId: string) => {
    let previousTasks: Task[] = [];
    setTasks(prev => {
      previousTasks = prev;
      return prev.filter(t => t.id !== taskId);
    });

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      await api.delete(`/api/tasks/${taskId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
    } catch (err) {
      console.error("Failed to delete task:", err);
      setTasks(previousTasks);
      alert("Failed to delete task.");
    }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (confirmTimeoutRef.current) {
        clearTimeout(confirmTimeoutRef.current);
      }
    };
  }, []);

  // Filter tasks based on selected tab
  const filteredTasks = (tasks || []).filter(task => {
    if (filter === "all") return true;
    return task.status === filter;
  });

  return (
    <Card>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Tasks & Deadlines</h2>
        
        {/* Task filtering tabs (FEATURE 3) */}
        <div className="flex bg-slate-100 p-0.5 rounded-lg w-fit">
          {(["all", "pending", "done"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              type="button"
              className={`px-3 py-1 text-xs font-semibold rounded-md transition capitalize ${
                filter === tab
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {filteredTasks.length === 0 ? (
        <p className="mt-6 text-sm text-slate-400 text-center py-4 bg-slate-50/50 rounded-xl border border-dashed border-slate-200 px-4">
          No tasks here. Upload WhatsApp messages or connect Gmail to find deadlines.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {filteredTasks.map((task) => (
            <li
              key={task.id}
              className={`group rounded-xl border border-slate-100 border-l-4 ${
                task.priority === "high"
                  ? "border-l-red-500"
                  : task.priority === "medium"
                  ? "border-l-amber-500"
                  : "border-l-slate-300"
              } px-4 py-3 flex items-center justify-between gap-4 transition-all duration-200 bg-white hover:shadow-sm ${
                task.status === "done" ? "opacity-50 bg-slate-50/50" : ""
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2">
                  <p className={`text-sm font-medium text-slate-900 truncate ${
                    task.status === "done" ? "line-through text-slate-400" : ""
                  }`}>
                    {task.task}
                  </p>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${
                      PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.medium
                    }`}
                  >
                    {task.priority}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-400">
                  <span>{task.subject || task.type}</span>
                  {task.deadline && (
                    <>
                      <span>•</span>
                      <span>{new Date(task.deadline).toLocaleDateString("en-IN")}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Action Buttons (FEATURE 2) */}
              <div className="flex items-center gap-2 shrink-0 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                {/* Tick/Done button */}
                <button
                  onClick={() => toggleStatus(task)}
                  type="button"
                  className="p-1 rounded-full hover:bg-slate-100 transition-colors"
                  title={task.status === "done" ? "Mark as pending" : "Mark as done"}
                >
                  <CheckCircle2
                    size={20}
                    className={`transition-all ${
                      task.status === "done"
                        ? "text-green-500 fill-green-500"
                        : "text-slate-300 hover:text-green-500"
                    }`}
                  />
                </button>

                {/* Delete button */}
                <button
                  onClick={() => handleDeleteClick(task.id)}
                  type="button"
                  className={`text-xs px-2.5 py-1.5 h-8 min-w-[32px] rounded-lg transition-all flex items-center justify-center font-medium ${
                    confirmingDelete === task.id
                      ? "bg-red-600 hover:bg-red-700 text-white font-bold text-[10px] px-2"
                      : "text-slate-400 hover:text-red-500 hover:bg-red-50"
                  }`}
                  title="Delete task"
                >
                  {confirmingDelete === task.id ? (
                    "Sure?"
                  ) : (
                    <Trash2 size={16} />
                  )}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
