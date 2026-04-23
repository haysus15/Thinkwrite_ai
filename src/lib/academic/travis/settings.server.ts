import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeTravisSettings, type TravisSettings } from "@/lib/academic/travis/settings";

export async function getTravisSettings(userId: string): Promise<TravisSettings> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("travis_settings")
    .select(
      "planning_style, agenda_horizon, overdue_emphasis, assignment_priority, reminder_density, subject_weights"
    )
    .eq("user_id", userId)
    .maybeSingle();

  return normalizeTravisSettings(data);
}
