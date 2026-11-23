export const MAX_MESSAGE_LENGTH = 200;

const graphemeSegmenter =
  typeof Intl.Segmenter === "undefined"
    ? null
    : new Intl.Segmenter(undefined, { granularity: "grapheme" });

export function getMessageLength(content: string): number {
  if (graphemeSegmenter) {
    return Array.from(graphemeSegmenter.segment(content)).length;
  }

  return Array.from(content).length;
}

export function getMessageValidationError(
  content: string,
  subject = "メッセージ",
): string | null {
  if (content.trim().length === 0) {
    return `${subject}を入力してください。`;
  }

  if (getMessageLength(content) > MAX_MESSAGE_LENGTH) {
    return `${subject}は${MAX_MESSAGE_LENGTH}文字以内で入力してください。`;
  }

  return null;
}

export function validateMessageContent(
  content: string,
  subject = "メッセージ",
): string {
  const validationError = getMessageValidationError(content, subject);
  if (validationError) {
    throw new Error(validationError);
  }

  return content.trim();
}
