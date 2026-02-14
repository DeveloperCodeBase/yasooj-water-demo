import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "../lib/cn";
import { Card, CardBody, CardHeader, CardTitle, IconButton } from "./ui";
import { X } from "lucide-react";

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  className,
}: {
  open: boolean;
  title?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-0 p-4 grid place-items-center">
        <Card className={cn("w-full max-w-[720px] max-h-[85vh] overflow-hidden", className)}>
          {title ? (
            <CardHeader>
              <div className="min-w-0">
                <CardTitle className="truncate">{title}</CardTitle>
              </div>
              <IconButton aria-label="بستن" onClick={onClose}>
                <X size={18} />
              </IconButton>
            </CardHeader>
          ) : null}
          <div className="max-h-[70vh] overflow-auto">
            <CardBody>{children}</CardBody>
          </div>
          {footer ? <div className="px-4 py-3 border-t border-border">{footer}</div> : null}
        </Card>
      </div>
    </div>,
    document.body,
  );
}
