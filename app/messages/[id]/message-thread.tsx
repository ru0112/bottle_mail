"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { createMessageReplyAction } from "@/app/actions/messages";
import {
  DAILY_MESSAGE_LIMIT,
  getRemainingDailyActions,
} from "@/lib/daily-message-limits";
import type { DailyMessageUsage } from "@/lib/daily-message-limits";
import type { MessageThreadEntry } from "@/lib/messages";
import {
  getMessageLength,
  getMessageValidationError,
  MAX_MESSAGE_LENGTH,
} from "@/lib/message-validation";
import { canPostReply } from "@/lib/thread-rules";

type MessageThreadProps = {
  dailyUsage: DailyMessageUsage;
  entries: MessageThreadEntry[];
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "原因を特定できませんでした。";
}

export default function MessageThread({
  dailyUsage: initialDailyUsage,
  entries,
}: MessageThreadProps) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [optimisticReplyResetAt, setOptimisticReplyResetAt] = useState<
    string | null
  >(null);
  const messageId = entries[0].message_id;
  const replyCount = entries.length - 1;
  const lastEntry = entries[entries.length - 1];
  const canReply = canPostReply(replyCount, lastEntry.speaker);
  const contentLength = getMessageLength(content);
  const contentValidationError = getMessageValidationError(content, "返信");
  const remainingReplies = getRemainingDailyActions(
    initialDailyUsage.reply_count +
      Number(optimisticReplyResetAt === initialDailyUsage.resets_at),
  );

  useEffect(() => {
    if (remainingReplies !== 0) {
      return;
    }

    const timer = window.setInterval(() => router.refresh(), 60_000);
    return () => window.clearInterval(timer);
  }, [remainingReplies, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedContent = content.trim();
    if (
      !canReply ||
      remainingReplies === 0 ||
      !trimmedContent ||
      contentValidationError ||
      isSending
    ) {
      return;
    }

    setError(null);
    setIsSending(true);
    try {
      await createMessageReplyAction(messageId, content);
      setOptimisticReplyResetAt(initialDailyUsage.resets_at);
      setContent("");
      router.refresh();
    } catch (caughtError) {
      setError(`返信を送信できませんでした。${errorMessage(caughtError)}`);
      router.refresh();
    } finally {
      setIsSending(false);
    }
  }

  return (
    <main className="min-h-screen px-5 py-8 text-slate-100 sm:px-8 sm:py-12">
      <div className="ocean-glow pointer-events-none absolute inset-x-0 top-0 -z-10 h-[38rem]" />
      <div className="mx-auto w-full max-w-3xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Link
            className="flex items-center gap-3"
            href="/"
            aria-label="漂流瓶 ホーム"
          >
            <span className="brand-mark" aria-hidden="true">
              瓶
            </span>
            <span className="text-lg font-semibold tracking-[0.14em]">
              漂流瓶
            </span>
          </Link>
          <Link
            className="text-sm text-cyan-100/75 underline-offset-4 hover:underline"
            href="/history"
          >
            履歴へ戻る
          </Link>
        </header>

        <section className="mt-12">
          <p className="text-xs tracking-[0.18em] text-cyan-100/65">
            MESSAGE THREAD
          </p>
          <h1 className="mt-2 text-3xl font-medium tracking-wider text-white">
            手紙のやり取り
          </h1>
          <p className="mt-3 text-sm text-slate-300/65">
            返信は交互に最大3回まで送れます。
          </p>
          <p className="mt-2 text-xs text-cyan-100/70" role="status">
            本日の返信: 残り {remainingReplies}/{DAILY_MESSAGE_LIMIT} 回
            （JST 0時にリセット）
          </p>

          <ol className="mt-8 space-y-4">
            {entries.map((entry, index) => (
              <li
                key={entry.entry_id ?? entry.message_id}
                className={`glass-panel rounded-2xl p-5 sm:p-6 ${
                  entry.speaker === "you" ? "ml-5 sm:ml-16" : "mr-5 sm:mr-16"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs tracking-wide text-cyan-100/75">
                    {entry.speaker === "you" ? "あなた" : "相手"}
                    {index === 0 ? " · 最初のメッセージ" : ""}
                  </span>
                  <time className="text-[11px] text-slate-300/45" dateTime={entry.created_at}>
                    {new Intl.DateTimeFormat("ja-JP", {
                      timeZone: "Asia/Tokyo",
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(entry.created_at))}
                  </time>
                </div>
                <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-8 text-white/90">
                  {entry.content}
                </p>
              </li>
            ))}
          </ol>

          {replyCount >= 3 ? (
            <p
              className="mt-6 rounded-xl border border-slate-200/15 bg-slate-100/[0.04] px-5 py-4 text-center text-sm text-slate-200/70"
              role="status"
            >
              やり取り終了
            </p>
          ) : remainingReplies === 0 ? (
            <p
              className="mt-6 rounded-xl border border-cyan-100/15 bg-cyan-100/[0.04] px-5 py-4 text-center text-sm text-cyan-50/75"
              role="status"
            >
              本日の返信上限に達しました。JST 0時にリセットされます。
            </p>
          ) : !canReply ? (
            <p
              className="mt-6 rounded-xl border border-cyan-100/15 bg-cyan-100/[0.04] px-5 py-4 text-center text-sm text-cyan-50/75"
              role="status"
            >
              相手の返信を待っています。
            </p>
          ) : (
            <form
              className="glass-panel mt-6 rounded-2xl p-5 sm:p-6"
              onSubmit={handleSubmit}
            >
              <label className="sr-only" htmlFor="reply">
                返信メッセージ
              </label>
              <textarea
                id="reply"
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder="相手への返信を書いてください..."
                rows={4}
                required
                disabled={isSending}
                className="w-full resize-y rounded-xl border border-white/10 bg-slate-950/35 p-4 text-sm leading-7 text-white outline-none transition placeholder:text-slate-400/45 focus:border-cyan-200/45 focus:ring-2 focus:ring-cyan-200/10 disabled:opacity-50"
              />
              <div className="mt-2 flex justify-end text-[11px] text-slate-300/55">
                <span aria-live="polite">
                  {contentLength} / {MAX_MESSAGE_LENGTH}字
                </span>
              </div>
              {contentValidationError && (
                <p className="mt-2 text-xs text-rose-100/85" role="status">
                  {contentValidationError}
                </p>
              )}
              {error && (
                <p
                  className="mt-4 rounded-xl border border-rose-200/20 bg-rose-100/[0.06] px-4 py-3 text-xs leading-6 text-rose-100/90"
                  role="alert"
                >
                  {error}
                </p>
              )}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-slate-300/55">
                  返信 {replyCount}/3
                </span>
                <button
                  type="submit"
                  disabled={
                    isSending ||
                    Boolean(contentValidationError) ||
                    !canReply ||
                    remainingReplies === 0
                  }
                  className="send-button rounded-xl px-5 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {isSending ? "返信を送信中..." : "返信する"}
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
