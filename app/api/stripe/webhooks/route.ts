import { constructWebhookEvent } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import type Stripe from "stripe";

/**
 * POST /api/stripe/webhooks
 *
 * Register this URL in the Stripe dashboard → Webhooks → add endpoint →
 * /api/stripe/webhooks, subscribed to `checkout.session.completed`,
 * `checkout.session.async_payment_succeeded`, and
 * `checkout.session.async_payment_failed`.
 *
 * Async events matter for PayNow/GrabPay: those sessions can emit
 * `completed` with payment_status "unpaid" and only confirm (or fail)
 * moments later via the async_payment_* events.
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
    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      const session = event.data.object as Stripe.Checkout.Session;
      const paymentId = session.metadata?.paymentId;

      // For async methods (PayNow, GrabPay) `completed` arrives while the
      // payment is still "unpaid" — leave the row pending and let the
      // async_payment_succeeded event flip it.
      if (paymentId && session.payment_status === "paid") {
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
    } else if (event.type === "checkout.session.async_payment_failed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const paymentId = session.metadata?.paymentId;
      if (paymentId) {
        await supabase
          .from("payments")
          .update({ status: "failed" })
          .eq("id", paymentId);
      }
    }
  } catch (err) {
    console.error(`[stripe/webhooks] error handling ${event.type}:`, err);
    // Still 200 — Stripe retries on non-2xx, not useful for our own bugs.
  }

  return NextResponse.json({ received: true });
}
