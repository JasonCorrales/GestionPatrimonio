import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "./client";

export type AuthStateListener = (
  event: AuthChangeEvent,
  session: Session | null,
) => void;

export async function getCurrentSession() {
  const { data, error } = await getSupabaseBrowserClient().auth.getSession();

  if (error) {
    throw error;
  }

  return data.session;
}

export async function signInWithEmailPassword(email: string, password: string) {
  const { data, error } = await getSupabaseBrowserClient().auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw error;
  }

  return data.session;
}

export async function signOut() {
  const { error } = await getSupabaseBrowserClient().auth.signOut();

  if (error) {
    throw error;
  }
}

export function onAuthStateChange(listener: AuthStateListener) {
  return getSupabaseBrowserClient().auth.onAuthStateChange(listener).data.subscription;
}
