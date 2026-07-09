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

const SINGLE_SONG_CENTS = 499;
const SUBSCRIPTION_MONTHLY_CENTS = 1499;

export async function createSongCheckoutSession({
  songTitle,
  paymentId,
  songId,
  plan,
  successUrl,
  cancelUrl,
}: {
  songTitle: string;
  paymentId: string;
  songId: string;
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
          currency: "usd",
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
            metadata: { paymentId, songId },
            ...(PLATFORM_FEE_PERCENT > 0
              ? { application_fee_percent: PLATFORM_FEE_PERCENT }
              : {}),
          },
        }
      : {}),
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
