import { NextResponse } from "next/server";
import { loadShowcaseCards, SHOWCASE_PAGE_SIZE } from "@/lib/showcase";

// Load-more pagination for the public showcase. Everything returned is
// already-public (approved-only) data, so no auth — but we only ever expose the
// same fields the gallery shows, and the cursor is a plain created_at string.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const before = url.searchParams.get("before");
  // Reject anything that isn't a parseable timestamp so the cursor can't be
  // used to smuggle arbitrary input into the query.
  const cursor = before && !Number.isNaN(Date.parse(before)) ? before : null;

  const { cards, nextBefore } = await loadShowcaseCards({
    before: cursor,
    limit: SHOWCASE_PAGE_SIZE,
  });
  return NextResponse.json({ cards, nextBefore });
}
