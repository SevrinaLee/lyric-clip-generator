import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  createDonationCheckoutSession,
  validateDonationCents,
} from "@/lib/stripe";

/**
 * POST /api/stripe/donate
 * Body: { amountCents: number }
 *
 * A tip jar. Deliberately decoupled from the access model — no songId, no
 * paymentId, no DB write: the donation never touches `payments`/`subscriptions`
 * and so can never unlock a song or grant Creator (see lib/stripe donation
 * helpers). The amount is validated SERVER-SIDE; the client value is clamped to
 * a sane range and rejected outright if it isn't a finite integer in-range.
 *
 * Auth is optional — anyone can tip. If a session exists we tag the Stripe
 * metadata with the userId for our own gratitude/analytics, nothing more.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      amountCents?: unknown;
    };

    const amountCents = validateDonationCents(body.amountCents);
    if (amountCents === null) {
      return NextResponse.json(
        { error: "Please choose an amount between S$1 and S$500." },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const origin =
      request.headers.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "";

    const session = await createDonationCheckoutSession({
      amountCents,
      userId: user?.id,
      successUrl: `${origin}/support?donated=1`,
      cancelUrl: `${origin}/support?canceled=1`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[stripe/donate] error:", err);
    return NextResponse.json(
      { error: "Could not start the donation. Please try again." },
      { status: 500 },
    );
  }
}
