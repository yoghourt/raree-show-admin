/**
 * SPEC-D2-003 — Runtime Source Registry loader (server-only)
 */

import type {
  SourceBinding,
  SourceBindingStatus,
  SourceProfile,
  SourceProfileKind,
  WorkSourceContext,
} from "@/lib/ai/evidence-types";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type SourceProfileRow = {
  profile_id: string;
  kind: string;
  display_name: string;
  work_pattern: string;
  wikipedia_search_context: string | null;
  tier2_enabled: boolean;
  created_at: string;
  updated_at: string;
};

type SourceBindingRow = {
  binding_id: string;
  profile_id: string;
  tier: number;
  connector_id: string;
  official_source_id: string;
  source_label: string;
  base_url: string;
  applicable_fields: string[];
  effective_from: string;
  status: string;
  created_at: string;
  updated_at: string;
};

function rowToProfile(row: SourceProfileRow): SourceProfile {
  return {
    profileId: row.profile_id,
    kind: row.kind as SourceProfileKind,
    displayName: row.display_name,
    workPattern: row.work_pattern,
    wikipediaSearchContext: row.wikipedia_search_context,
    tier2Enabled: row.tier2_enabled,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToBinding(row: SourceBindingRow): SourceBinding {
  return {
    bindingId: row.binding_id,
    profileId: row.profile_id,
    tier: 1,
    connectorId: row.connector_id,
    officialSourceId: row.official_source_id,
    sourceLabel: row.source_label,
    baseUrl: row.base_url,
    applicableFields: row.applicable_fields ?? [],
    effectiveFrom: row.effective_from,
    status: row.status as SourceBindingStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listSourceProfiles(): Promise<SourceProfile[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("source_profiles")
    .select("*")
    .order("display_name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return ((data as SourceProfileRow[] | null) ?? []).map(rowToProfile);
}

export async function loadWorkSourceContext(
  workId: string
): Promise<WorkSourceContext | null> {
  const supabase = await createSupabaseServerClient();

  const { data: workRow, error: workError } = await supabase
    .from("works")
    .select("source_profile_id")
    .eq("id", workId)
    .maybeSingle();

  if (workError) {
    throw new Error(workError.message);
  }

  const sourceProfileId = (workRow as { source_profile_id?: string | null } | null)
    ?.source_profile_id;

  if (!sourceProfileId) {
    return null;
  }

  const { data: profileRow, error: profileError } = await supabase
    .from("source_profiles")
    .select("*")
    .eq("profile_id", sourceProfileId)
    .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message);
  }

  if (!profileRow) {
    return null;
  }

  const { data: bindingRows, error: bindingError } = await supabase
    .from("source_bindings")
    .select("*")
    .eq("profile_id", sourceProfileId)
    .eq("status", "approved");

  if (bindingError) {
    throw new Error(bindingError.message);
  }

  return {
    sourceProfileId,
    profile: rowToProfile(profileRow as SourceProfileRow),
    tier1Bindings: ((bindingRows as SourceBindingRow[] | null) ?? []).map(
      rowToBinding
    ),
  };
}
