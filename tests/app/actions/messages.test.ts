import { beforeEach, describe, expect, it, vi } from "vitest";

const supabaseMocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  getUser: vi.fn(),
  from: vi.fn(),
  insert: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("../../../lib/supabase/server", () => ({
  createSupabaseServerClient: supabaseMocks.createSupabaseServerClient,
}));

import {
  createMessageAction,
  createMessageReplyAction,
} from "../../../app/actions/messages";

const userId = "550e8400-e29b-41d4-a716-446655440000";
const messageId = "550e8400-e29b-41d4-a716-446655440001";

describe("message server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: userId } },
      error: null,
    });
    supabaseMocks.insert.mockResolvedValue({ error: null });
    supabaseMocks.from.mockReturnValue({ insert: supabaseMocks.insert });
    supabaseMocks.rpc.mockResolvedValue({ data: null, error: null });
    supabaseMocks.createSupabaseServerClient.mockResolvedValue({
      auth: { getUser: supabaseMocks.getUser },
      from: supabaseMocks.from,
      rpc: supabaseMocks.rpc,
    });
  });

  it("accepts a 200-character post and stores it for the authenticated user", async () => {
    const content = "あ".repeat(200);

    await createMessageAction(content);

    expect(supabaseMocks.from).toHaveBeenCalledWith("messages");
    expect(supabaseMocks.insert).toHaveBeenCalledWith({
      content,
      user_id: userId,
    });
  });

  it("rejects empty and over-limit posts before contacting Supabase", async () => {
    await expect(createMessageAction("")).rejects.toThrow(
      "メッセージを入力してください。",
    );
    await expect(createMessageAction("あ".repeat(201))).rejects.toThrow(
      "メッセージは200文字以内で入力してください。",
    );

    expect(supabaseMocks.createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("rejects over-limit replies before calling the RPC", async () => {
    await expect(
      createMessageReplyAction(messageId, "あ".repeat(201)),
    ).rejects.toThrow("返信は200文字以内で入力してください。");

    expect(supabaseMocks.rpc).not.toHaveBeenCalled();
  });

  it("validates and trims reply content before passing it to the database", async () => {
    await createMessageReplyAction(messageId, "  返信  ");

    expect(supabaseMocks.rpc).toHaveBeenCalledWith("create_message_reply", {
      p_message_id: messageId,
      p_content: "返信",
    });
  });
});
