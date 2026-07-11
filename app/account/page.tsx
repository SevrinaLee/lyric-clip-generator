import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Payment, Song } from "@/lib/types";
import { PasswordForm } from "./PasswordForm";
import { DisplayNameForm } from "./DisplayNameForm";
import { BillingButton } from "./BillingButton";

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirect=/account");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle<{ display_name: string | null }>();

  const { data: payments } = await supabase
    .from("payments")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .returns<Payment[]>();

  const songIds = [...new Set((payments ?? []).map((p) => p.song_id))];
  const { data: songs } =
    songIds.length > 0
      ? await supabase
          .from("songs")
          .select("id, title")
          .in("id", songIds)
          .returns<Pick<Song, "id" | "title">[]>()
      : { data: [] };
  const songTitleById = new Map((songs ?? []).map((s) => [s.id, s.title]));

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-32 h-96 w-96 rounded-full bg-sky/30 blur-3xl"
      />

      <div className="relative max-w-2xl mx-auto px-5 sm:px-8 py-10 sm:py-14 space-y-8">
        <Link href="/" className="text-sm text-ink/50 hover:text-ink">
          ← Back
        </Link>

        <div>
          <h1 className="font-display text-4xl text-ink">
            {profile?.display_name
              ? `Hey, ${profile.display_name}`
              : "Account"}
          </h1>
          <p className="text-ink/50 mt-1">{user.email}</p>
        </div>

        <section className="rounded-3xl bg-cream-deep border border-ink/10 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <span className="h-1.5 w-1.5 rounded-full bg-lavender" />
            <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-ink/50">
              Profile
            </h2>
          </div>
          <DisplayNameForm initialName={profile?.display_name ?? ""} />
          <div className="border-t border-ink/10 pt-4">
            <PasswordForm />
          </div>
        </section>

        <section className="rounded-3xl bg-cream-deep border border-ink/10 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <span className="h-1.5 w-1.5 rounded-full bg-gold" />
            <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-ink/50">
              Billing
            </h2>
          </div>

          <BillingButton />

          {payments && payments.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {payments.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 rounded-xl bg-cream px-3 py-2"
                >
                  <span className="min-w-0 truncate text-ink/70">
                    {songTitleById.get(p.song_id) ?? "Song"} ·{" "}
                    {p.plan === "subscription" ? "Subscription" : "Single export"}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="text-ink/50">
                      S${(p.amount_cents / 100).toFixed(2)}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        p.status === "paid"
                          ? "bg-sage/30 text-ink"
                          : p.status === "failed"
                            ? "bg-mauve/15 text-mauve"
                            : "bg-tan/25 text-ink"
                      }`}
                    >
                      {p.status}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink/50">No purchases yet.</p>
          )}
        </section>
      </div>
    </main>
  );
}
