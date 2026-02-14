import { nanoid } from "nanoid";
import type { Db } from "./db.js";
import type { Job } from "./types.js";
import { isoNow } from "./utils.js";

export async function createJob(db: Db, opts: { orgId: string; type: Job["type"]; steps: string[]; result?: Job["result"] }) {
  const job: Job = {
    id: `job_${nanoid(10)}`,
    orgId: opts.orgId,
    type: opts.type,
    status: "queued",
    progress: 0,
    steps: opts.steps.map((name, idx) => ({ name, status: idx === 0 ? "queued" : "queued" })),
    logs: ["queued"],
    createdAt: isoNow(),
    result: opts.result,
  };
  await db.mutate((d) => {
    d.jobs.unshift(job);
  });
  return job;
}

export function simulateJob(
  db: Db,
  jobId: string,
  opts: {
    stepDurationMs?: number;
    onSuccess?: (job: Job) => Promise<void> | void;
    onFail?: (job: Job, message: string) => Promise<void> | void;
  },
) {
  const stepDurationMs = opts.stepDurationMs ?? 850;
  const startedAt = isoNow();

  let timer: NodeJS.Timeout | undefined;

  const tick = async () => {
    const job = db.data.jobs.find((j) => j.id === jobId);
    if (!job) {
      if (timer) clearInterval(timer);
      return;
    }

    if (job.status === "queued") {
      job.status = "running";
      job.startedAt = startedAt;
      job.logs.push("started");
      job.steps[0].status = "running";
      job.progress = 5;
      void db.persist();
      return;
    }

    if (job.status !== "running") {
      if (timer) clearInterval(timer);
      return;
    }

    const idx = job.steps.findIndex((s) => s.status === "running");
    if (idx === -1) {
      // No running step (shouldn't happen). Mark done.
      job.status = "success";
      job.progress = 100;
      job.finishedAt = isoNow();
      job.logs.push("completed");
      void db.persist();
      if (timer) clearInterval(timer);
      await opts.onSuccess?.(job);
      return;
    }

    // Finish current step, start next
    job.steps[idx].status = "success";
    const next = idx + 1;
    if (next < job.steps.length) {
      job.steps[next].status = "running";
      job.logs.push(`step:${job.steps[next].name}`);
      job.progress = Math.round(((next + 0.1) / job.steps.length) * 100);
      void db.persist();
      return;
    }

    job.status = "success";
    job.progress = 100;
    job.finishedAt = isoNow();
    job.logs.push("completed");
    void db.persist();
    if (timer) clearInterval(timer);
    await opts.onSuccess?.(job);
  };

  timer = setInterval(() => {
    void tick().catch(async (e) => {
      const job = db.data.jobs.find((j) => j.id === jobId);
      if (job) {
        job.status = "failed";
        job.errorMessage = e instanceof Error ? e.message : "unknown error";
        job.finishedAt = isoNow();
        job.logs.push("failed");
        void db.persist();
        await opts.onFail?.(job, job.errorMessage);
      }
      if (timer) clearInterval(timer);
    });
  }, stepDurationMs);

  // Kick off immediately.
  void tick();
}
