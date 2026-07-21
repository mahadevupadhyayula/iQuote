import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  if (process.env.ENABLE_DEMO_ACTIVITY_RESET !== "true") {
    return NextResponse.json(
      { error: "Demo activity reset is disabled." },
      { status: 404 },
    );
  }

  try {
    const { clearDemoQuoteActivity } = await import("@/lib/services/demo-reset-service");
    const counts = await clearDemoQuoteActivity();

    return NextResponse.json({ ok: true, counts });
  } catch (error) {
    console.error("[demo-clear-activity] failed", error);

    return NextResponse.json(
      { error: "Unable to reset demo activity. Please try again." },
      { status: 500 },
    );
  }
}
