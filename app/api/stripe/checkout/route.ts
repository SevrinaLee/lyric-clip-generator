import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSongCheckoutSession } from "@/lib/stripe";
import type { Song } from "@/lib/types";

const AMOUNT_CENTS: Record<"single" | "subscription", number> = {
  single: 499,
  subscription: 1499,
};

/**
 * POST /api/stripe/checkout
 * Body: { songId: string, plan: "single" | "subscription" }
 *
 * Payment is tied to the song being exported (docs/TASKS.md Sprint 3) and,
 * since Sprint 5, to the signed-in account that owns it — reaching this
 * route already implies a session because queueExport (the only way an
 * export/song gets created) requires one. Creates a `payments` row up
 * front (status "pending") and a Stripe Checkout Session whose metadata
 * links back to it; the webhook flips it to "paid".
 */
export async function POST(request: Request) {
  try {
    const { songId, plan } = (await request.json()) as {
      songId?: string;
      plan?: "single" | "subscription";
    };

    if (!songId || (plan !== "single" && plan !== "subscription")) {
      return NextResponse.json(
        { error: "songId and a valid plan are required" },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: song } = await supabase
      .from("songs")
      .select("*")
      .eq("id", songId)
      .maybeSingle<Song>();

    if (!song) {
      return NextResponse.json({ error: "Song not found" }, { status: 404 });
    }

    const { data: payment, error: insertError } = await supabase
      .from("payments")
      .insert({
        song_id: songId,
        user_id: user.id,
        amount_cents: AMOUNT_CENTS[plan],
        status: "pending",
        plan,
      })
      .select("id")
      .single();

    if (insertError || !payment) {
      throw new Error(insertError?.message ?? "Could not create payment record");
    }

    const origin =
      request.headers.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "";

    const session = await createSongCheckoutSession({
      songTitle: song.title,
      paymentId: payment.id,
      songId,
      userId: user.id,
      plan,
      successUrl: `${origin}/songs/${songId}?checkout=success`,
      cancelUrl: `${origin}/songs/${songId}?checkout=canceled`,
    });

    await supabase
      .from("payments")
      .update({ stripe_session_id: session.id })
      .eq("id", payment.id);

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[stripe/checkout]", err);
    const rawMessage = err instanceof Error ? err.message : "";
    const message = rawMessage.includes("Invalid API Key")
      ? "Payments aren't configured yet — add real Stripe keys to enable checkout."
      : rawMessage || "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
