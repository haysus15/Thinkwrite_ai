export type CodingReviewLanguage = "python" | "sql" | "javascript";
export type CodingReviewEntryType = "structured_path" | "assignment" | "sandbox";

export interface CodingReviewSession {
  id: string;
  user_id: string;
  language: CodingReviewLanguage;
  entry_type: CodingReviewEntryType;
  path_id: string | null;
  assignment_id: string | null;
  code_snapshot: string | null;
  output_snapshot: string | null;
  victor_context: unknown;
  started_at: string;
  last_active_at: string;
  completed_at: string | null;
}

export interface CodingReviewPath {
  id: string;
  title: string;
  language: CodingReviewLanguage;
  description: string;
  lesson_count: number;
  created_at: string;
}

export interface CodingReviewLesson {
  id: string;
  path_id: string;
  lesson_index: number;
  title: string;
  concept_summary: string;
  challenge_prompt: string;
  required_skills: string[];
  created_at: string;
}

export interface CodingReviewPathProgress {
  id: string;
  user_id: string;
  path_id: string;
  current_lesson: number;
  lessons_completed: number[];
  placement_level: number | null;
  placement_data: unknown;
  checkpoint_results: unknown;
  total_time_seconds: number;
  struggle_topics: string[];
  started_at: string;
  last_active_at: string;
  completed_at: string | null;
}

export interface CodingReviewTemplate {
  id: string;
  language: CodingReviewLanguage;
  title: string;
  description: string;
  template_type: "blank" | "starter" | "dataset" | "dom";
  frontend_loader_key: string;
  created_at: string;
}

async function parseJson<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) {
    const message =
      typeof (data as { error?: string })?.error === "string"
        ? (data as { error: string }).error
        : "Request failed.";
    throw new Error(message);
  }
  return data as T;
}

export async function createCodingReviewSession(input: {
  language: CodingReviewLanguage;
  entry_type: CodingReviewEntryType;
  path_id?: string | null;
  assignment_id?: string | null;
  code_snapshot?: string | null;
}): Promise<CodingReviewSession> {
  const response = await fetch("/api/academic/coding-review/session/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await parseJson<{ success: boolean; session: CodingReviewSession }>(
    response
  );
  return data.session;
}

export async function getCodingReviewSession(id: string) {
  const response = await fetch(`/api/academic/coding-review/session/${id}`);
  const data = await parseJson<{ success: boolean; session: CodingReviewSession }>(
    response
  );
  return data.session;
}

