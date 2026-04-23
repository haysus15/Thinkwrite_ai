import { NextRequest, NextResponse } from "next/server.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createSubcategory,
  getSubcategories,
  getSubcategory,
  type Subcategory,
} from "@/lib/mirror-mode/subcategoryService";

type SubcategoryCreateBody = {
  name?: string;
  parent_chamber?: string;
};

type SubcategoryRenameBody = {
  name?: string;
};

export type SubcategoryDeps = {
  resolveUserId: (request: NextRequest) => Promise<string | null>;
  createSupabaseAdmin: () => SupabaseClient;
  createSubcategory?: typeof createSubcategory;
  getSubcategories?: typeof getSubcategories;
  getSubcategory?: typeof getSubcategory;
};

async function readJsonBody<T>(request: NextRequest): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

export async function handleGetSubcategories(
  request: NextRequest,
  deps: SubcategoryDeps
) {
  const userId = await deps.resolveUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const chamber = request.nextUrl.searchParams.get("chamber");
  if (!chamber) {
    return NextResponse.json({ error: "Chamber is required" }, { status: 400 });
  }

  try {
    const supabase = deps.createSupabaseAdmin();
    const loadSubcategories = deps.getSubcategories || getSubcategories;
    const subcategories = await loadSubcategories(userId, chamber, supabase);
    return NextResponse.json({ success: true, subcategories });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load subcategories";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function handlePostSubcategories(
  request: NextRequest,
  deps: SubcategoryDeps
) {
  const userId = await deps.resolveUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await readJsonBody<SubcategoryCreateBody>(request);
  if (!body?.name?.trim() || !body.parent_chamber) {
    return NextResponse.json({ error: "Invalid subcategory payload" }, { status: 400 });
  }

  try {
    const supabase = deps.createSupabaseAdmin();
    const create = deps.createSubcategory || createSubcategory;
    const subcategory = await create(userId, body.name, body.parent_chamber, supabase);
    return NextResponse.json({ success: true, subcategory });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create subcategory";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function handlePatchSubcategory(
  request: NextRequest,
  params: { id: string },
  deps: SubcategoryDeps
) {
  const userId = await deps.resolveUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await readJsonBody<SubcategoryRenameBody>(request);
  const name = body?.name?.trim() || "";
  if (!name) {
    return NextResponse.json({ error: "Subcategory name is required" }, { status: 400 });
  }
  if (name.length > 50) {
    return NextResponse.json(
      { error: "Subcategory name must be 50 characters or fewer" },
      { status: 400 }
    );
  }

  const supabase = deps.createSupabaseAdmin();
  const loadSubcategory = deps.getSubcategory || getSubcategory;

  try {
    const current = await loadSubcategory(userId, params.id, supabase);
    if (!current) {
      return NextResponse.json({ error: "Subcategory not found" }, { status: 404 });
    }

    const { data: duplicate, error: duplicateError } = await supabase
      .from("mirror_subcategories")
      .select("*")
      .eq("user_id", userId)
      .eq("parent_chamber", current.parent_chamber)
      .eq("name", name)
      .maybeSingle();

    if (duplicateError) {
      return NextResponse.json({ error: duplicateError.message }, { status: 500 });
    }
    if (duplicate && (duplicate as Subcategory).id !== current.id) {
      return NextResponse.json(
        { error: "Subcategory name already exists in this chamber" },
        { status: 409 }
      );
    }

    const { data, error } = await supabase
      .from("mirror_subcategories")
      .update({
        name,
        updated_at: new Date().toISOString(),
      })
      .eq("id", current.id)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message || "Failed to rename subcategory" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, subcategory: data as Subcategory });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to rename subcategory";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function handleDeleteSubcategory(
  request: NextRequest,
  params: { id: string },
  deps: SubcategoryDeps
) {
  const userId = await deps.resolveUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = deps.createSupabaseAdmin();
  const loadSubcategory = deps.getSubcategory || getSubcategory;

  try {
    const current = await loadSubcategory(userId, params.id, supabase);
    if (!current) {
      return NextResponse.json({ error: "Subcategory not found" }, { status: 404 });
    }

    const { error } = await supabase
      .from("mirror_subcategories")
      .delete()
      .eq("id", current.id)
      .eq("user_id", userId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete subcategory";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
