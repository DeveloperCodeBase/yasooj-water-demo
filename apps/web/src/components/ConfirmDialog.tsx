import * as React from "react";
import { Modal } from "./Modal";
import { Button } from "./ui";
import { useTranslation } from "react-i18next";
import { cn } from "../lib/cn";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmText,
  cancelText,
  confirmTone = "danger",
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  confirmTone?: "primary" | "danger";
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = React.useState(false);

  return (
    <Modal
      open={open}
      title={title}
      onClose={() => {
        if (!busy) onClose();
      }}
      footer={
        <div className={cn("flex items-center gap-2 justify-start flex-wrap")}>
          <Button
            variant={confirmTone === "danger" ? "danger" : "primary"}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
                onClose();
              } finally {
                setBusy(false);
              }
            }}
          >
            {confirmText ?? (confirmTone === "danger" ? "تایید" : t("common.save"))}
          </Button>
          <Button disabled={busy} onClick={onClose}>
            {cancelText ?? t("common.cancel")}
          </Button>
        </div>
      }
    >
      <div className="text-[13px] text-muted">{description ?? "آیا مطمئن هستید؟"}</div>
    </Modal>
  );
}
