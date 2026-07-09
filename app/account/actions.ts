"use server";

import { createClient } from "@/lib/supabase/server";

export async function updatePassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  if (password.length < 6) {
    throw new Error("Password must be at least 6 characters");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw new Error(error.message);
}
