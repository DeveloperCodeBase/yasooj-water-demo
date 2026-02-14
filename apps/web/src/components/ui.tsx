import * as React from "react";
import { cn } from "../lib/cn";

export function Card({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        // min-w-0 prevents intrinsic-size overflow inside grid/flex items (important for mobile RTL layouts).
        "rounded-2xl border border-border bg-card/70 backdrop-blur min-w-0",
        "shadow-[0_12px_30px_rgba(0,0,0,0.06)]",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "px-4 py-3 border-b border-border flex items-start justify-between gap-3 flex-wrap min-w-0",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("text-[14px] font-semibold leading-tight", className)} {...props}>
      {children}
    </div>
  );
}

export function CardDescription({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("text-[12px] text-muted leading-snug", className)} {...props}>
      {children}
    </div>
  );
}

export function CardBody({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("px-4 py-4", className)} {...props}>
      {children}
    </div>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md";

export function Button({
  className,
  variant = "secondary",
  size = "md",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  const base = cn(
    "inline-flex items-center justify-center gap-2 rounded-xl border border-border",
    "transition active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed",
    "focus:outline-none focus:ring-2 focus:ring-primary/30",
    size === "sm" ? "px-3 py-2 text-[12px]" : "px-4 py-2.5 text-[13px]"
  );
  const styles =
    variant === "primary"
      ? "bg-primary text-white border-primary/40 shadow-soft-md hover:brightness-105"
      : variant === "danger"
        ? "bg-danger text-white border-danger/40 shadow-soft-md hover:brightness-105"
        : variant === "ghost"
          ? "bg-transparent hover:bg-black/5 dark:hover:bg-white/5"
          : "bg-card/60 hover:bg-black/5 dark:hover:bg-white/5";

  return <button className={cn(base, styles, className)} {...props} />;
}

export function IconButton({
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-xl border border-border bg-card/60 px-2.5 py-2.5",
        "hover:bg-black/5 dark:hover:bg-white/5 transition",
        "focus:outline-none focus:ring-2 focus:ring-primary/30",
        className
      )}
      {...props}
    />
  );
}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref
) {
  return (
    <input
      ref={ref}
      className={cn(
        "w-full rounded-xl border border-border bg-card/60 px-3 py-2.5 text-[13px] text-right",
        "placeholder:text-muted/70",
        "focus:outline-none focus:ring-2 focus:ring-primary/30",
        className
      )}
      {...props}
    />
  );
});
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...props },
  ref
) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "w-full rounded-xl border border-border bg-card/60 px-3 py-2.5 text-[13px] text-right",
        "placeholder:text-muted/70",
        "focus:outline-none focus:ring-2 focus:ring-primary/30",
        className
      )}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...props },
  ref
) {
  return (
    <select
      ref={ref}
      className={cn(
        "w-full rounded-xl border border-border bg-card/60 px-3 py-2.5 text-[13px] text-right",
        "focus:outline-none focus:ring-2 focus:ring-primary/30",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
});
Select.displayName = "Select";

export function Label({ className, children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={cn("text-[12px] text-muted", className)} {...props}>
      {children}
    </label>
  );
}

export function Badge({
  className,
  tone = "neutral",
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: "neutral" | "info" | "warning" | "danger" | "success" }) {
  const toneCls =
    tone === "danger"
      ? "bg-danger/10 text-danger border-danger/20"
      : tone === "warning"
        ? "bg-warn/10 text-warn border-warn/20"
        : tone === "success"
          ? "bg-ok/10 text-ok border-ok/20"
          : tone === "info"
            ? "bg-primary/10 text-primary border-primary/20"
            : "bg-black/5 dark:bg-white/5 text-muted border-border";
  return (
    <span
      className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] leading-none", toneCls, className)}
      {...props}
    >
      {children}
    </span>
  );
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-border", className)} />;
}
