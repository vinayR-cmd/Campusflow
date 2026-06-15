"use client";

import { GraduationCap, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export default function Header({
  fullName,
  college,
}: {
  fullName: string;
  college: string;
}) {
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white">
          <GraduationCap size={20} />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-900 leading-none">CampusFlow</p>
          <p className="text-xs text-slate-400 leading-none mt-1">{college}</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-slate-700">{fullName}</span>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
        >
          <LogOut size={14} />
          Sign out
        </button>
      </div>
    </header>
  );
}
