import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export const DAILY_MESSAGE_LIMIT = 1;

export type DailyMessageUsage = {
  message_count: number;
  reply_count: number;
  resets_at: string;
};

export function getRemainingDailyActions(usedCount: number): number {
  return Math.max(0, DAILY_MESSAGE_LIMIT - usedCount);
}

export function getJstDayBounds(timestamp: Date): {
  startsAt: Date;
  resetsAt: Date;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(timestamp);
  const values = Object.fromEntries(
    parts.map(({ type, value }) => [type, value]),
  );
  const utcDayStart = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
  );
  const startsAt = new Date(utcDayStart - 9 * 60 * 60 * 1000);

  return {
    startsAt,
    resetsAt: new Date(startsAt.getTime() + 24 * 60 * 60 * 1000),
  };
}

export async function getDailyMessageUsage(
  supabase: SupabaseClient<Database>,
): Promise<DailyMessageUsage> {
  const { data, error } = await supabase.rpc("get_daily_message_usage");
  if (error) {
    throw new Error(error.message);
  }
  if (!data[0]) {
    throw new Error("本日の送信回数を取得できませんでした。");
  }

  return data[0];
}
