"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { createClient } from "@/lib/supabase";
import { OnboardingData } from "./types";

export default function Step4Confirm({
  data,
  onBack,
}: {
  data: OnboardingData;
  onBack: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleComplete = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/login');
        return;
      }

      console.log("Saving profile data:", data);

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: data.full_name || session.user.user_metadata?.full_name || '',
          college: data.college,
          college_domain: data.email?.split('@')[1] || '',
          branch: data.branch,
          year: data.year,
          section: data.section,
          hostel: data.hostel,
          goal: data.goal,
          target_companies: data.target_companies || [],
          skills: data.skills || [],
          linkedin_url: data.linkedin_url || null,
        })
        .eq('student_id', session.user.id);

      console.log("Save error:", error);

      if (error) {
        alert('Failed to save profile: ' + error.message);
        setLoading(false);
        return;
      }

      // Also create digital_twin if not exists
      await supabase
        .from('digital_twin')
        .upsert({
          student_id: session.user.id,
          ahs_score: 0,
          data: {}
        }, { onConflict: 'student_id' });

      console.log("Profile saved successfully, redirecting to dashboard");
      router.push('/dashboard');

    } catch (err) {
      console.error("Save error:", err);
      alert('Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Confirm your details</h2>
        <p className="mt-1 text-sm text-slate-500">
          Double check everything looks right before we set up your dashboard.
        </p>
      </div>

      <dl className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
        <Row label="College" value={data.college} />
        <Row label="Branch" value={data.branch} />
        <Row label="Year" value={`Year ${data.year}`} />
        <Row label="Section" value={data.section} />
        <Row label="Hostel" value={data.hostel} />
        <Row label="Goal" value={data.goal} />
        {data.goal === "Placement" && (
          <Row
            label="Target companies"
            value={data.target_companies.length ? data.target_companies.join(", ") : "—"}
          />
        )}
        <Row label="Skills" value={data.skills.length ? data.skills.join(", ") : "—"} />
      </dl>

      <div className="flex gap-3">
        <Button variant="secondary" onClick={onBack} disabled={loading}>
          Back
        </Button>
        <Button onClick={handleComplete} disabled={loading}>
          {loading ? "Saving..." : "Let's Go"}
        </Button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-900 text-right">{value}</dd>
    </div>
  );
}
