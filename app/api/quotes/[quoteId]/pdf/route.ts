import { NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/db/server";
import { createRepositories } from "@/lib/repositories";
import { createQuoteGenerationService } from "@/lib/services/quote-generation-service";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ quoteId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { quoteId } = await context.params;
  const repositories = createRepositories(createServerSupabaseClient());
  const service = createQuoteGenerationService(repositories);
  const result = await service.renderCustomerQuotePdf(quoteId);

  if (!result.ok) {
    return NextResponse.json({ error: result.code, message: result.message }, { status: result.status });
  }

  return new NextResponse(new Uint8Array(result.buffer), {
    headers: {
      "Content-Type": result.contentType,
      "Content-Disposition": `inline; filename="${result.fileName.replace(/[^a-zA-Z0-9._-]/g, "-")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
