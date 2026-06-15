"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, LogOut, Edit, X } from "lucide-react";
import Header from "@/components/dashboard/Header";
import TodaysOverview from "@/components/dashboard/TodaysOverview";

const PRESET_SKILLS = [
  "DSA", "Python", "Java", "C++", "ML/AI", "Web Dev", "SQL",
  "System Design", "Communication", "Leadership", "React",
  "Node.js", "Data Science", "DevOps", "Android"
];
import TodaysClasses from "@/components/dashboard/TodaysClasses";
import AttendanceRisk, { AttendanceRecord } from "@/components/dashboard/AttendanceRisk";
import TasksDeadlines from "@/components/dashboard/TasksDeadlines";
import DataSources from "@/components/dashboard/DataSources";
import CampusChat, { CampusChatHandle } from "@/components/dashboard/CampusChat";
import SetupChecklist from "@/components/dashboard/SetupChecklist";
import TimetableUpload from "@/components/dashboard/TimetableUpload";
import CampusDocUpload from "@/components/dashboard/CampusDocUpload";
import WeeklyPlanner from "@/components/dashboard/WeeklyPlanner";
import WellnessTracker from "@/components/dashboard/WellnessTracker";
import ClubEvents from "@/components/dashboard/ClubEvents";
import PlacementCopilot from "@/components/dashboard/PlacementCopilot";
import MonthlyWrapped from "@/components/dashboard/MonthlyWrapped";
import MorningBriefing from "@/components/dashboard/MorningBriefing";
import Leaderboard from "@/components/dashboard/Leaderboard";
import { api } from "@/lib/api";
import { createClient } from "@/lib/supabase";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

interface Profile {
  student_id: string;
  full_name: string;
  college: string;
  branch: string;
  year: number;
  section: string;
  hostel: string;
  timetable_uploaded: boolean;
  gmail_connected: boolean;
  profile_complete: boolean;
  whatsapp_number?: string | null;
  bus_route?: string | null;
}

interface Task {
  id: string;
  task: string;
  subject: string | null;
  deadline: string | null;
  priority: string;
  type: string;
  status: string;
}

interface Slot {
  id: string;
  day: string;
  time_start: string;
  time_end: string;
  subject: string;
  room: string;
  faculty: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const chatRef = useRef<CampusChatHandle>(null);

  const [activeTab, setActiveTab] = useState<"overview" | "placement" | "academic" | "wellness" | "wrapped" | "leaderboard">("overview");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [kbDocCount, setKbDocCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showDocUpload, setShowDocUpload] = useState(false);
  const [gmailNotice, setGmailNotice] = useState<string | null>(null);

  // Phase 2 states
  const [ahsData, setAhsData] = useState<any>({
    ahs_score: 50,
    attendance_score: 50,
    deadline_score: 50,
    placement_score: 0,
    cognitive_load: 20,
    breakdown: "Calculating..."
  });
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [summary, setSummary] = useState<any>({
    today_classes: [],
    upcoming_deadlines: [],
    attendance_risks: [],
    tasks_count: 0
  });
  const [nextBusText, setNextBusText] = useState<string | null>(null);
  const [quickAddText, setQuickAddText] = useState("");
  const [addingTask, setAddingTask] = useState(false);

