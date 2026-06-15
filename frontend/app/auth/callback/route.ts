import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (code) {
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            cookieStore.set({ name, value, ...options })
          },
          remove(name: string, options: any) {
            cookieStore.set({ name, value: '', ...options })
          },
        },
      }
    )

    await supabase.auth.exchangeCodeForSession(code)

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      // Check if profile is complete
      const { data: profile } = await supabase
        .from('profiles')
        .select('college, branch, year, section')
        .eq('student_id', user.id)
        .single()

      // If profile has college and branch → already onboarded → go to dashboard
      if (profile && profile.college && profile.branch && profile.year) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    }
  }

  // New user or incomplete profile → go to onboarding
  return NextResponse.redirect(new URL('/onboarding', request.url))
}