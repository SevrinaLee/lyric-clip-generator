import { createClient } from "@/lib/supabase/server";
import { createPortalSession } from "@/lib/stripe";
import { NextResponse } from "next/server";

/**
 * POST /api/stripe/portal
 *
 * Redirects the authenticated user to the Stripe Billing Portal, where
 * they can update payment methods, view invoices, and cancel/change plans
 * — Stripe's own hosted UI rather than reimplementing card management.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle<{ stripe_customer_id: string | null }>();

    if (!profile?.stripe_customer_id) {
      return NextResponse.json(
        { error: "No billing account yet — make a purchase first." },
        { status: 404 },
      );
    }

    const origin =
      request.headers.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "";

    const portalSession = await createPortalSession({
      customerId: profile.stripe_customer_id,
      returnUrl: `${origin}/account`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (err) {
    console.error("[stripe/portal]", err);
    const rawMessage = err instanceof Error ? err.message : "";
    const message = rawMessage.includes("Invalid API Key")
      ? "Payments aren't configured yet — add real Stripe keys to enable billing."
      : rawMessage || "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