  // Profile Edit modal states
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState({
    full_name: "",
    branch: "CSE",
    year: 1,
    section: "",
    hostel: "Day Scholar",
    goal: "Placement",
    target_companies: [] as string[],
    linkedin_url: "",
    whatsapp_number: "",
    skills: [] as string[],
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [companyInput, setCompanyInput] = useState("");
  const [customSkillInput, setCustomSkillInput] = useState("");

  const fetchDashboardData = async (session: any) => {
    const token = session.access_token;
    const supabase = createClient();

    const [profileRes, summaryRes, attendanceRes, docsRes, tasksRes, transportRes] = await Promise.allSettled([
      supabase.from("profiles").select("*").eq("student_id", session.user.id).maybeSingle(),
      fetch('http://localhost:8000/api/dashboard/summary', {
        headers: { 'Authorization': `Bearer ${token}` }
      }),
      fetch('http://localhost:8000/api/attendance/my', {
        headers: { 'Authorization': `Bearer ${token}` }
      }),
      supabase.from("campus_docs").select("id", { count: "exact", head: true }).eq("student_id", session.user.id),
      supabase.from("tasks").select("*").eq("student_id", session.user.id).order("deadline", { ascending: true, nullsFirst: false }),
      fetch('http://localhost:8000/api/transport/schedules', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
    ]);

    return { profileRes, summaryRes, attendanceRes, docsRes, tasksRes, transportRes };
  };

  const loadData = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }
      
      const { profileRes, summaryRes, attendanceRes, docsRes, tasksRes, transportRes } = await fetchDashboardData(session);
      
      // Process profile
      let profileData: Profile | null = null;
      if (profileRes.status === 'fulfilled' && profileRes.value.data) {
        profileData = profileRes.value.data as Profile;
        setProfile(profileData);
      }

      // Process summary
      if (summaryRes.status === 'fulfilled' && summaryRes.value.ok) {
        const data = await summaryRes.value.json();
        setSummary(data);
        setAhsData(data.ahs);
        setSlots(data.today_classes || []);
      }
      
      // Process attendance
      if (attendanceRes.status === 'fulfilled' && attendanceRes.value.ok) {
        const data = await attendanceRes.value.json();
        const subjects = Array.isArray(data) ? data : (data.subjects || []);
        setAttendanceRecords(subjects);
      }
      
      // Process docs count
      if (docsRes.status === 'fulfilled') {
        setKbDocCount(docsRes.value.count || 0);
      }

      // Process tasks
      if (tasksRes.status === 'fulfilled' && tasksRes.value.data) {
        setTasks(tasksRes.value.data as Task[]);
      }

      // Process schedules
      if (transportRes.status === 'fulfilled' && transportRes.value.ok) {
        const data = await transportRes.value.json();
        const schedules = data.schedules || [];
        
        let busText = null;
        const busRoute = profileData?.bus_route;
        const selectedSchedule = schedules.find((s: any) => s.route === busRoute);
        if (busRoute && selectedSchedule) {
          const times = selectedSchedule.departure_times || [];
          const now = new Date();
          const currentHours = now.getHours();
          const currentMinutes = now.getMinutes();
          
          const upcomingTimes = times.filter((t: string) => {
            const [hStr, mStr] = t.split(":");
            const h = parseInt(hStr);
            const m = parseInt(mStr);
            return (h > currentHours) || (h === currentHours && m > currentMinutes);
          });
          
          if (upcomingTimes.length > 0) {
            upcomingTimes.sort((a: string, b: string) => {
              const [ah, am] = a.split(":").map(Number);
              const [bh, bm] = b.split(":").map(Number);
              return (ah * 60 + am) - (bh * 60 + bm);
            });
            busText = `Bus Route ${busRoute}: Next departure at ${upcomingTimes[0]}`;
          } else {
            busText = "No more buses today";
          }
        }
        setNextBusText(busText);
      }
      
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
    }
  }, [router]);

  useEffect(() => {
    let mounted = true;
    
    const initDashboard = async () => {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          router.push('/login');
          return;
        }
        
        const { profileRes, summaryRes, attendanceRes, docsRes, tasksRes, transportRes } = await fetchDashboardData(session);
        
        if (!mounted) return;
        
        // Process profile
        let profileData: Profile | null = null;
        if (profileRes.status === 'fulfilled' && profileRes.value.data) {
          profileData = profileRes.value.data as Profile;
          setProfile(profileData);
        }

        // Process summary
        if (summaryRes.status === 'fulfilled' && summaryRes.value.ok) {
          const data = await summaryRes.value.json();
          setSummary(data);
          setAhsData(data.ahs);
          setSlots(data.today_classes || []);
        }
        
        // Process attendance
        if (attendanceRes.status === 'fulfilled' && attendanceRes.value.ok) {
          const data = await attendanceRes.value.json();
          const subjects = Array.isArray(data) ? data : (data.subjects || []);
          setAttendanceRecords(subjects);
        }
        
        // Process docs count
        if (docsRes.status === 'fulfilled') {
          setKbDocCount(docsRes.value.count || 0);
        }

        // Process tasks
        if (tasksRes.status === 'fulfilled' && tasksRes.value.data) {
          setTasks(tasksRes.value.data as Task[]);
        }

        // Process schedules
        if (transportRes.status === 'fulfilled' && transportRes.value.ok) {
          const data = await transportRes.value.json();
          const schedules = data.schedules || [];
          
          let busText = null;
          const busRoute = profileData?.bus_route;
          const selectedSchedule = schedules.find((s: any) => s.route === busRoute);
          if (busRoute && selectedSchedule) {
            const times = selectedSchedule.departure_times || [];
            const now = new Date();
            const currentHours = now.getHours();
            const currentMinutes = now.getMinutes();
            
            const upcomingTimes = times.filter((t: string) => {
              const [hStr, mStr] = t.split(":");
              const h = parseInt(hStr);
              const m = parseInt(mStr);
              return (h > currentHours) || (h === currentHours && m > currentMinutes);
            });
            
            if (upcomingTimes.length > 0) {
              upcomingTimes.sort((a: string, b: string) => {
                const [ah, am] = a.split(":").map(Number);
                const [bh, bm] = b.split(":").map(Number);
                return (ah * 60 + am) - (bh * 60 + bm);
              });
              busText = `Bus Route ${busRoute}: Next departure at ${upcomingTimes[0]}`;
            } else {
              busText = "No more buses today";
            }
          }
          setNextBusText(busText);
        }
        
      } catch (err) {
        console.error('Dashboard init error:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    
    initDashboard();
    
    const params = new URLSearchParams(window.location.search);
    const gmail = params.get("gmail");
    if (gmail === "connected") {
      const count = params.get("tasks") || "0";
      setGmailNotice(`Gmail connected — ${count} task(s) found`);
    } else if (gmail === "error") {
      setGmailNotice("Failed to connect Gmail. Please try again.");
    }

    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 8000);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (showEditModal) {
      const fetchProfileForEdit = async () => {
        try {
          const supabase = createClient();
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) return;
          const { data: prof, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('student_id', session.user.id)
            .single();
          if (prof) {
            setEditFormData({
              full_name: prof.full_name || "",
              branch: prof.branch || "CSE",
              year: prof.year || 1,
              section: prof.section || "",
              hostel: prof.hostel || "Day Scholar",
              goal: prof.goal || "Placement",
              target_companies: prof.target_companies || [],
              linkedin_url: prof.linkedin_url || "",
              whatsapp_number: prof.whatsapp_number || "",
              skills: prof.skills || [],
            });
          }
        } catch (err) {
          console.error("Error fetching profile for edit:", err);
        }
      };
      fetchProfileForEdit();
    }
  }, [showEditModal]);


  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAddText.trim() || addingTask) return;

    setAddingTask(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await api.post("/api/whatsapp/quick-add", {
        text: quickAddText.trim()
      }, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });
      alert(`Created ${res.data.tasks_created} task(s) from your text!`);
      setQuickAddText("");
      loadData();
    } catch {
      alert("Failed to quick add task");
    } finally {
      setAddingTask(false);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">Loading your dashboard...</p>
      </main>
    );
  }

  const showChecklist =
    !profile?.timetable_uploaded || !profile?.gmail_connected || kbDocCount === 0;

  const studentContext = {
    college: profile?.college || "",
    branch: profile?.branch || "",
    year: profile?.year || 1,
    section: profile?.section || "",
    hostel: profile?.hostel || "",
  };

  return (
    <main className="min-h-screen bg-[#F8FAFC]">
      <header className="sticky top-0 z-40 w-full bg-white border-b border-slate-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          
          {/* Logo left */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#6C47FF] rounded-lg flex items-center justify-center">
              <span className="text-white text-sm font-bold">CF</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">CampusFlow</p>
              <p className="text-xs text-slate-400">{profile?.college}</p>
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {/* Student name + edit */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-[#EEF0FF] rounded-full flex items-center justify-center">
                <span className="text-[#6C47FF] text-xs font-semibold">
                  {profile?.full_name ? profile.full_name.split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase() : "ST"}
                </span>
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-medium text-slate-900">{profile?.full_name || "Student"}</p>
                <p className="text-xs text-slate-400">{profile?.branch || "CSE"} • Year {profile?.year || 1}</p>
              </div>
              {/* Edit profile button */}
              <button onClick={() => setShowEditModal(true)}
                className="p-1.5 text-slate-400 hover:text-[#6C47FF] hover:bg-[#EEF0FF] rounded-lg transition-colors">
                <Edit size={14} />
              </button>
            </div>

            {/* Divider */}
            <div className="w-px h-6 bg-slate-200"></div>

            {/* Sign out */}
            <button onClick={async () => {
                const supabase = createClient();
                await supabase.auth.signOut();
                router.push("/login");
              }}
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-50">
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Tab Navigation Redesign */}
      <div className="bg-white border-b border-slate-100 sticky top-16 z-30">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-1 py-2 overflow-x-auto scrollbar-hide">
            {(["overview", "placement", "academic", "wellness", "wrapped", "leaderboard"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all capitalize ${
                  activeTab === tab
                    ? 'bg-[#6C47FF] text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-6 px-6 py-6 font-sans">
        {gmailNotice && (
          <div className="rounded-xl border border-green-100 bg-green-50 px-4 py-3 text-sm text-green-700">
            {gmailNotice}
          </div>
        )}

        <MorningBriefing />

        {/* TAB CONTENTS */}
        
        {/* Tab 1 - Overview */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {showChecklist && (
              <SetupChecklist
                profileComplete={true}
                timetableUploaded={profile?.timetable_uploaded || false}
                gmailConnected={profile?.gmail_connected || false}
                kbDocCount={kbDocCount}
              />
            )}

            {/* Quick Add box */}
            <form onSubmit={handleQuickAdd} className="flex gap-2 bg-white p-2 rounded-xl border border-slate-200 shadow-sm transition-all focus-within:ring-2 focus-within:ring-[#6C47FF]/20 focus-within:border-[#6C47FF]">
              <input
                type="text"
                value={quickAddText}
                onChange={(e) => setQuickAddText(e.target.value)}
                placeholder="Paste any WhatsApp message, assignment notification, or exam date here..."
                className="flex-1 bg-transparent px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-0"
                disabled={addingTask}
              />
              <Button type="submit" disabled={addingTask || !quickAddText.trim()} className="rounded-lg py-2">
                {addingTask ? "Adding..." : "Quick Add Task"}
              </Button>
            </form>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
              {/* Left Column (60% width) */}
              <div className="lg:col-span-3 space-y-6">
                {!profile?.timetable_uploaded ? (
                  <TimetableUpload onConfirmed={loadData} />
                ) : (
                  <TodaysClasses slots={slots} />
                )}
                <AttendanceRisk 
                  records={attendanceRecords} 
                  onRefresh={loadData} 
                  onUploadSuccess={(data) => {
                    setAttendanceRecords(data);
                    loadData();
                  }} 
                />
              </div>

              {/* Right Column (40% width) */}
              <div className="lg:col-span-2 space-y-6">
                <TodaysOverview
                  classesCount={slots.length}
                  deadlinesCount={summary.upcoming_deadlines?.length || 0}
                  ahsScore={ahsData.ahs_score}
                  pendingTasksCount={tasks.filter(t => t.status === "pending").length}
                  onAsk={(question) => chatRef.current?.ask(question)}
                  nextBusDeparture={nextBusText}
                />

                {/* Detailed AHS Score card with tooltip */}
                <Card className="p-4 border border-slate-100 bg-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Academic Health Score</p>
                      <p className="text-xs text-slate-500 mt-1">{ahsData.breakdown || "Calculating..."}</p>
                    </div>
                    <div className="relative group cursor-help">
                      <span className={`text-3xl font-extrabold px-3 py-1 rounded-lg ${
                        ahsData.ahs_score >= 80 ? "text-green-600 bg-green-50" : (ahsData.ahs_score >= 65 ? "text-amber-600 bg-amber-50" : "text-red-600 bg-red-50")
                      }`}>
                        {ahsData.ahs_score}
                      </span>
                      
                      {/* Tooltip on hover */}
                      <div className="absolute right-0 bottom-full mb-2 hidden group-hover:block bg-slate-800 text-white text-xs rounded-xl p-4 shadow-xl z-50 w-60 pointer-events-none transition-all duration-200">
                        <p className="font-bold border-b border-slate-700 pb-1.5 mb-2 text-slate-200">AHS Components</p>
                        <div className="space-y-1.5">
                          <div className="flex justify-between">
                            <span className="text-slate-400">Attendance (30%):</span>
                            <strong className="font-semibold">{ahsData.attendance_score}%</strong>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Deadlines (25%):</span>
                            <strong className="font-semibold">{ahsData.deadline_score}%</strong>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Placement (25%):</span>
                            <strong className="font-semibold">{ahsData.placement_score}%</strong>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Cognitive Load (20%):</span>
                            <strong className="font-semibold">{100 - ahsData.cognitive_load}%</strong>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>

                <TasksDeadlines tasks={tasks} setTasks={setTasks} />
                <DataSources
                  gmailConnected={profile?.gmail_connected || false}
                  kbDocCount={kbDocCount}
                  onUploadDoc={() => setShowDocUpload(true)}
                  whatsappNumber={profile?.whatsapp_number}
                  onWhatsappSaved={(num) => {
                    setProfile(prev => prev ? { ...prev, whatsapp_number: num } : null);
                    loadData();
                  }}
                  onTasksUpdated={loadData}
                  selectedRoute={profile?.bus_route}
                  onRouteSelected={(route) => {
                    setProfile(prev => prev ? { ...prev, bus_route: route } : null);
                    loadData();
                  }}
                />
              </div>
            </div>

            {/* Campus Q&A chat (always full width at bottom) */}
            <CampusChat ref={chatRef} studentContext={studentContext} />
          </div>
        )}

        {/* Tab 2 - Placement */}
        {activeTab === "placement" && (
          <div className="space-y-6">
            <PlacementCopilot />
          </div>
        )}

        {/* Tab 3 - Academic */}
        {activeTab === "academic" && (
          <div className="space-y-6">
            <WeeklyPlanner />
            <ClubEvents />
          </div>
        )}

        {/* Tab 4 - Wellness */}
        {activeTab === "wellness" && (
          <div className="space-y-6">
            <WellnessTracker onUpdate={loadData} />
          </div>
        )}

        {/* Tab 5 - Wrapped */}
        {activeTab === "wrapped" && (
          <div className="space-y-6">
            <MonthlyWrapped />
          </div>
        )}

        {/* Tab 6 - Leaderboard */}
        {activeTab === "leaderboard" && (
          <div className="space-y-6">
            <Leaderboard />
          </div>
        )}
      </div>

      {showDocUpload && (
        <CampusDocUpload
          onClose={() => setShowDocUpload(false)}
          onUploaded={loadData}
        />
      )}

      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="relative flex flex-col w-full max-w-lg max-h-[90vh] bg-white rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h3 className="text-lg font-bold text-slate-900">Edit Your Profile</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-50 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content Form */}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  const supabase = createClient();
                  const { data: { session } } = await supabase.auth.getSession();
                  if (!session) {
                    router.push('/login');
                    return;
                  }
                  
                  const { error } = await supabase
                    .from('profiles')
                    .update({
                      full_name: editFormData.full_name,
                      branch: editFormData.branch,
                      year: Number(editFormData.year),
                      section: editFormData.section,
                      hostel: editFormData.hostel,
                      goal: editFormData.goal,
                      target_companies: editFormData.target_companies,
                      linkedin_url: editFormData.linkedin_url,
                      whatsapp_number: editFormData.whatsapp_number,
                      skills: editFormData.skills,
                    })
                    .eq('student_id', session.user.id);
                  
                  if (error) throw error;
                  
                  setProfile(prev => prev ? {
                    ...prev,
                    full_name: editFormData.full_name,
                    branch: editFormData.branch,
                    year: Number(editFormData.year),
                    section: editFormData.section,
                    hostel: editFormData.hostel,
                    goal: editFormData.goal,
                    target_companies: editFormData.target_companies,
                    linkedin_url: editFormData.linkedin_url,
                    whatsapp_number: editFormData.whatsapp_number,
                    skills: editFormData.skills,
                  } : null);

                  setToastMessage("Profile updated successfully!");
                  setTimeout(() => setToastMessage(null), 3000);
                  setShowEditModal(false);
                  loadData();
                } catch (err) {
                  console.error("Failed to update profile:", err);
                  alert("Failed to update profile");
                }
              }}
              className="flex-1 overflow-y-auto px-6 py-4 space-y-4"
            >
              {/* Full Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={editFormData.full_name}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, full_name: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              {/* Grid for Branch & Year */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Branch
                  </label>
                  <select
                    value={editFormData.branch}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, branch: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm bg-white focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  >
                    {["CSE", "ECE", "EEE", "ME", "CE", "IT", "Other"].map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Year
                  </label>
                  <select
                    value={editFormData.year}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, year: Number(e.target.value) }))}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm bg-white focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  >
                    {[1, 2, 3, 4].map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Grid for Section & Hostel */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Section
                  </label>
                  <input
                    type="text"
                    value={editFormData.section}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, section: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Hostel
                  </label>
                  <select
                    value={editFormData.hostel}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, hostel: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm bg-white focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  >
                    {["Boys Hostel", "Girls Hostel", "Day Scholar"].map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Goal */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Goal
                </label>
                <select
                  value={editFormData.goal}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, goal: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm bg-white focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                >
                  {["Placement", "GATE", "Higher Studies", "Entrepreneurship", "Other"].map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>

              {/* Target Companies */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Target Companies
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={companyInput}
                    onChange={(e) => setCompanyInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const value = companyInput.trim();
                        if (value && !editFormData.target_companies.includes(value)) {
                          setEditFormData(prev => ({
                            ...prev,
                            target_companies: [...prev.target_companies, value]
                          }));
                        }
                        setCompanyInput("");
                      }
                    }}
                    placeholder="Add target company (e.g. Google, Amazon)..."
                    className="flex-1 rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const value = companyInput.trim();
                      if (value && !editFormData.target_companies.includes(value)) {
                        setEditFormData(prev => ({
                          ...prev,
                          target_companies: [...prev.target_companies, value]
                        }));
                      }
                      setCompanyInput("");
                    }}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold"
                  >
                    Add
                  </button>
                </div>
                {editFormData.target_companies.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {editFormData.target_companies.map(company => (
                      <span
                        key={company}
                        className="inline-flex items-center gap-1 rounded-full bg-purple-50 border border-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-700"
                      >
                        {company}
                        <button
                          type="button"
                          onClick={() => setEditFormData(prev => ({
                            ...prev,
                            target_companies: prev.target_companies.filter(c => c !== company)
                          }))}
                          className="text-purple-400 hover:text-purple-600 font-bold"
                        >
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* LinkedIn URL */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  LinkedIn URL
                </label>
                <input
                  type="url"
                  placeholder="https://linkedin.com/in/your-username"
                  value={editFormData.linkedin_url}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, linkedin_url: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              {/* WhatsApp Number */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  WhatsApp Number
                </label>
                <input
                  type="text"
                  placeholder="+91XXXXXXXXXX"
                  value={editFormData.whatsapp_number}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, whatsapp_number: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              {/* Skills */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Current Skills
                </label>
                
                {/* Preset skills */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {PRESET_SKILLS.map(skill => {
                    const isSelected = editFormData.skills.includes(skill);
                    return (
                      <button
                        key={skill}
                        type="button"
                        onClick={() => {
                          const newSkills = isSelected
                            ? editFormData.skills.filter(s => s !== skill)
                            : [...editFormData.skills, skill];
                          setEditFormData(prev => ({ ...prev, skills: newSkills }));
                        }}
                        className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                          isSelected
                            ? 'bg-purple-600 text-white border-purple-600'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-purple-400'
                        }`}
                      >
                        {isSelected ? '✓ ' : ''}{skill}
                      </button>
                    );
                  })}
                </div>

                {/* Custom skill input */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customSkillInput}
                    onChange={(e) => setCustomSkillInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const value = customSkillInput.trim();
                        if (value && !editFormData.skills.includes(value)) {
                          setEditFormData(prev => ({ ...prev, skills: [...prev.skills, value] }));
                        }
                        setCustomSkillInput("");
                      }
                    }}
                    placeholder="Add custom skill..."
                    className="flex-1 rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const value = customSkillInput.trim();
                      if (value && !editFormData.skills.includes(value)) {
                        setEditFormData(prev => ({ ...prev, skills: [...prev.skills, value] }));
                      }
                      setCustomSkillInput("");
                    }}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold"
                  >
                    Add
                  </button>
                </div>

                {/* Custom skills chips list */}
                {editFormData.skills.filter(s => !PRESET_SKILLS.includes(s)).length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {editFormData.skills.filter(s => !PRESET_SKILLS.includes(s)).map(skill => (
                      <span
                        key={skill}
                        className="inline-flex items-center gap-1 rounded-full bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-700"
                      >
                        {skill}
                        <button
                          type="button"
                          onClick={() => setEditFormData(prev => ({
                            ...prev,
                            skills: prev.skills.filter(s => s !== skill)
                          }))}
                          className="text-indigo-400 hover:text-indigo-600 font-bold"
                        >
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Form Actions Footer */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-sm font-semibold bg-purple-600 hover:bg-purple-700 text-white shadow-sm transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toastMessage && (
        <div className="fixed top-4 right-4 z-[60] flex items-center gap-2 bg-green-600 text-white px-4 py-3 rounded-xl shadow-lg animate-in slide-in-from-top-5 duration-200">
          <span className="text-sm font-semibold">{toastMessage}</span>
        </div>
      )}
    </main>
  );
}