export async function updateCodingReviewSession(
  id: string,
  updates: {
    code_snapshot?: string;
    output_snapshot?: string;
    victor_context?: unknown;
    completed_at?: string;
  }
) {
  const response = await fetch(`/api/academic/coding-review/session/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  const data = await parseJson<{ success: boolean; session: CodingReviewSession }>(
    response
  );
  return data.session;
}

export async function endCodingReviewSession(id: string) {
  const response = await fetch(`/api/academic/coding-review/session/${id}`, {
    method: "DELETE",
  });
  await parseJson<{ success: boolean }>(response);
}

export async function listCodingReviewSessions(input?: {
  limit?: number;
  offset?: number;
}) {
  const params = new URLSearchParams();
  if (typeof input?.limit === "number") {
    params.set("limit", String(input.limit));
  }
  if (typeof input?.offset === "number") {
    params.set("offset", String(input.offset));
  }
  const response = await fetch(
    `/api/academic/coding-review/sessions?${params.toString()}`
  );
  const data = await parseJson<{ success: boolean; sessions: CodingReviewSession[] }>(
    response
  );
  return data.sessions;
}

export async function logCodingReviewExecution(input: {
  language: CodingReviewLanguage;
  session_id: string;
  code: string;
  stdout?: string;
  stderr?: string;
  error?: string | null;
  execution_time_ms?: number | null;
}) {
  const response = await fetch("/api/academic/coding-review/execute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  await parseJson<{ success: boolean; submission_id: string | null }>(response);
}

export async function submitCodingReviewCheckpoint(input: {
  language: CodingReviewLanguage;
  session_id: string;
  code: string;
  challenge_id?: string | null;
  output?: string | null;
  error?: string | null;
  execution_time_ms?: number | null;
  checkpoint_passed?: boolean | null;
}) {
  const response = await fetch("/api/academic/coding-review/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  await parseJson<{ success: boolean; submission_id: string | null }>(response);
}

export async function listCodingReviewPaths(language?: CodingReviewLanguage) {
  const params = new URLSearchParams();
  if (language) {
    params.set("language", language);
  }
  const response = await fetch(
    `/api/academic/coding-review/paths?${params.toString()}`
  );
  const data = await parseJson<{
    success: boolean;
    paths: Array<CodingReviewPath & { progress: CodingReviewPathProgress | null }>;
  }>(response);
  return data.paths;
}

export async function getCodingReviewPath(pathId: string) {
  const response = await fetch(`/api/academic/coding-review/paths/${pathId}`);
  const data = await parseJson<{
    success: boolean;
    path: CodingReviewPath;
    lessons: CodingReviewLesson[];
    progress: CodingReviewPathProgress | null;
  }>(response);
  return data;
}

export async function listCodingReviewTemplates(
  language?: CodingReviewLanguage
) {
  const params = new URLSearchParams();
  if (language) {
    params.set("language", language);
  }
  const response = await fetch(
    `/api/academic/coding-review/templates?${params.toString()}`
  );
  const data = await parseJson<{ success: boolean; templates: CodingReviewTemplate[] }>(
    response
  );
  return data.templates;
}

export async function getCodingReviewTemplate(id: string) {
  const response = await fetch(`/api/academic/coding-review/templates/${id}`);
  const data = await parseJson<{
    success: boolean;
    template: CodingReviewTemplate;
  }>(response);
  return data.template;
}

export async function startCodingReviewPlacement(pathId: string) {
  const response = await fetch("/api/academic/coding-review/placement/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path_id: pathId }),
  });
  const data = await parseJson<{
    success: boolean;
    placement: unknown;
    challenges: string[];
  }>(response);
  return data;
}

export async function submitCodingReviewPlacement(input: {
  path_id: string;
  response: Record<string, unknown>;
  assessed_level?: number | null;
  victor_reasoning?: string | null;
}) {
  const response = await fetch("/api/academic/coding-review/placement/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await parseJson<{ success: boolean; placement: unknown }>(
    response
  );
  return data;
}

export async function getCodingReviewPlacementResult(pathId: string) {
  const response = await fetch(
    `/api/academic/coding-review/placement/result?path_id=${pathId}`
  );
  const data = await parseJson<{ success: boolean; placement: unknown }>(
    response
  );
  return data;
}

export async function updateCodingReviewPathProgress(
  pathId: string,
  updates: {
    current_lesson?: number;
    lessons_completed?: number[];
    placement_level?: number;
    struggle_topics?: string[];
  }
) {
  const response = await fetch(
    `/api/academic/coding-review/paths/${pathId}/progress`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    }
  );
  const data = await parseJson<{ success: boolean; progress: unknown }>(
    response
  );
  return data;
}

export async function canCodingReviewEmergencySkip() {
  const response = await fetch("/api/academic/coding-review/can-skip");
  const data = await parseJson<{
    success: boolean;
    eligible: boolean;
    usedCount: number;
  }>(response);
  return data;
}

export async function useCodingReviewEmergencySkip() {
  const response = await fetch("/api/academic/coding-review/emergency-skip", {
    method: "POST",
  });
  const data = await parseJson<{ success: boolean; skipped: boolean }>(
    response
  );
  return data;
}

export async function reviewCodingCheckpoint(input: {
  language: string;
  code: string;
  output: string;
  explain: string;
  modify: string;
  session_id: string;
  challenge_id?: string | null;
  path_id?: string | null;
  lesson_index?: number | null;
}) {
  const response = await fetch("/api/academic/coding-review/checkpoint/review", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await parseJson<{
    success: boolean;
    pass: boolean;
    feedback: string;
    submission_id: string;
    review_id: string;
  }>(response);
  return data;
}

export async function listCodingReviewCheckpointReviews(params?: {
  path_id?: string;
  lesson_index?: number;
}) {
  const search = new URLSearchParams();
  if (params?.path_id) search.set("path_id", params.path_id);
  if (typeof params?.lesson_index === "number") {
    search.set("lesson_index", String(params.lesson_index));
  }
  const response = await fetch(
    `/api/academic/coding-review/checkpoint/reviews?${search.toString()}`
  );
  const data = await parseJson<{
    success: boolean;
    reviews: Array<{
      id: string;
      submission_id: string;
      path_id: string | null;
      lesson_index: number | null;
      pass: boolean;
      feedback: string;
      reviewed_at: string;
    }>;
  }>(response);
  return data.reviews;
}
