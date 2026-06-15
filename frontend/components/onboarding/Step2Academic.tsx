"use client";

import Button from "@/components/ui/Button";
import { BRANCHES, HOSTELS, OnboardingData, SECTIONS, YEARS } from "./types";

export default function Step2Academic({
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
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Academic details</h2>
        <p className="mt-1 text-sm text-slate-500">
          Tell us about your branch, year, and section.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Branch</label>
          <select
            value={data.branch}
            onChange={(e) => setData({ branch: e.target.value })}
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {BRANCHES.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Year</label>
          <select
            value={data.year}
            onChange={(e) => setData({ year: Number(e.target.value) })}
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {YEARS.map((y) => (
              <option key={y} value={y}>
                Year {y}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Section</label>
          <select
            value={data.section}
            onChange={(e) => setData({ section: e.target.value })}
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {SECTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Hostel</label>
          <select
            value={data.hostel}
            onChange={(e) => setData({ hostel: e.target.value })}
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {HOSTELS.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
        </div>
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
