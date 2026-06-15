import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export default async function Home() {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("profile_complete")
    .eq("student_id", data.user.id)
    .maybeSingle();

  if (profile?.profile_complete) {
    redirect("/dashboard");
  }

  redirect("/onboarding");
}
