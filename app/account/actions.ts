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

  // Upsert only touches the provided columns on conflict, so a row the
  // Stripe webhook already created keeps its stripe_customer_id.
  const { error } = await supabase.from("profiles").upsert({
    id: user.id,
    display_name: displayName || null,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(`Could not save name: ${error.message}`);

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
