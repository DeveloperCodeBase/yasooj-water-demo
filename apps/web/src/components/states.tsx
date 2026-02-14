import * as React from "react";
import { cn } from "../lib/cn";
import { Card, CardBody } from "./ui";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-black/5 dark:bg-white/5", className)} />;
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <Card>
      <CardBody className="py-10 text-center">
        <div className="text-[14px] font-semibold">{title}</div>
        {description ? <div className="mt-2 text-[12px] text-muted">{description}</div> : null}
        {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
      </CardBody>
    </Card>
  );
}

