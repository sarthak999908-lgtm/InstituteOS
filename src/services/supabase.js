import { createClient } from "@supabase/supabase-js";

const env = import.meta.env || {};
const url = env.VITE_SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_ANON_KEY;

export const supabaseEnabled = Boolean(url && anonKey);
export const supabaseClient = supabaseEnabled
  ? createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true } })
  : null;

export async function fetchSupabaseSeed(schema, role) {
  if (!supabaseClient) return null;
  const entries = Object.entries(schema);
  const views = {
    trainer: { students: "trainer_students" },
    counselor: { fee_summary: "counselor_fee_summary" },
    accounts: { students: "account_students" },
  };
  const responses = await Promise.all(entries.map(async ([table, columns]) => {
    const relation = views[role]?.[table] || table;
    const { data, error } = await supabaseClient.from(relation).select(columns.join(","));
    if (error) throw new Error(`Supabase read failed for ${relation}: ${error.message}`);
    return [table, data || []];
  }));
  return Object.fromEntries(responses);
}

export async function insertSupabaseRow(table, row) {
  if (!supabaseClient) return;
  const { error } = await supabaseClient.from(table).insert(row);
  if (error) throw new Error(`Supabase insert failed for ${table}: ${error.message}`);
}

export async function updateSupabaseApproval(approvalId, values) {
  if (!supabaseClient) return;
  const { error } = await supabaseClient.from("approvals").update(values).eq("id", approvalId);
  if (error) throw new Error(`Supabase approval update failed: ${error.message}`);
}