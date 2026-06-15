"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Loader2 } from "lucide-react";
import Card from "@/components/ui/Card";
import { createClient } from "@/lib/supabase";

export default function MorningBriefing() {
  const [briefing, setBriefing] = useState<string>("");
  const [generatedAt, setGeneratedAt] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const handleRefresh = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch('http://localhost:8000/api/briefing/generate', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setBriefing(data.briefing);
      setGeneratedAt(data.generated_at);
    } catch (e) {
      console.error("Failed to refresh morning briefing:", e);
    }
    setLoading(false);
  };

  useEffect(() => {
    let mounted = true;
    const loadBriefing = async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session || !mounted) return;
        const res = await fetch('http://localhost:8000/api/briefing/today', {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        });
        if (res.ok && mounted) {
          const data = await res.json();
          setBriefing(data.briefing);
          setGeneratedAt(data.generated_at);
        } else if (mounted) {
          setBriefing("Welcome back to your CampusFlow dashboard! Check your timetable, upcoming tasks, and goals today.");
          setGeneratedAt(new Date().toISOString());
        }
      } catch (e) {
        console.error(e);
        if (mounted) {
          setBriefing("Welcome back to your CampusFlow dashboard! Check your timetable, upcoming tasks, and goals today.");
          setGeneratedAt(new Date().toISOString());
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    loadBriefing();
    return () => { mounted = false; };
  }, []);  const formatTime = (isoString: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    return date.toLocaleTimeString('en-IN', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex justify-between items-center mb-4">
          <div className="h-5 w-36 bg-slate-100 rounded-lg animate-pulse" />
          <div className="h-5 w-5 bg-slate-100 rounded animate-pulse" />
        </div>
        <div className="space-y-2.5">
          <div className="h-3.5 w-full bg-slate-100 rounded animate-pulse" />
          <div className="h-3.5 w-[92%] bg-slate-100 rounded animate-pulse" />
          <div className="h-3.5 w-[75%] bg-slate-100 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-base">✨</span>
          <span className="text-sm font-semibold text-slate-900">
            Good morning!
          </span>
        </div>
        <button 
          onClick={handleRefresh}
          className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-50 transition-colors"
          title="Refresh briefing"
        >
          <RefreshCw size={14} />
        </button>
      </div>
      
      <p className="text-sm text-slate-700 leading-relaxed">
        {briefing}
      </p>
      
      {generatedAt && (
        <p className="text-xs text-slate-400 mt-3">
          Generated at: {formatTime(generatedAt)}
        </p>
      )}
    </div>
  );
}
