import type { SupabaseClient } from "@supabase/supabase-js";

export type MirrorChamber = "career" | "academic" | "creative" | "general";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Subcategory = {
  id: string;
  user_id: string;
  name: string;
  parent_chamber: MirrorChamber;
  aggregate_fingerprint: Json;
  confidence_level: number;
  document_count: number;
  total_word_count: number;
  last_trained_at: string | null;
  evolution_history: Json[];
  created_at: string;
  updated_at: string;
};

export type ContextMemoryEntry = {
  id: string;
  user_id: string;
  subcategory_id: string;
  entity_type: "person" | "company" | "place" | "role" | "other";
  entity_name: string;
  attributes: Json;
  created_at: string;
  updated_at: string;
};

export type SubcategoryWithContext = {
  subcategory: Subcategory;
  contextMemory: ContextMemoryEntry[];
};

export type InheritanceBlend = {
  parentWeight: number;
  subcategoryWeight: number;
  threshold: "developing" | "emerging" | "established";
};

const DEVELOPING_BLEND: InheritanceBlend = {
  parentWeight: 1.0,
  subcategoryWeight: 0.0,
  threshold: "developing",
};

const EMERGING_BLEND: InheritanceBlend = {
  parentWeight: 0.6,
  subcategoryWeight: 0.4,
  threshold: "emerging",
};

const ESTABLISHED_BLEND: InheritanceBlend = {
  parentWeight: 0.2,
  subcategoryWeight: 0.8,
  threshold: "established",
};

function isMirrorChamber(value: string): value is MirrorChamber {
  return value === "career" || value === "academic" || value === "creative" || value === "general";
}

function assertMirrorChamber(chamber: string): MirrorChamber {
  if (!isMirrorChamber(chamber)) {
    throw new Error("Invalid parent chamber");
  }
  return chamber;
}

function normalizeName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Subcategory name is required");
  }
  if (trimmed.length > 50) {
    throw new Error("Subcategory name must be 50 characters or fewer");
  }
  return trimmed;
}

export function getInheritanceBlend(documentCount: number): InheritanceBlend {
  if (documentCount < 3) {
    return DEVELOPING_BLEND;
  }
  if (documentCount < 10) {
    return EMERGING_BLEND;
  }
  return ESTABLISHED_BLEND;
}

export async function getSubcategories(
  userId: string,
  chamber: string,
  supabase: SupabaseClient
): Promise<Subcategory[]> {
  const parentChamber = assertMirrorChamber(chamber);
  const { data, error } = await supabase
    .from("mirror_subcategories")
    .select("*")
    .eq("user_id", userId)
    .eq("parent_chamber", parentChamber)
    .order("document_count", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data || []) as Subcategory[];
}

export async function getSubcategory(
  userId: string,
  subcategoryId: string,
  supabase: SupabaseClient
): Promise<Subcategory | null> {
  const { data, error } = await supabase
    .from("mirror_subcategories")
    .select("*")
    .eq("id", subcategoryId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as Subcategory | null) ?? null;
}

export async function createSubcategory(
  userId: string,
  name: string,
  parentChamber: string,
  supabase: SupabaseClient
): Promise<Subcategory> {
  const normalizedName = normalizeName(name);
  const chamber = assertMirrorChamber(parentChamber);

  const { data: existing, error: existingError } = await supabase
    .from("mirror_subcategories")
    .select("*")
    .eq("user_id", userId)
    .eq("parent_chamber", chamber)
    .eq("name", normalizedName)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existing) {
    return existing as Subcategory;
  }

  const { data, error } = await supabase
    .from("mirror_subcategories")
    .insert({
      user_id: userId,
      name: normalizedName,
      parent_chamber: chamber,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Failed to create subcategory");
  }

  return data as Subcategory;
}

export async function updateSubcategoryFingerprint(
  subcategoryId: string,
  newFingerprint: Json,
  documentCount: number,
  wordCount: number,
  supabase: SupabaseClient
): Promise<void> {
  const { data: existing, error: existingError } = await supabase
    .from("mirror_subcategories")
    .select("evolution_history")
    .eq("id", subcategoryId)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  const currentHistory = Array.isArray(existing?.evolution_history)
    ? (existing.evolution_history as Json[])
    : [];
  const nextHistory = [
    ...currentHistory,
    {
      updated_at: new Date().toISOString(),
      document_count: documentCount,
      total_word_count: wordCount,
    },
  ];

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("mirror_subcategories")
    .update({
      aggregate_fingerprint: newFingerprint,
      document_count: documentCount,
      total_word_count: wordCount,
      last_trained_at: now,
      updated_at: now,
      evolution_history: nextHistory,
    })
    .eq("id", subcategoryId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function getSubcategoryWithContextMemory(
  userId: string,
  subcategoryId: string,
  supabase: SupabaseClient
): Promise<SubcategoryWithContext> {
  const subcategory = await getSubcategory(userId, subcategoryId, supabase);
  if (!subcategory) {
    throw new Error("Subcategory not found");
  }

  const { data, error } = await supabase
    .from("mirror_context_memory")
    .select("*")
    .eq("user_id", userId)
    .eq("subcategory_id", subcategoryId)
    .order("entity_name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return {
    subcategory,
    contextMemory: (data || []) as ContextMemoryEntry[],
  };
}
