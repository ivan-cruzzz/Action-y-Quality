import { hasSupabaseConfig, supabaseBackend } from "./supabase";
import { localBackend } from "./local";
import type { Backend } from "./types";

/**
 * One backend interface, two implementations:
 * - supabase: real Postgres + Auth when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are set;
 * - local: localStorage demo backend so the app runs (and builds) with zero configuration.
 * Roles by email work identically in both modes.
 */
export const backend: Backend = hasSupabaseConfig() ? supabaseBackend : localBackend;

export * from "./types";
