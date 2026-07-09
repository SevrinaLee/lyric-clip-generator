import { constructWebhookEvent } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import type Stripe from "stripe";

/**
 * POST /api/stripe/webhooks
 *
 * Register this URL in the Stripe dashboard → Webhooks → add endpoint →
 * /api/stripe/webhooks, subscribed to `checkout.session.completed`.
 *
 * docs/SECURITY.md: validate the stripe-signature header before any DB
 * write, and never return a non-2xx for handler errors (Stripe retries
 * those) — only for genuine signature failures.
 *
 * Uses the service-role client: a webhook request carries no user session
 * (it's server-to-server, authenticated by the Stripe signature instead),
 * so it can never satisfy RLS's `auth.uid() = user_id` checks — the
 * cookie-based client used everywhere else would silently write zero rows
 * here.
 */
export async function POST(request: Request) {
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = constructWebhookEvent(payload, signature);
  } catch (err) {
    console.error("[stripe/webhooks] signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = createAdminClient();

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const paymentId = session.metadata?.paymentId;

      if (paymentId) {
        const { data: payment } = await supabase
          .from("payments")
          .update({
            status: "paid",
            stripe_payment_intent:
              typeof session.payment_intent === "string"
                ? session.payment_intent
                : (session.payment_intent?.id ?? null),
          })
          .eq("id", paymentId)
          .select("user_id")
          .maybeSingle<{ user_id: string | null }>();

        const customerId =
          typeof session.customer === "string"
            ? session.customer
            : session.customer?.id;

        if (payment?.user_id && customerId) {
          await supabase.from("profiles").upsert({
            id: payment.user_id,
            stripe_customer_id: customerId,
            updated_at: new Date().toISOString(),
          });
        }
      }
    }
  } catch (err) {
    console.error(`[stripe/webhooks] error handling ${event.type}:`, err);
    // Still 200 — Stripe retries on non-2xx, not useful for our own bugs.
  }

  return NextResponse.json({ received: true });
}
