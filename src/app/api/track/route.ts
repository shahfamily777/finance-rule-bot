import fs from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// NOTE: This sink appends to a local file (data/clicks.jsonl at the repo root).
// On serverless platforms (e.g. Vercel) the filesystem is ephemeral, so written
// data does NOT persist across invocations/deploys. This is intended for local
// or self-hosted analysis. For a real deployment, swap this sink for a database
// or a logging/analytics service.

type TrackPayload = {
  event?: unknown;
  target?: unknown;
  label?: unknown;
  ts?: unknown;
};

export async function POST(request: Request) {
  try {
    let body: TrackPayload;
    try {
      body = (await request.json()) as TrackPayload;
    } catch {
      return Response.json({ ok: false, error: "invalid_json" }, { status: 400 });
    }

    const target =
      typeof body.target === "string" ? body.target.trim() : "";
    if (!target) {
      return Response.json(
        { ok: false, error: "missing_target" },
        { status: 400 }
      );
    }

    const event =
      typeof body.event === "string" && body.event.trim().length > 0
        ? body.event.trim()
        : "click";
    const label =
      typeof body.label === "string" && body.label.trim().length > 0
        ? body.label.trim()
        : undefined;
    const clientTs =
      typeof body.ts === "number" && Number.isFinite(body.ts)
        ? body.ts
        : undefined;

    // Coarse, anonymous context only. NO IP or anything requiring consent.
    const userAgent = request.headers.get("user-agent") ?? undefined;
    const referer = request.headers.get("referer") ?? undefined;

    const record = {
      ts: new Date().toISOString(),
      event,
      target,
      ...(label ? { label } : {}),
      ...(clientTs ? { clientTs } : {}),
      ...(userAgent ? { userAgent } : {}),
      ...(referer ? { referer } : {}),
    };

    const dir = path.join(process.cwd(), "data");
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.appendFile(
      path.join(dir, "clicks.jsonl"),
      JSON.stringify(record) + "\n",
      "utf8"
    );

    return Response.json({ ok: true });
  } catch (err) {
    // Never throw to the client; log server-side and return ok-ish quickly.
    console.error("[/api/track] failed to record event", err);
    return Response.json({ ok: false }, { status: 200 });
  }
}
