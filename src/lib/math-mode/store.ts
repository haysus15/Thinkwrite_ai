import type {
  MathGuidance,
  MathPractice,
  MathProblem,
  MathStep,
} from "@/types/math-mode";

const problems = new Map<string, MathProblem>();
const steps = new Map<string, MathStep>();
const guidance = new Map<string, MathGuidance>();
const practices = new Map<string, MathPractice>();

function now() {
  return new Date().toISOString();
}

function randomId() {
  return crypto.randomUUID();
}

export const mathStore = {
  createProblem(input: Omit<MathProblem, "id" | "created_at" | "completed">) {
    const id = randomId();
    const problem: MathProblem = {
      ...input,
      id,
      created_at: now(),
      completed: false,
    };
    problems.set(id, problem);
    return problem;
  },
  getProblem(id: string) {
    return problems.get(id) || null;
  },
  updateProblem(id: string, updates: Partial<MathProblem>) {
    const current = problems.get(id);
    if (!current) return null;
    const next = { ...current, ...updates };
    problems.set(id, next);
    return next;
  },
  deleteProblem(id: string) {
    problems.delete(id);
    Array.from(steps.values()).forEach((step) => {
      if (step.problem_id === id) {
        steps.delete(step.id);
      }
    });
  },
  listSteps(problemId: string) {
    return Array.from(steps.values())
      .filter((step) => step.problem_id === problemId)
      .sort((a, b) => a.step_number - b.step_number);
  },
  createStep(input: Omit<MathStep, "id" | "created_at" | "status">) {
    const id = randomId();
    const step: MathStep = {
      ...input,
      id,
      created_at: now(),
      status: "unchecked",
    };
    steps.set(id, step);
    return step;
  },
  updateStep(id: string, updates: Partial<MathStep>) {
    const current = steps.get(id);
    if (!current) return null;
    const next = { ...current, ...updates };
    steps.set(id, next);
    return next;
  },
  deleteStep(id: string) {
    steps.delete(id);
  },
  addGuidance(input: Omit<MathGuidance, "id" | "created_at">) {
    const id = randomId();
    const entry: MathGuidance = { ...input, id, created_at: now() };
    guidance.set(id, entry);
    return entry;
  },
  listGuidance(problemId: string) {
    return Array.from(guidance.values()).filter(
      (entry) => entry.problem_id === problemId
    );
  },
  createPractice(input: Omit<MathPractice, "id">) {
    const id = randomId();
    const entry: MathPractice = { ...input, id };
    practices.set(id, entry);
    return entry;
  },
};
