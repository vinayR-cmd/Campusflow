"use client";

import { useState } from "react";
import { X } from "lucide-react";
import Button from "@/components/ui/Button";
import { GOALS, OnboardingData } from "./types";

const PRESET_SKILLS = [
  'DSA', 'Python', 'Java', 'C++', 'ML/AI', 
  'Web Dev', 'SQL', 'System Design', 
  'Communication', 'Leadership', 'React',
  'Node.js', 'Data Science', 'DevOps', 'Android'
];

export default function Step3Goals({
  data,
  setData,
  onNext,
  onBack,
}: {
  data: OnboardingData;
  setData: (d: Partial<OnboardingData>) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [companyInput, setCompanyInput] = useState("");
  const [customSkillInput, setCustomSkillInput] = useState("");

  const selectedSkills = data.skills.filter(s => PRESET_SKILLS.includes(s));
  const customSkills = data.skills.filter(s => !PRESET_SKILLS.includes(s));

  const addCustomSkill = () => {
    const skill = customSkillInput.trim();
    if (!skill) return;
    if (data.skills.includes(skill)) return;
    setData({ skills: [...data.skills, skill] });
    setCustomSkillInput("");
  };

  const removeCustomSkill = (skill: string) => {
    setData({ skills: data.skills.filter(s => s !== skill) });
  };

  const addCompany = () => {
    const value = companyInput.trim();
    if (value && !data.target_companies.includes(value)) {
      setData({ target_companies: [...data.target_companies, value] });
    }
    setCompanyInput("");
  };

  const removeCompany = (company: string) => {
    setData({ target_companies: data.target_companies.filter((c) => c !== company) });
  };

  const toggleSkill = (skill: string) => {
    if (data.skills.includes(skill)) {
      setData({ skills: data.skills.filter((s) => s !== skill) });
    } else {
      setData({ skills: [...data.skills, skill] });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Goals & target</h2>
        <p className="mt-1 text-sm text-slate-500">
          This helps CampusFlow personalize your assistant.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          What's your primary goal?
        </label>
        <div className="grid grid-cols-2 gap-2">
          {GOALS.map((goal) => (
            <button
              key={goal}
              type="button"
              onClick={() => setData({ goal })}
              className={`rounded-xl border px-4 py-2.5 text-sm font-medium transition ${
                data.goal === goal
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {goal}
            </button>
          ))}
        </div>
      </div>

      {data.goal === "Placement" && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Target companies
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={companyInput}
              onChange={(e) => setCompanyInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCompany();
                }
              }}
              placeholder="e.g. Google, TCS, Infosys"
              className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <Button type="button" variant="secondary" onClick={addCompany}>
              Add
            </Button>
          </div>
          {data.target_companies.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {data.target_companies.map((company) => (
                <span
                  key={company}
                  className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                >
                  {company}
                  <button type="button" onClick={() => removeCompany(company)}>
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          LinkedIn Profile URL (optional)
        </label>
        <input
          type="url"
          placeholder="https://linkedin.com/in/your-username"
          value={data.linkedin_url || ""}
          onChange={(e) => setData({ linkedin_url: e.target.value })}
          className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <p className="mt-1 text-xs text-slate-400">
          Shown on leaderboard so peers can connect with you
        </p>
      </div>

      <div>
        <p className="font-medium text-slate-700 mb-3">Current Skills</p>
        
        {/* Preset skills - quick select */}
        <div className="flex flex-wrap gap-2 mb-4">
          {PRESET_SKILLS.map(skill => (
            <button
              key={skill}
              type="button"
              onClick={() => toggleSkill(skill)}
              className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                selectedSkills.includes(skill)
                  ? 'bg-purple-600 text-white border-purple-600'
                  : 'bg-white text-slate-600 border-slate-300 hover:border-purple-400'
              }`}
            >
              {selectedSkills.includes(skill) ? '✓ ' : ''}{skill}
            </button>
          ))}
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
                addCustomSkill();
              }
            }}
            placeholder="Add your own skill (e.g. React, Django, Figma...)"
            className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
          />
          <button
            type="button"
            onClick={addCustomSkill}
            className="px-4 py-2 bg-purple-600 text-white rounded-xl text-xs hover:bg-purple-700 font-semibold"
          >
            Add
          </button>
        </div>
        
        {/* Custom skills added - shown as removable chips */}
        {customSkills.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {customSkills.map(skill => (
              <span key={skill} 
                className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs flex items-center gap-1 border border-indigo-100">
                {skill}
                <button 
                  type="button"
                  onClick={() => removeCustomSkill(skill)}
                  className="ml-1 text-indigo-400 hover:text-indigo-700 font-bold">
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        
        <p className="text-[10px] text-slate-400 mt-2">
          Press Enter or click Add to include a custom skill
        </p>
      </div>

      <div className="flex gap-3">
        <Button variant="secondary" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext}>Continue</Button>
      </div>
    </div>
  );
}
