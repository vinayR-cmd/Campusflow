"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ProgressBar from "@/components/ui/ProgressBar";
import Step1College from "@/components/onboarding/Step1College";
import Step2Academic from "@/components/onboarding/Step2Academic";
import Step3Goals from "@/components/onboarding/Step3Goals";
import Step4Confirm from "@/components/onboarding/Step4Confirm";
import { DEFAULT_ONBOARDING_DATA, OnboardingData } from "@/components/onboarding/types";
import { createClient } from "@/lib/supabase";

const TOTAL_STEPS = 4;

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [data, setDataState] = useState<OnboardingData>(DEFAULT_ONBOARDING_DATA);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    const checkProfile = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          router.push("/login");
          return;
        }

        if (session.user?.email) {
          setDataState((prev) => ({ ...prev, email: session.user.email! }));
        }

        // Try fetching profile
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("college, branch, year, section, full_name")
          .eq("student_id", session.user.id)
          .maybeSingle();

        console.log("=== ONBOARDING CHECK ===");
        console.log("User ID:", session.user.id);
        console.log("Profile data:", JSON.stringify(profile));
        console.log("Error:", error);
        console.log("Has college:", !!profile?.college);
        console.log("Has branch:", !!profile?.branch);
        console.log("Has year:", !!profile?.year);

        // If profile exists with required fields → skip onboarding
        if (profile && profile.college && profile.branch && profile.year) {
          console.log("Profile complete → redirecting to dashboard");
          router.replace("/dashboard");
          return;
        }

        console.log("Profile incomplete → showing onboarding");
        setLoading(false);

      } catch (err) {
        console.error("Onboarding check error:", err);
        setLoading(false);
      }
    };

    checkProfile();
  }, []);

  const setData = (update: Partial<OnboardingData>) => {
    setDataState((prev) => ({ ...prev, ...update }));
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm text-slate-500">Checking your profile...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-6">
          <h1 className="text-lg font-bold text-primary">CampusFlow</h1>
          <div className="mt-4">
            <ProgressBar step={step} totalSteps={TOTAL_STEPS} />
          </div>
        </div>

        {step === 1 && (
          <Step1College data={data} setData={setData} onNext={() => setStep(2)} />
        )}
        {step === 2 && (
          <Step2Academic
            data={data}
            setData={setData}
            onNext={() => setStep(3)}
            onBack={() => setStep(1)}
          />
        )}
        {step === 3 && (
          <Step3Goals
            data={data}
            setData={setData}
            onNext={() => setStep(4)}
            onBack={() => setStep(2)}
          />
        )}
        {step === 4 && <Step4Confirm data={data} onBack={() => setStep(3)} />}
      </div>
    </main>
  );
}