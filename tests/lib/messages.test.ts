import { beforeEach, describe, expect, it, vi } from "vitest";

const supabaseMocks = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock("../../lib/supabase/client", () => ({
  getSupabaseClient: () => ({
    rpc: supabaseMocks.rpc,
  }),
}));

import {
  getMessageHistory,
  getRandomMessage,
} from "../../lib/messages";

describe("message read operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseMocks.rpc.mockResolvedValue({ data: [], error: null });
  });

  it("does not let callers supply an identity to random-message retrieval", async () => {
    const excludedIds = ["550e8400-e29b-41d4-a716-446655440001"];

    await getRandomMessage(excludedIds);

    expect(supabaseMocks.rpc).toHaveBeenCalledWith("get_random_message", {
      p_excluded_ids: excludedIds,
    });
  });

  it("requests a fresh random message without client-side viewed exclusions", async () => {
    await getRandomMessage();

    expect(supabaseMocks.rpc).toHaveBeenCalledWith("get_random_message", {
      p_excluded_ids: [],
    });
  });

  it("requests only the signed-in user's selected history", async () => {
    await getMessageHistory("received");

    expect(supabaseMocks.rpc).toHaveBeenCalledWith("get_message_history", {
      p_direction: "received",
    });
  });
});
