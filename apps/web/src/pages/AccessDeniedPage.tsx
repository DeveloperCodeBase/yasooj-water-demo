import * as React from "react";
import { Page } from "../components/Page";
import { Card, CardBody } from "../components/ui";
import { Link } from "react-router-dom";

export function AccessDeniedPage() {
  return (
    <Page
      title="دسترسی غیرمجاز"
      crumbs={[
        { label: "داشبورد", to: "/dashboard" },
        { label: "دسترسی غیرمجاز" },
      ]}
      hideFilters
    >
      <Card>
        <CardBody className="py-10 text-center">
          <div className="text-[15px] font-semibold">شما به این بخش دسترسی ندارید.</div>
          <div className="mt-2 text-[12px] text-muted">
            در صورت نیاز با مدیر سازمان تماس بگیرید.
          </div>
          <div className="mt-5 flex justify-center">
            <Link
              to="/dashboard"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card/60 px-4 py-2.5 text-[13px] hover:bg-black/5 dark:hover:bg-white/5 transition"
            >
              بازگشت به داشبورد
            </Link>
          </div>
        </CardBody>
      </Card>
    </Page>
  );
}
