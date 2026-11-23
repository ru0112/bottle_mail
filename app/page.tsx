import { Suspense } from "react";
import { connection } from "next/server";
import Home from "./home";
import { getDailyMessageUsage } from "@/lib/daily-message-limits";
import type { DailyMessageUsage } from "@/lib/daily-message-limits";
import { isAuthSessionMissingError } from "@/lib/supabase/auth-errors";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default function HomePage() {
  if (!isSupabaseConfigured()) {
    return (
      <Home
        dailyUsage={null}
        isAuthenticated={false}
        supabaseConfigured={false}
      />
    );
  }

  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center px-5 py-8 text-sm text-cyan-100/70">
          ログイン状態を確認しています...
        </main>
      }
    >
      <AuthenticatedHome />
    </Suspense>
  );
}

async function AuthenticatedHome() {
  await connection();
  const supabase = await createSupabaseServerClient();
  let isAuthenticated = false;
  let dailyUsage: DailyMessageUsage | null = null;

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error && !isAuthSessionMissingError(error)) {
      throw error;
    }

    isAuthenticated = Boolean(user);
    if (user) {
      dailyUsage = await getDailyMessageUsage(supabase);
    }
  } catch (error) {
    if (!isAuthSessionMissingError(error)) {
      throw error;
    }
  }

  return (
    <Home
      dailyUsage={dailyUsage}
      isAuthenticated={isAuthenticated}
      supabaseConfigured
    />
  );
}
