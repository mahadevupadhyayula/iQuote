import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  if (process.env.ENABLE_DEMO_RESET !== "true") {
    return NextResponse.json(
      { error: "Demo reset is disabled." },
      { status: 404 },
    );
  }

  const { resetDemoData } = await import("@/lib/services/demo-reset-service");
  const counts = await resetDemoData();

  return NextResponse.json({ ok: true, counts });
}
