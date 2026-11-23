"use server";

import { validateMessageContent } from "@/lib/message-validation";
import { isAuthSessionMissingError } from "@/lib/supabase/auth-errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function validateSubmittedContent(
  content: unknown,
  subject: string,
): string {
  if (typeof content !== "string") {
    throw new Error(`${subject}を入力してください。`);
  }

  return validateMessageContent(content, subject);
}

export async function createMessageAction(content: string): Promise<void> {
  const validatedContent = validateSubmittedContent(content, "メッセージ");
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError && !isAuthSessionMissingError(authError)) {
    throw authError;
  }
  if (!user) {
    throw new Error("メッセージを流すにはログインが必要です。");
  }

  const { error } = await supabase.rpc("create_message", {
    p_content: validatedContent,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function createMessageReplyAction(
  messageId: string,
  content: string,
): Promise<void> {
  const validatedContent = validateSubmittedContent(content, "返信");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("create_message_reply", {
    p_message_id: messageId,
    p_content: validatedContent,
  });

  if (error) {
    throw new Error(error.message);
  }
}
