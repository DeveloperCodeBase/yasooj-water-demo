import * as React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { MessageSquare, Send, Trash2, X } from "lucide-react";
import { useAuth } from "../app/auth";
import { cn } from "../lib/cn";
import { Button, Card, Input } from "./ui";

type ChatMsg = { role: "user" | "assistant"; content: string };

export function ChatAssistant() {
  const isRtl = true;
  const auth = useAuth();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [input, setInput] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const bottomRef = React.useRef<HTMLDivElement | null>(null);
  const [msgs, setMsgs] = React.useState<ChatMsg[]>(() => {
    try {
      const raw = localStorage.getItem("assistant_msgs");
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.slice(-16);
    } catch {
      return [];
    }
  });

  React.useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 60);
    return () => window.clearTimeout(t);
  }, [open]);

  React.useEffect(() => {
    try {
      localStorage.setItem("assistant_msgs", JSON.stringify(msgs.slice(-30)));
    } catch {
      // ignore
    }
  }, [msgs]);

  React.useEffect(() => {
    if (!open) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [open, msgs.length, busy]);

  const sendText = async (raw: string) => {
    const text = raw.trim();
    if (!text || busy) return;
    setInput("");
    const history = msgs.slice(-12);
    const next = [...msgs, { role: "user", content: text } as ChatMsg].slice(-20);
    setMsgs(next);
    setBusy(true);
    try {
      const res = await auth.api<{ reply: string }>("/assistant/chat", {
        method: "POST",
        body: JSON.stringify({ message: text, history }),
      });
      setMsgs((m) => [...m, { role: "assistant", content: String(res.reply) } as ChatMsg].slice(-30));
    } catch (e: any) {
      setMsgs((m) =>
        [...m, { role: "assistant", content: "در پاسخ‌گویی خطایی رخ داد. لطفا دوباره تلاش کنید." } as ChatMsg].slice(-30)
      );
      toast.error("خطا در پاسخ‌گویی دستیار");
    } finally {
      setBusy(false);
    }
  };

  const send = async () => sendText(input);

  const quickPrompts = [
    "چطور یک پیش‌بینی جدید اجرا کنم؟",
    "چطور برای یک دشت هشدار بسازم؟",
    "چطور کیفیت داده یک چاه را بررسی کنم؟",
    "چطور گزارش مدیریتی تولید کنم؟",
  ];

  const clear = () => {
    setMsgs([]);
    try {
      localStorage.removeItem("assistant_msgs");
    } catch {
      // ignore
    }
  };

  const floating = (
    <div className={cn("fixed z-40 bottom-4", isRtl ? "right-4" : "left-4")}>
      <Button
        variant="primary"
        className="rounded-full px-4 py-3 shadow-soft-lg"
        onClick={() => setOpen(true)}
        title="دستیار پروژه"
      >
        <MessageSquare size={18} />
        <span>دستیار</span>
      </Button>
    </div>
  );

  const panel = (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <motion.div
            className={cn(
              "absolute bottom-0 md:bottom-4 md:top-auto w-full md:w-[440px]",
              isRtl ? "md:right-4" : "md:left-4"
            )}
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
          >
            <Card className="rounded-b-none md:rounded-2xl overflow-hidden">
              <div
                className={cn(
                  "px-4 py-3 border-b border-border",
                  "bg-[radial-gradient(900px_320px_at_10%_-10%,rgba(18,92,255,0.22),transparent_55%),radial-gradient(700px_320px_at_80%_0%,rgba(4,205,159,0.20),transparent_55%)]"
                )}
              >
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-xl border border-border bg-card/60 grid place-items-center overflow-hidden shrink-0">
                      <img src="/logo.svg" alt="لوگو" className="h-6 w-6 object-contain" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold truncate">دستیار پروژه</div>
                      <div className="text-[11px] text-muted truncate">فقط درباره همین سامانه پاسخ می‌دهد</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="rounded-xl border border-border bg-card/60 px-2.5 py-2.5 hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-60"
                      onClick={clear}
                      aria-label="پاک کردن گفتگو"
                      title="پاک کردن گفتگو"
                      disabled={!msgs.length || busy}
                    >
                      <Trash2 size={18} />
                    </button>
                    <button
                      className="rounded-xl border border-border bg-card/60 px-2.5 py-2.5 hover:bg-black/5 dark:hover:bg-white/5"
                      onClick={() => setOpen(false)}
                      aria-label="بستن"
                      title="بستن"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="h-[62vh] md:h-[520px] overflow-auto px-3 py-3 space-y-2">
                {msgs.length ? (
                  msgs.map((m, idx) => (
                    <div key={idx} className={cn("flex", m.role === "user" ? "justify-start" : "justify-end")}>
                      <div
                        className={cn(
                          "max-w-[92%] rounded-2xl border border-border px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap",
                          m.role === "user" ? "bg-primary text-white border-primary/40" : "bg-card/70 text-right"
                        )}
                      >
                        {m.content}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="mt-10 space-y-4">
                    <div className="text-[13px] text-muted text-center">سوال خود را درباره امکانات همین سامانه بپرسید.</div>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {quickPrompts.map((p) => (
                        <button
                          key={p}
                          className="rounded-full border border-border bg-card/60 px-3 py-1.5 text-[12px] hover:bg-black/5 dark:hover:bg-white/5 transition"
                          onClick={() => {
                            void sendText(p);
                          }}
                          type="button"
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {busy ? (
                  <div className="flex justify-end">
                    <div className="max-w-[92%] rounded-2xl border border-border bg-card/60 px-3 py-2 text-[12px] text-muted">
                      در حال پاسخ...
                    </div>
                  </div>
                ) : null}
                <div ref={bottomRef} />
              </div>

              <div className="border-t border-border p-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
                <div className={cn("flex items-center gap-2")}>
                  <Input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="پیام شما..."
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void send();
                      }
                    }}
                    disabled={busy}
                  />
                  <button
                    className={cn(
                      "shrink-0 rounded-xl border border-border px-3 py-2.5",
                      busy || !input.trim()
                        ? "opacity-60 cursor-not-allowed"
                        : "hover:bg-black/5 dark:hover:bg-white/5"
                    )}
                    onClick={() => void send()}
                    disabled={busy || !input.trim()}
                    aria-label="ارسال"
                    title="ارسال"
                  >
                    <Send size={18} />
                  </button>
                </div>
                <div className={cn("mt-2 text-[11px] text-muted text-right")}>نکته: پاسخ‌ها فقط درباره همین پروژه است.</div>
              </div>
            </Card>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );

  return (
    <>
      {floating}
      {createPortal(panel, document.body)}
    </>
  );
}
