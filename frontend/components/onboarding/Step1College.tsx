"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { api } from "@/lib/api";
import { OnboardingData } from "./types";

export default function Step1College({
  data,
  setData,
  onNext,
}: {
  data: OnboardingData;
  setData: (d: Partial<OnboardingData>) => void;
  onNext: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [detected, setDetected] = useState<string | null>(null);
  const [showManualInput, setShowManualInput] = useState(false);

  useEffect(() => {
    if (!data.email) return;

    const domain = data.email.split("@")[1] || "";
    setData({ collegeDomain: domain });

    api
      .get("/api/auth/detect-college", { params: { email: data.email } })
      .then((res) => {
        if (res.data.known && res.data.college) {
          setDetected(res.data.college);
          setData({ college: res.data.college });
        } else {
          setShowManualInput(true);
        }
      })
      .catch(() => setShowManualInput(true))
      .finally(() => setLoading(false));
  }, [data.email]);

  const handleNotCorrect = () => {
    setDetected(null);
    setShowManualInput(true);
    setData({ college: "" });
  };

  if (loading) {
    return <p className="text-sm text-slate-500">Detecting your college...</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Which college are you from?</h2>
        <p className="mt-1 text-sm text-slate-500">
          We use this to connect you with the right campus resources.
        </p>
      </div>

      {detected && !showManualInput && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm text-slate-600">We detected your college as:</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{detected}</p>
          <p className="mt-3 text-sm text-slate-500">Is this correct?</p>
          <div className="mt-3 flex gap-3">
            <Button onClick={onNext}>Yes, that's correct</Button>
            <Button variant="secondary" onClick={handleNotCorrect}>
              No, let me enter it
            </Button>
          </div>
        </div>
      )}

      {showManualInput && (
        <div className="space-y-3">
          <label className="block text-sm font-medium text-slate-700">
            Enter your college name
          </label>
          <input
            type="text"
            value={data.college}
            onChange={(e) => setData({ college: e.target.value })}
            placeholder="e.g. ABC Institute of Technology"
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <Button onClick={onNext} disabled={!data.college.trim()}>
            Continue
          </Button>
        </div>
      )}
    </div>
  );
}
