import { constructWebhookEvent } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import type Stripe from "stripe";

/**
 * POST /api/stripe/webhooks
 *
 * Register this URL in the Stripe dashboard → Webhooks → add endpoint →
 * /api/stripe/webhooks, subscribed to `checkout.session.completed`,
 * `checkout.session.async_payment_succeeded`,
 * `checkout.session.async_payment_failed`, and — for the Creator plan —
 * `customer.subscription.created`, `customer.subscription.updated`, and
 * `customer.subscription.deleted`.
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

      // Donations (tip jar, v1.7) carry `donation:"1"` and NO paymentId, so the
      // payment path below is skipped entirely — a tip can never flip a song to
      // paid or grant Creator. Just acknowledge it for observability.
      if (session.metadata?.donation === "1") {
        console.log(
          `[stripe/webhooks] donation received: ${session.amount_total ?? "?"} ${session.currency ?? ""} (grants nothing)`,
        );
      }

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
    } else if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      // Creator subscription (v1.5): mirror the Stripe subscription into our
      // subscriptions table so evaluateSongAccess can unlock every song. userId
      // rides in the subscription metadata (set at checkout).
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.userId;
      const customerId =
        typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
      if (userId && customerId) {
        await supabase.from("subscriptions").upsert(
          {
            id: sub.id,
            user_id: userId,
            stripe_customer_id: customerId,
            // deleted → force a terminal status even if the object still reads
            // "active" in the event payload.
            status:
              event.type === "customer.subscription.deleted"
                ? "canceled"
                : sub.status,
            price_id: sub.items.data[0]?.price?.id ?? null,
            current_period_end: sub.current_period_end
              ? new Date(sub.current_period_end * 1000).toISOString()
              : null,
            cancel_at_period_end: sub.cancel_at_period_end ?? false,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" },
        );
        // Make sure the portal can find this customer even if the subscription
        // event lands before checkout.session.completed.
        await supabase
          .from("profiles")
          .upsert({ id: userId, stripe_customer_id: customerId, updated_at: new Date().toISOString() });
      }
    }
  } catch (err) {
    console.error(`[stripe/webhooks] error handling ${event.type}:`, err);
    // Still 200 — Stripe retries on non-2xx, not useful for our own bugs.
  }

  return NextResponse.json({ received: true });
}
