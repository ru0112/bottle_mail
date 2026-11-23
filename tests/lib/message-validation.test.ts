import { describe, expect, it } from "vitest";
import {
  getMessageLength,
  getMessageValidationError,
  MAX_MESSAGE_LENGTH,
  validateMessageContent,
} from "../../lib/message-validation";

describe("message content length validation", () => {
  it("rejects empty or whitespace-only content", () => {
    expect(getMessageValidationError("")).toBe("メッセージを入力してください。");
    expect(getMessageValidationError("   ")).toBe(
      "メッセージを入力してください。",
    );
    expect(() => validateMessageContent("")).toThrow(
      "メッセージを入力してください。",
    );
  });

  it("accepts exactly 200 characters and rejects 201", () => {
    const atLimit = "あ".repeat(MAX_MESSAGE_LENGTH);
    const overLimit = "あ".repeat(MAX_MESSAGE_LENGTH + 1);

    expect(getMessageLength(atLimit)).toBe(200);
    expect(getMessageValidationError(atLimit)).toBeNull();
    expect(validateMessageContent(atLimit)).toBe(atLimit);
    expect(getMessageLength(overLimit)).toBe(201);
    expect(getMessageValidationError(overLimit)).toBe(
      "メッセージは200文字以内で入力してください。",
    );
    expect(() => validateMessageContent(overLimit)).toThrow(
      "メッセージは200文字以内で入力してください。",
    );
  });

  it("counts emoji and combined emoji sequences as single graphemes", () => {
    expect(getMessageLength("😀")).toBe(1);
    expect(getMessageLength("👨‍👩‍👧‍👦")).toBe(1);
    expect(getMessageLength("😀".repeat(200))).toBe(200);
  });

  it("uses the supplied label for reply validation errors", () => {
    expect(getMessageValidationError(" ", "返信")).toBe(
      "返信を入力してください。",
    );
    expect(() => validateMessageContent("x".repeat(201), "返信")).toThrow(
      "返信は200文字以内で入力してください。",
    );
  });
});
