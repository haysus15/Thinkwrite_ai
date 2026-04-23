"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type FirstTimeAcademicUserState = {
  isFirstTimeUser: boolean;
  loading: boolean;
  error: string | null;
};

const DEFAULT_STATE: FirstTimeAcademicUserState = {
  isFirstTimeUser: false,
  loading: true,
  error: null,
};

export function useFirstTimeAcademicUser(userId: string | null | undefined) {
  const [state, setState] = useState<FirstTimeAcademicUserState>(DEFAULT_STATE);

  useEffect(() => {
    if (!userId) {
      setState({
        isFirstTimeUser: false,
        loading: false,
        error: null,
      });
      return;
    }

    let active = true;
    const supabase = createSupabaseBrowserClient();

    async function load() {
      setState((current) => ({
        ...current,
        loading: true,
        error: null,
      }));

      const [assignmentsResult, materialsResult] = await Promise.all([
        supabase
          .from("assignments")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId),
        supabase
          .from("study_materials")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId),
      ]);

      if (!active) return;

      const error =
        assignmentsResult.error?.message || materialsResult.error?.message || null;

      setState({
        isFirstTimeUser:
          !error &&
          (assignmentsResult.count ?? 0) === 0 &&
          (materialsResult.count ?? 0) === 0,
        loading: false,
        error,
      });
    }

    void load();

    return () => {
      active = false;
    };
  }, [userId]);

  return state;
}
