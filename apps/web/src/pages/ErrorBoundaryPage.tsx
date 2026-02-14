import * as React from "react";
import { Button, Card, CardBody } from "../components/ui";

function toMessage(err: unknown) {
  if (!err) return "خطای نامشخص";
  if (err instanceof Error) return err.stack || err.message;
  try {
    return JSON.stringify(err, null, 2);
  } catch {
    return String(err);
  }
}

export function ErrorBoundaryPage({ error, onReset }: { error: unknown; onReset?: () => void }) {
  const msg = React.useMemo(() => toMessage(error), [error]);

  return (
    <div className="min-h-full grid place-items-center px-4 py-10 font-fa">
      <Card className="w-full max-w-[820px]">
        <CardBody>
          <div className="text-[18px] font-semibold">خطای غیرمنتظره</div>
          <div className="mt-2 text-[13px] text-muted">در رابط کاربری خطایی رخ داد. می‌توانید صفحه را رفرش کنید.</div>

          <div className="mt-4 rounded-2xl border border-border bg-card/60 p-3">
            <pre className="text-[12px] leading-relaxed whitespace-pre-wrap font-mono overflow-auto max-h-[40vh]">{msg}</pre>
          </div>

          <div className="mt-4 flex items-center gap-2 justify-start flex-wrap">
            <Button variant="primary" onClick={() => window.location.reload()}>
              رفرش صفحه
            </Button>
            <Button onClick={() => onReset?.()}>تلاش مجدد</Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
