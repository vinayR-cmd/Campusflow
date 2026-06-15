"use client";

import { useState, useEffect, useRef } from "react";
import { Award, BookOpen, Check, FileText, Loader2, Sparkles, TrendingUp, AlertTriangle, CheckCircle, ChevronDown, ChevronUp, User, X, Edit2, Plus } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { api } from "@/lib/api";
import { createClient } from "@/lib/supabase";

interface WeekPlan {
  week: number;
  focus: string;
  tasks: string[];
  resources: string[];
  custom?: boolean;
}

interface PlacementPlan {
  readiness_score: number;
  skill_gaps: string[];
  weekly_plan: WeekPlan[];
  tips: string[];
  created_at?: string;
}

interface PYQAnalysis {
  subject: string;
  topics: { topic: string; percentage: number }[];
  most_important: string[];
  likely_this_year: string[];
  priority_order: string[];
  insight: string;
}

const PRESET_SKILLS = [
  'DSA', 'Python', 'Java', 'C++', 'ML/AI', 
  'Web Dev', 'SQL', 'System Design', 
  'Communication', 'Leadership', 'React',
  'Node.js', 'Data Science', 'DevOps', 'Android'
];

export default function PlacementCopilot() {
  const [plan, setPlan] = useState<PlacementPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [currentSkills, setCurrentSkills] = useState<string[]>([]);

  const selectedSkills = currentSkills.filter(s => PRESET_SKILLS.includes(s));
  const customSkills = currentSkills.filter(s => !PRESET_SKILLS.includes(s));
  
  // Profile State
  const [profile, setProfile] = useState<{ goal?: string, target_companies?: string[], branch?: string, year?: number }>({});
  const [targetCompanies, setTargetCompanies] = useState<string[]>([]);
  const [newSkill, setNewSkill] = useState("");
  const [newCompany, setNewCompany] = useState("");
  const [addingCompany, setAddingCompany] = useState(false);
  const [editingGoal, setEditingGoal] = useState(false);

  // PYQ Analyzer states
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [pyqResult, setPyqResult] = useState<PYQAnalysis | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Accordion state (open weeks)
  const [openWeeks, setOpenWeeks] = useState<Record<number, boolean>>({ 1: true });

  // Feature 2: Refresh state
  const [refreshCount, setRefreshCount] = useState(0);

  // Feature 3: Custom module states
  const [customModuleName, setCustomModuleName] = useState("");
  const [customTaskName, setCustomTaskName] = useState("");
  const [customTasks, setCustomTasks] = useState<string[]>([]);
  const [addingCustom, setAddingCustom] = useState(false);

  useEffect(() => {
    fetchPlan();
  }, []);

  const fetchPlan = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      // Fetch profile data
      if (session?.user?.id) {
        const profileRes = await api.get("/api/placement/profile", { headers });
        if (profileRes.data) {
          setProfile(profileRes.data);
          setCurrentSkills(profileRes.data.skills || []);
          setTargetCompanies(profileRes.data.target_companies || []);
        }
      }

      const res = await api.get("/api/placement/my-plan", { headers });
      if (res.data && res.data.readiness_score !== undefined) {
        setPlan(res.data);
      } else {
        setPlan(null);
      }
    } catch (err) {
      console.error("Failed to fetch placement plan:", err);
      setPlan(null);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const res = await api.post("/api/placement/generate-plan", {}, { headers });
      if (res.data) {
        setPlan(res.data);
        setOpenWeeks({ 1: true });
      }
    } catch (err) {
      console.error("Failed to generate placement plan:", err);
      alert("Failed to generate your placement roadmap.");
    } finally {
      setGenerating(false);
    }
  };

  const handleAddSkillToGap = async (skill: string) => {
    if (currentSkills.includes(skill)) return;
    const nextSkills = [...currentSkills, skill];

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      await api.post("/api/placement/update-skills", { skills: nextSkills }, { headers });
      setCurrentSkills(nextSkills);
    } catch (err) {
      console.error("Failed to update skills:", err);
      alert("Failed to check off skill gap");
    }
  };

  // Profile Skills management
  const handleAddNewSkill = async () => {
    const skill = newSkill.trim();
    if (!skill) return;
    if (currentSkills.includes(skill)) {
       setNewSkill("");
       return;
    }
    const nextSkills = [...currentSkills, skill];
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      await api.post("/api/placement/update-skills", { skills: nextSkills }, { headers });
      setCurrentSkills(nextSkills);
      setNewSkill("");
    } catch (err) {
      console.error(err);
      alert("Failed to add skill");
    }
  };

  const handleRemoveSkill = async (skillToRemove: string) => {
    const nextSkills = currentSkills.filter(s => s !== skillToRemove);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await api.post("/api/placement/update-skills", { skills: nextSkills }, { headers });
      setCurrentSkills(nextSkills);
    } catch (err) {
      console.error(err);
      alert("Failed to remove skill");
    }
  };

  const toggleSkill = async (skill: string) => {
    let nextSkills: string[];
    if (currentSkills.includes(skill)) {
      nextSkills = currentSkills.filter((s) => s !== skill);
    } else {
      nextSkills = [...currentSkills, skill];
    }
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      await api.post("/api/placement/update-skills", { skills: nextSkills }, { headers });
      setCurrentSkills(nextSkills);
    } catch (err) {
      console.error("Failed to update skills:", err);
      alert("Failed to update skill");
    }
  };

  // Profile Companies management
  const handleAddNewCompany = async () => {
    if (!newCompany.trim()) return;
    const company = newCompany.trim();
    if (targetCompanies.includes(company)) {
       setNewCompany("");
       setAddingCompany(false);
       return;
    }
    const nextCompanies = [...targetCompanies, company];
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      await api.patch("/api/placement/update-companies", { target_companies: nextCompanies }, { headers });
      setTargetCompanies(nextCompanies);
      setNewCompany("");
      setAddingCompany(false);
    } catch (err) {
      console.error(err);
      alert("Failed to add company");
    }
  };

  const handleRemoveCompany = async (companyToRemove: string) => {
    const nextCompanies = targetCompanies.filter(c => c !== companyToRemove);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await api.patch("/api/placement/update-companies", { target_companies: nextCompanies }, { headers });
      setTargetCompanies(nextCompanies);
    } catch (err) {
      console.error(err);
      alert("Failed to remove company");
    }
  };

  const handleUpdateGoal = async (newGoal: string) => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await api.patch("/api/placement/update-goal", { goal: newGoal }, { headers });
      setProfile(prev => ({ ...prev, goal: newGoal }));
      setEditingGoal(false);
    } catch (err) {
      console.error(err);
      alert("Failed to update goal");
    }
  };

  const handlePYQUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      setUploadError("Please upload a PDF file only.");
      return;
    }

    setUploadError(null);
    setAnalyzing(true);
    setPyqResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const res = await api.post("/api/placement/analyze-pyq", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          ...headers,
        },
      });

      setPyqResult(res.data);
    } catch (err) {
      console.error("PYQ analysis failed:", err);
      setUploadError("Failed to analyze the exam paper. Please try again.");
    } finally {
      setAnalyzing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Task checkmarks logic
  const getTaskKey = (weekNum: number, taskIdx: number) => `campusflow_task_w${weekNum}_t${taskIdx}`;

  const isTaskDone = (taskKey: string) => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(taskKey) === 'true';
  };

  const toggleTask = (taskKey: string) => {
    if (typeof window === 'undefined') return;
    const current = localStorage.getItem(taskKey) === 'true';
    if (current) {
      localStorage.removeItem(taskKey);
    } else {
      localStorage.setItem(taskKey, 'true');
    }
    setRefreshCount(prev => prev + 1);
  };

  // Custom module logic
  const handleAddCustomTask = () => {
    if (!customTaskName.trim()) return;
    setCustomTasks([...customTasks, customTaskName.trim()]);
    setCustomTaskName("");
  };

  const handleAddCustomModule = async () => {
    if (!customModuleName || customTasks.length === 0) return;
    setAddingCustom(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const res = await api.patch("/api/placement/add-custom-module", {
        module_name: customModuleName,
        tasks: customTasks
      }, { headers });

      if (res.data?.success && res.data.updated_plan) {
        setPlan(res.data.updated_plan);
        setCustomModuleName("");
        setCustomTasks([]);
        setCustomTaskName("");
        alert("Custom module added to your roadmap!");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to add custom module");
    } finally {
      setAddingCustom(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score < 40) return "text-red-500 bg-red-50 border-red-100";
    if (score <= 70) return "text-amber-500 bg-amber-50 border-amber-100";
    return "text-green-500 bg-green-50 border-green-100";
  };

  const getScoreNumColor = (score: number) => {
    if (score < 40) return "text-red-600";
    if (score <= 70) return "text-amber-600";
    return "text-green-600";
  };

  const toggleWeek = (weekNum: number) => {
    setOpenWeeks(prev => ({ ...prev, [weekNum]: !prev[weekNum] }));
  };

  const getCurrentWeekNum = () => {
    if (!plan || !plan.created_at) return 1;
    const start = new Date(plan.created_at);
    const today = new Date();
    const diffTime = today.getTime() - start.getTime();
    const diffWeeks = Math.floor(diffTime / (7 * 24 * 60 * 60 * 1000)) + 1;
    return Math.min(8, Math.max(1, diffWeeks));
  };

  const currentActiveWeek = getCurrentWeekNum();

  return (
    <div className="space-y-6">
      {loading ? (
        <Card className="flex items-center justify-center py-20 text-xs text-slate-400">
          <Loader2 size={16} className="animate-spin mr-2" />
          Loading your placement copilot dashboard...
        </Card>
      ) : !plan ? (
        <Card className="p-10 text-center space-y-4 bg-white">
          <Sparkles className="mx-auto text-purple-500 animate-pulse" size={36} />
          <h2 className="text-base font-bold text-slate-800">Your Placement Copilot</h2>
          <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
            Generate an AI-powered 8-week roadmap tailored to your target companies, skill gaps, and goals.
          </p>
          <Button onClick={handleGenerate} disabled={generating} className="gap-2 px-6 rounded-xl">
            {generating ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                AI is building your personalized roadmap...
              </>
            ) : (
              <>
                <Sparkles size={14} />
                Generate My Placement Plan
              </>
            )}
          </Button>
        </Card>
      ) : (
        <>
          {/* Profile Section (Feature 1) */}
          <Card className="mb-6 border border-slate-100 bg-white">
             <div className="flex justify-between items-center border-b border-slate-50 pb-3 mb-4">
                <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <User size={16} className="text-primary" />
                  Your Placement Profile
                </h2>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Goal:</span>
                  {editingGoal ? (
                    <select 
                      className="text-xs border rounded p-1"
                      value={profile.goal || "Placement"}
                      onChange={(e) => handleUpdateGoal(e.target.value)}
                    >
                      <option value="Placement">Placement</option>
                      <option value="GATE">GATE</option>
                      <option value="Higher Studies">Higher Studies</option>
                      <option value="Entrepreneurship">Entrepreneurship</option>
                    </select>
                  ) : (
                    <div className="flex items-center gap-1 text-xs font-bold text-slate-700 bg-slate-50 px-2 py-1 rounded">
                      {profile.goal || "Placement"}
                      <button onClick={() => setEditingGoal(true)} className="text-slate-400 hover:text-slate-600 ml-1">
                        <Edit2 size={12} />
                      </button>
                    </div>
                  )}
                </div>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Side: Current Skills */}
                <div>
                  <h3 className="text-xs font-bold text-slate-700 mb-2">Current Skills</h3>
                  
                  {/* Preset skills - quick select */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {PRESET_SKILLS.map(skill => {
                      const isSelected = selectedSkills.includes(skill);
                      return (
                        <button
                          key={skill}
                          type="button"
                          onClick={() => toggleSkill(skill)}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-medium border transition-colors ${
                            isSelected
                              ? 'bg-green-600 text-white border-green-600'
                              : 'bg-white text-slate-600 border-slate-300 hover:border-green-400'
                          }`}
                        >
                          {isSelected ? '✓ ' : ''}{skill}
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom skill input */}
                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      value={newSkill}
                      onChange={(e) => setNewSkill(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddNewSkill();
                        }
                      }}
                      placeholder="Add custom skill (e.g. React, Figma...)"
                      className="flex-1 px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-green-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddNewSkill}
                      className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs hover:bg-green-700 font-semibold"
                    >
                      Add
                    </button>
                  </div>

                  {/* Custom skills added - shown as removable chips */}
                  {customSkills.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {customSkills.map(skill => (
                        <span key={skill} 
                          className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full text-[10px] font-medium flex items-center gap-1 border border-indigo-100">
                          {skill}
                          <button 
                            type="button"
                            onClick={() => handleRemoveSkill(skill)}
                            className="ml-0.5 text-indigo-400 hover:text-indigo-700 font-bold">
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  
                  <p className="text-[9px] text-slate-400 mt-1.5">
                    Press Enter or click Add to include a custom skill
                  </p>
                </div>

                {/* Right Side: Target Companies */}
                <div>
                  <h3 className="text-xs font-bold text-slate-700 mb-2">Target Companies</h3>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {targetCompanies.map((company, idx) => (
                      <span key={idx} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
                        {company}
                        <button onClick={() => handleRemoveCompany(company)} className="text-purple-500 hover:text-purple-700">
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                  {addingCompany ? (
                    <div className="flex items-center gap-2">
                      <input 
                        type="text" 
                        value={newCompany}
                        onChange={(e) => setNewCompany(e.target.value)}
                        placeholder="Type company and press Enter"
                        className="text-xs border rounded px-2 py-1 focus:outline-none focus:border-primary"
                        onKeyDown={(e) => e.key === 'Enter' && handleAddNewCompany()}
                        autoFocus
                      />
                      <button onClick={handleAddNewCompany} className="text-xs bg-primary text-white px-2 py-1 rounded font-medium">Add</button>
                      <button onClick={() => setAddingCompany(false)} className="text-slate-400 hover:text-slate-600"><X size={14}/></button>
                    </div>
                  ) : (
                    <button onClick={() => setAddingCompany(true)} className="text-xs text-primary font-semibold flex items-center gap-1 hover:underline">
                      <Plus size={12} /> Add Company
                    </button>
                  )}
                </div>
             </div>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Left panel (Roadmap + Tips + PYQ Analyzer) */}
            <div className="lg:col-span-3 space-y-6">
              {/* 8-Week Roadmap */}
              <Card>
                <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-50 pb-3">
                  <BookOpen size={16} className="text-primary" />
                  Your Learning Roadmap
                </h2>

                <div className="mt-4 space-y-3">
                  {plan.weekly_plan?.map((w, index) => {
                    const isOpen = !!openWeeks[w.week];
                    const isCurrent = w.week === currentActiveWeek;

                    return (
                      <div
                        key={w.week + "-" + index}
                        className={`border rounded-2xl overflow-hidden transition-all duration-200 ${
                          isCurrent
                            ? "border-purple-200 ring-1 ring-purple-100 bg-purple-50/10"
                            : "border-slate-100"
                        }`}
                      >
                        <button
                          onClick={() => toggleWeek(w.week)}
                          className="w-full flex items-center justify-between p-4 bg-white hover:bg-slate-50/50 text-left text-xs font-semibold"
                        >
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-lg text-[9px] font-bold ${
                              isCurrent ? "bg-purple-600 text-white" : w.custom ? "bg-purple-100 text-purple-700" : "bg-slate-100 text-slate-500"
                            }`}>
                              Week {w.week}
                            </span>
                            {w.custom && (
                              <span className="px-2 py-0.5 rounded-lg text-[9px] font-bold bg-purple-50 text-purple-600 border border-purple-100">
                                Custom
                              </span>
                            )}
                            <span className="text-slate-800 font-semibold">{w.focus}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {isCurrent && (
                              <span className="text-[9px] text-purple-600 bg-purple-50 font-bold border border-purple-100 px-1.5 py-0.5 rounded">
                                Current Week
                              </span>
                            )}
                            {isOpen ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                          </div>
                        </button>

                        {isOpen && (
                          <div className="p-4 border-t border-slate-50 bg-white space-y-3 text-[11px]">
                            <div>
                              <p className="font-bold text-slate-700 mb-1.5">Action Tasks:</p>
                              <ul className="pl-2 space-y-2 text-slate-600">
                                {w.tasks.map((task, idx) => {
                                  const tKey = getTaskKey(w.week, idx);
                                  const done = isTaskDone(tKey);
                                  return (
                                    <li key={idx} className="flex items-start gap-2 leading-relaxed cursor-pointer group" onClick={() => toggleTask(tKey)}>
                                      <button 
                                        className={`shrink-0 mt-0.5 h-4 w-4 rounded flex items-center justify-center transition-colors border ${done ? 'bg-purple-500 border-purple-500 text-white' : 'border-slate-300 group-hover:border-purple-400'}`}
                                      >
                                        {done && <Check size={10} strokeWidth={3} />}
                                      </button>
                                      <span className={`${done ? 'line-through text-slate-400' : ''}`}>{task}</span>
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>

                            {w.resources?.length > 0 && (
                              <div className="pt-2 border-t border-dashed border-slate-100">
                                <p className="font-bold text-slate-700 mb-1">Recommended Resources:</p>
                                <div className="space-y-0.5 text-primary">
                                  {w.resources.map((res, idx) => (
                                    <p key={idx} className="hover:underline cursor-pointer">{res}</p>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Feature 3: Add Custom Module Form */}
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <h3 className="text-xs font-bold text-slate-700 mb-3">Add Custom Week / Module</h3>
                  <div className="space-y-3">
                    <input 
                      type="text" 
                      placeholder="Module Name (e.g. Node.js Basics)"
                      value={customModuleName}
                      onChange={(e) => setCustomModuleName(e.target.value)}
                      className="w-full text-xs border rounded-xl px-3 py-2 focus:outline-none focus:border-primary"
                    />
                    
                    <div>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          placeholder="Task Description"
                          value={customTaskName}
                          onChange={(e) => setCustomTaskName(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleAddCustomTask()}
                          className="flex-1 text-xs border rounded-xl px-3 py-2 focus:outline-none focus:border-primary"
                        />
                        <Button variant="secondary" onClick={handleAddCustomTask} className="px-4 py-2 text-xs">Add Task</Button>
                      </div>
                      
                      {customTasks.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {customTasks.map((t, i) => (
                            <li key={i} className="text-[11px] text-slate-600 flex items-center gap-1 before:content-['•'] before:mr-1">
                              {t}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <Button 
                      onClick={handleAddCustomModule} 
                      disabled={!customModuleName || customTasks.length === 0 || addingCustom}
                      className="w-full text-xs py-2"
                    >
                      {addingCustom ? "Adding..." : "Save Custom Module"}
                    </Button>
                  </div>
                </div>
              </Card>

              {/* PYQ Analyzer */}
              <Card>
                <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-50 pb-3">
                  <FileText size={16} className="text-primary" />
                  Exam Pattern Analyzer
                </h2>

                <div className="mt-4 space-y-4">
                  <p className="text-slate-500 text-xs leading-relaxed">
                    Upload previous year question papers (PYQs) to extract topic weightage, study priority, and key insights.
                  </p>

                  <div className="flex items-center gap-3">
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="application/pdf"
                      onChange={handlePYQUpload}
                      className="hidden"
                    />
                    <Button
                      variant="secondary"
                      disabled={analyzing}
                      onClick={() => fileInputRef.current?.click()}
                      className="gap-2 text-xs py-2 px-4 rounded-xl"
                    >
                      {analyzing ? (
                        <>
                          <Loader2 size={13} className="animate-spin" />
                          Analyzing exam patterns...
                        </>
                      ) : (
                        <>
                          <FileText size={13} />
                          Upload PYQ PDF
                        </>
                      )}
                    </Button>
                  </div>

                  {uploadError && (
                    <p className="text-[10px] text-red-500 font-semibold">{uploadError}</p>
                  )}

                  {/* PYQ Results display */}
                  {pyqResult && (
                    <div className="mt-4 p-4 rounded-2xl border border-slate-100 bg-slate-50/50 space-y-4 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800 text-xs">
                          Subject: {pyqResult.subject}
                        </span>
                        <span className="text-[10px] bg-green-50 text-green-600 font-semibold px-2 py-0.5 rounded border border-green-100">
                          Analysis Complete
                        </span>
                      </div>

                      {/* Topic percentages */}
                      <div className="space-y-2.5">
                        <p className="font-bold text-slate-700 text-[10px] uppercase tracking-wider">Topic Weightage</p>
                        {pyqResult.topics.map((t, idx) => (
                          <div key={idx} className="space-y-1">
                            <div className="flex justify-between text-[10px] text-slate-600 font-semibold">
                              <span>{t.topic}</span>
                              <span>{t.percentage}%</span>
                            </div>
                            <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                              <div
                                style={{ width: `${t.percentage}%` }}
                                className="h-full bg-purple-600 rounded-full"
                              />
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Categorized badges */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-200/50">
                        <div>
                          <p className="font-bold text-green-700 text-[10px] uppercase tracking-wider mb-1.5">Most Important</p>
                          <div className="flex flex-wrap gap-1.5">
                            {pyqResult.most_important.map((t, idx) => (
                              <span key={idx} className="px-2 py-0.5 rounded text-[10px] font-semibold bg-green-50 text-green-700 border border-green-100">
                                {t}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div>
                          <p className="font-bold text-amber-700 text-[10px] uppercase tracking-wider mb-1.5">Likely This Year</p>
                          <div className="flex flex-wrap gap-1.5">
                            {pyqResult.likely_this_year.map((t, idx) => (
                              <span key={idx} className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-100">
                                {t}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Study priority */}
                      <div className="pt-2 border-t border-slate-200/50">
                        <p className="font-bold text-slate-700 text-[10px] uppercase tracking-wider mb-1">Study Priority Order</p>
                        <ol className="list-decimal pl-4 space-y-1 text-slate-600 text-[11px]">
                          {pyqResult.priority_order.map((t, idx) => (
                            <li key={idx} className="leading-tight">{t}</li>
                          ))}
                        </ol>
                      </div>

                      {/* Insight paragraph */}
                      <div className="pt-2 border-t border-slate-200/50 bg-white/70 p-3 rounded-xl border border-slate-100">
                        <p className="font-bold text-slate-700 text-[10px] uppercase tracking-wider mb-1">Pattern Insights</p>
                        <p className="text-slate-600 text-[11px] leading-relaxed italic">{pyqResult.insight}</p>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            </div>

            {/* Right panel (Stats + Skill gaps + Tips list) */}
            <div className="lg:col-span-2 space-y-6">
              {/* Readiness score card */}
              <Card className={`text-center p-6 border ${getScoreColor(plan.readiness_score)}`}>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Readiness Score</p>
                <div className="relative inline-block mt-3">
                  <span className={`text-5xl font-black ${getScoreNumColor(plan.readiness_score)}`}>
                    {plan.readiness_score}
                  </span>
                  <span className="text-slate-400 text-xs font-semibold">/100</span>
                </div>
                <p className="text-xs font-bold text-slate-800 mt-2">Placement Readiness Score</p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {plan.skill_gaps?.length} skill{plan.skill_gaps?.length === 1 ? "" : "s"} to develop
                </p>
              </Card>

              {/* Skill gaps */}
              <Card>
                <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-50 pb-3">
                  <TrendingUp size={16} className="text-primary" />
                  Skills to Develop
                </h2>

                <div className="mt-4 flex flex-wrap gap-2">
                  {plan.skill_gaps?.map((skill) => {
                    const isAcquired = currentSkills.includes(skill);
                    return (
                      <div
                        key={skill}
                        className={`flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-xl text-xs border font-medium transition duration-200 ${
                          isAcquired
                            ? "bg-green-50 text-green-700 border-green-200"
                            : "bg-red-50 text-red-700 border-red-200"
                        }`}
                      >
                        <span>{skill}</span>
                        <button
                          onClick={() => handleAddSkillToGap(skill)}
                          disabled={isAcquired}
                          className={`p-1 rounded-lg transition ${
                            isAcquired
                              ? "text-green-600"
                              : "hover:bg-red-100 text-red-500 hover:text-red-700"
                          }`}
                        >
                          {isAcquired ? <CheckCircle size={14} /> : <Check size={14} />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </Card>

              {/* Interview Tips */}
              <Card>
                <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-50 pb-3">
                  <Award size={16} className="text-primary" />
                  Interview Preparation Tips
                </h2>

                <div className="mt-4 space-y-3">
                  {plan.tips?.map((tip, idx) => (
                    <div key={idx} className="flex gap-2.5 items-start text-xs">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-purple-50 text-purple-600 font-bold">
                        {idx + 1}
                      </span>
                      <p className="text-slate-600 leading-relaxed">{tip}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
