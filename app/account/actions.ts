"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
