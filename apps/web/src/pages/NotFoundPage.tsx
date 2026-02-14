import * as React from "react";
import { Link } from "react-router-dom";
import { Page } from "../components/Page";
import { Card, CardBody } from "../components/ui";

export function NotFoundPage() {
  return (
    <Page
      title="یافت نشد"
      crumbs={[
        { label: "داشبورد", to: "/dashboard" },
        { label: "یافت نشد" },
      ]}
      hideFilters
    >
      <Card>
        <CardBody className="py-10 text-center">
          <div className="text-[15px] font-semibold">این صفحه وجود ندارد.</div>
          <div className="mt-4">
            <Link
              to="/dashboard"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card/60 px-4 py-2.5 text-[13px] hover:bg-black/5 dark:hover:bg-white/5 transition"
            >
              رفتن به داشبورد
            </Link>
          </div>
        </CardBody>
      </Card>
    </Page>
  );
}
