import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function NeedsInformationRedirect({ params }: { params: Promise<{ quoteId: string }> }) {
  const { quoteId } = await params;
  redirect(`/quotes/${quoteId}/review`);
}
