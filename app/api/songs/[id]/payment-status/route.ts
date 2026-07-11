import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { evaluateSongAccess } from "@/lib/access";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const access = await evaluateSongAccess(user?.id ?? null, id);

  // `paid` is kept for CheckoutStatusWatcher, which polls after a Stripe
  // redirect and only wants to know when the actual payment lands.
  return NextResponse.json({
    unlocked: access.unlocked,
    reason: access.reason,
    paid: access.reason === "paid",
  });
}
