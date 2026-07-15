"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isPaidAccount } from "@/lib/access";
import { sniffImage } from "@/lib/imageSniff";
import type { BrandKit } from "@/lib/types";

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export async function getBrandKit(): Promise<BrandKit | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("brand_kits")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle<BrandKit>();
  return data ?? null;
}

// Save the brand kit. Premium (paid account) — gated server-side. Validates the
// accent hex and, if a logo is supplied, sniffs its bytes (≤ 1MB, PNG/JPEG)
// before uploading to the private brand-logos bucket under <uid>/.
export async function updateBrandKit(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be logged in");

  if (!(await isPaidAccount(user.id))) {
    throw new Error("The brand kit is a Creator-plan feature.");
  }

  const displayName = String(formData.get("display_name") ?? "").trim().slice(0, 50) || null;
  const watermarkText = String(formData.get("watermark_text") ?? "").trim().slice(0, 40) || null;
  const accentRaw = String(formData.get("accent_hex") ?? "").trim();
  const accentHex = accentRaw ? accentRaw : null;
  if (accentHex && !HEX_RE.test(accentHex)) {
    throw new Error("Accent colour must be a #rrggbb hex value");
  }

  let logoPath: string | undefined;
  const logo = formData.get("logo");
  if (logo && typeof logo === "object" && "arrayBuffer" in logo && logo.size > 0) {
    if (logo.size > 1_000_000) throw new Error("Logo must be 1MB or smaller");
    const bytes = new Uint8Array(await logo.arrayBuffer());
    const kind = sniffImage(bytes);
    if (!kind) throw new Error("Logo must be a PNG or JPEG image");
    const path = `${user.id}/logo.${kind === "png" ? "png" : "jpg"}`;
    const { error: upErr } = await supabase.storage
      .from("brand-logos")
      .upload(path, bytes, {
        contentType: kind === "png" ? "image/png" : "image/jpeg",
        upsert: true,
      });
    if (upErr) throw new Error(`Could not upload logo: ${upErr.message}`);
    logoPath = path;
  }

  const patch: Record<string, unknown> = {
    user_id: user.id,
    display_name: displayName,
    watermark_text: watermarkText,
    accent_hex: accentHex,
    updated_at: new Date().toISOString(),
  };
  if (logoPath) patch.logo_path = logoPath;

  const { error } = await supabase
    .from("brand_kits")
    .upsert(patch, { onConflict: "user_id" });
  if (error) throw new Error(`Could not save brand kit: ${error.message}`);

  revalidatePath("/account");
}

export async function updateDisplayName(formData: FormData) {
  const displayName = String(formData.get("display_name") ?? "").trim();
  if (displayName.length > 50) {
    throw new Error("Name must be 50 characters or fewer");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be logged in");

  // Update-then-insert rather than upsert: the privileged columns is_founder
  // and free_song_id are locked (migration 0008) so the client role can only
  // write id/display_name/updated_at, and can't UPDATE id — which supabase-js
  // upsert would try to do in its ON CONFLICT SET. This also keeps a row the
  // Stripe webhook created (with stripe_customer_id) intact.
  const patch = {
    display_name: displayName || null,
    updated_at: new Date().toISOString(),
  };
  const { data: updated, error: updateError } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", user.id)
    .select("id");
  if (updateError) throw new Error(`Could not save name: ${updateError.message}`);

  if (!updated || updated.length === 0) {
    const { error: insertError } = await supabase
      .from("profiles")
      .insert({ id: user.id, ...patch });
    if (insertError) throw new Error(`Could not save name: ${insertError.message}`);
  }

  revalidatePath("/account");
}

export async function updatePassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  if (password.length < 6) {
    throw new Error("Password must be at least 6 characters");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw new Error(error.message);
}
