import Stripe from "stripe";

/**
 * Stripe client.
 *
 * Works in two modes — controlled entirely by env vars, no code changes needed:
 *
 * STANDALONE (your own Stripe account):
 *   STRIPE_SECRET_KEY = sk_live_xxx   (your secret key)
 *   STRIPE_CONNECT_ACCOUNT_ID not set
 *   STRIPE_PLATFORM_FEE_PERCENT not set
 *
 * PLATFORM (provisioned through Vibe Launchpad — platform takes a cut):
 *   STRIPE_SECRET_KEY = sk_live_xxx   (platform's key OR your connected account key)
 *   STRIPE_CONNECT_ACCOUNT_ID = acct_xxx   (your connected Stripe account)
 *   STRIPE_PLATFORM_FEE_PERCENT = 1   (platform takes 1% of every transaction)
 */
// Fall back to a placeholder so `new Stripe()` doesn't throw at build time
// when STRIPE_SECRET_KEY isn't configured. Real Stripe calls still require a
// valid key at runtime — this only keeps `next build` from crashing while
// collecting page data for projects that don't use Stripe.
export const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY ?? "sk_test_placeholder_build_only",
  {
    apiVersion: "2025-02-24.acacia",
    typescript: true,
  },
);

// Set when this app was provisioned through a Connect platform
export const CONNECT_ACCOUNT_ID = process.env.STRIPE_CONNECT_ACCOUNT_ID as
  | string
  | undefined;

// Platform fee percentage (0–100). Only active when CONNECT_ACCOUNT_ID is set.
export const PLATFORM_FEE_PERCENT = CONNECT_ACCOUNT_ID
  ? Number(process.env.STRIPE_PLATFORM_FEE_PERCENT ?? "0")
  : 0;

// Pass this to Stripe API calls when running through a Connect platform
export const stripeAccountOptions = (): Stripe.RequestOptions | undefined =>
  CONNECT_ACCOUNT_ID ? { stripeAccount: CONNECT_ACCOUNT_ID } : undefined;

// ─── Checkout ─────────────────────────────────────────────────────────────────
//
// Uses inline `price_data` instead of pre-created Stripe Price objects — the
// app is pre-auth (v1, no user accounts yet) and there's no dashboard step
// to create Products/Prices ahead of time, so amounts are defined here.
//
// Payment methods are dashboard-controlled: we deliberately do NOT pass
// payment_method_types, so Checkout automatically offers every method
// enabled in the Stripe dashboard that's compatible with the session —
// cards, PayNow QR, GrabPay, Alipay, … Currency is SGD because PayNow
// and GrabPay only work for SGD charges on a Singapore Stripe account.
// Subscription sessions automatically narrow to recurring-capable
// methods (cards), so no special-casing is needed here.

const CURRENCY = "sgd";
const SINGLE_SONG_CENTS = 499; // S$4.99
const SUBSCRIPTION_MONTHLY_CENTS = 1499; // S$14.99

export async function createSongCheckoutSession({
  songTitle,
  paymentId,
  songId,
  userId,
  plan,
  successUrl,
  cancelUrl,
}: {
  songTitle: string;
  paymentId: string;
  songId: string;
  userId: string;
  plan: "single" | "subscription";
  successUrl: string;
  cancelUrl: string;
}) {
  const mode = plan === "subscription" ? "subscription" : "payment";
  const unitAmount =
    plan === "subscription" ? SUBSCRIPTION_MONTHLY_CENTS : SINGLE_SONG_CENTS;

  const params: Stripe.Checkout.SessionCreateParams = {
    mode,
    line_items: [
      {
        price_data: {
          currency: CURRENCY,
          product_data: { name: `${songTitle} — export unlock` },
          unit_amount: unitAmount,
          ...(mode === "subscription"
            ? { recurring: { interval: "month" as const } }
            : {}),
        },
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    customer_creation: mode === "payment" ? "always" : undefined,
    metadata: { paymentId, songId },
    ...(mode === "subscription"
      ? {
          subscription_data: {
            // userId lets the subscription.* webhook map events to a user
            // without depending on the customer→profile lookup existing yet.
            metadata: { paymentId, songId, userId },
            ...(PLATFORM_FEE_PERCENT > 0
              ? { application_fee_percent: PLATFORM_FEE_PERCENT }
              : {}),
          },
        }
      : {}),
  };

  return stripe.checkout.sessions.create(params, stripeAccountOptions());
}

// ─── Donations (tip jar) ────────────────────────────────────────────────────
//
// A one-off "support the app" payment that is deliberately DECOUPLED from the
// access model: it carries no `paymentId`/`songId`, so the webhook's payment
// path never runs and it can never flip a song to paid or grant Creator. The
// only record of truth is Stripe itself (metadata `donation:"1"`). Amounts are
// validated server-side to a sane range; the client value is never trusted.

export const DONATION_MIN_CENTS = 100; // S$1
export const DONATION_MAX_CENTS = 50000; // S$500
export const DONATION_PRESETS_CENTS = [300, 500, 1000] as const; // S$3 / 5 / 10

/**
 * Clamp/validate a client-supplied donation amount. Returns integer cents, or
 * null if the input is not a finite integer within [MIN, MAX]. Rejecting
 * (rather than silently clamping) means a tampered/injected value fails loudly.
 */
export function validateDonationCents(input: unknown): number | null {
  if (typeof input !== "number" || !Number.isFinite(input)) return null;
  if (!Number.isInteger(input)) return null;
  if (input < DONATION_MIN_CENTS || input > DONATION_MAX_CENTS) return null;
  return input;
}

export async function createDonationCheckoutSession({
  amountCents,
  userId,
  successUrl,
  cancelUrl,
}: {
  amountCents: number;
  userId?: string;
  successUrl: string;
  cancelUrl: string;
}) {
  const params: Stripe.Checkout.SessionCreateParams = {
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: CURRENCY,
          product_data: { name: "Support Lyric Clip Generator 💛" },
          unit_amount: amountCents,
        },
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    submit_type: "donate",
    // No paymentId/songId here — this must never satisfy evaluateSongAccess.
    metadata: { donation: "1", ...(userId ? { userId } : {}) },
  };

  return stripe.checkout.sessions.create(params, stripeAccountOptions());
}

// ─── Billing portal ───────────────────────────────────────────────────────────

export async function createPortalSession({
  customerId,
  returnUrl,
}: {
  customerId: string;
  returnUrl: string;
}) {
  return stripe.billingPortal.sessions.create(
    { customer: customerId, return_url: returnUrl },
    stripeAccountOptions(),
  );
}

// ─── Webhook ──────────────────────────────────────────────────────────────────

export function constructWebhookEvent(payload: string, signature: string) {
  return stripe.webhooks.constructEvent(
    payload,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET!,
  );
}
