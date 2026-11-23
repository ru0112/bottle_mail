import { getSupabaseClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

export type ReceivedMessage = Pick<
  Database["public"]["Tables"]["messages"]["Row"],
  "id" | "content" | "created_at"
>;

export type MessageThreadEntry =
  Database["public"]["Functions"]["get_message_thread"]["Returns"][number];

export type MessageHistoryItem =
  Database["public"]["Functions"]["get_message_history"]["Returns"][number];

export async function getRandomMessage(
  excludedMessageIds: string[] = [],
): Promise<ReceivedMessage | null> {
  const { data, error } = await getSupabaseClient().rpc("get_random_message", {
    p_excluded_ids: excludedMessageIds,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data[0] ?? null;
}

export async function getMessageThread(
  messageId: string,
): Promise<MessageThreadEntry[]> {
  const { data, error } = await getSupabaseClient().rpc("get_message_thread", {
    p_message_id: messageId,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function getMessageHistory(
  direction: "sent" | "received",
): Promise<MessageHistoryItem[]> {
  const { data, error } = await getSupabaseClient().rpc(
    "get_message_history",
    {
      p_direction: direction,
    },
  );

  if (error) {
    throw new Error(error.message);
  }

  return data;
}
