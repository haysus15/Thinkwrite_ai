import { evaluate } from "mathjs";

function toAsciiMinus(value: string): string {
  return value.replace(/[−–—]/g, "-");
}

function normalizeLatex(value: string): string {
  let out = toAsciiMinus(value.trim());
  out = out
    .replace(/²/g, "^2")
    .replace(/³/g, "^3")
    .replace(/⁴/g, "^4")
    .replace(/⁵/g, "^5")
    .replace(/⁶/g, "^6")
    .replace(/⁷/g, "^7")
    .replace(/⁸/g, "^8")
    .replace(/⁹/g, "^9")
    .replace(/⁰/g, "^0")
    .replace(/⁻/g, "^-")
    .replace(/⁺/g, "^+");
  out = out.replace(/\u2062/g, "");
  out = out.replace(/[×✕]/g, "*");
  out = out.replace(/\\left|\\right/g, "");
  out = out.replace(/\\cdot|\\times/g, "*");
  out = out.replace(/\\cdotp/g, "*");
  out = out.replace(/\\div/g, "/");
  out = out.replace(/\\,/g, "");
  out = out.replace(/\\(?:d|t)?frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, "($1)/($2)");
  out = out.replace(/\\operatorname\s*\{([^{}]+)\}/g, "$1");
  out = out.replace(/\\text\s*\{([^{}]*)\}/g, "");
  out = out.replace(/\\placeholder\s*\{[^{}]*\}/g, "");
  out = out.replace(/[{}]/g, (m) => (m === "{" ? "(" : ")"));
  out = out.replace(/\\,/g, "");
  out = out.replace(/\\!/g, "");
  out = out.replace(/\\ /g, " ");
  out = out.replace(/\s+/g, " ");
  return out;
}

function insertImplicitMultiplication(value: string): string {
  return value
    .replace(/(\d)([a-zA-Z(])/g, "$1*$2")
    .replace(/([a-zA-Z)])(\d)/g, "$1*$2")
    .replace(/([a-zA-Z)])([a-zA-Z(])/g, "$1*$2");
}

function toMathExpr(value: string): string {
  return insertImplicitMultiplication(normalizeLatex(value)).replace(/\s+/g, "");
}

function splitEquation(value: string): { lhs: string; rhs: string } | null {
  const cleaned = toMathExpr(value);
  const canonical = cleaned.replace(/[≟≈]/g, "=");
  const parts = canonical.split("=");
  if (parts.length !== 2) return null;
  const lhs = parts[0]?.trim();
  const rhs = parts[1]?.trim();
  if (!lhs || !rhs) return null;
  return { lhs, rhs };
}

function normalizeExpression(value: string): string {
  return toMathExpr(value);
}

function extractVariables(expr: string): string[] {
  const vars = expr.match(/[a-zA-Z]/g) || [];
  return Array.from(new Set(vars));
}

function buildSampleScopes(variables: string[]): Array<Record<string, number>> {
  const base = [-7, -3, -1, 1, 2, 4, 7, 9, 11];
  if (variables.length === 0) {
    return [{}];
  }
  return base.map((seed, seedIndex) => {
    const scope: Record<string, number> = {};
    variables.forEach((name, varIndex) => {
      // Use distinct values per variable to avoid accidental matches when x=y.
      const offset = (seedIndex + 1) * (varIndex + 2);
      const sign = (seedIndex + varIndex) % 2 === 0 ? 1 : -1;
      scope[name] = seed + sign * offset;
    });
    return scope;
  });
}

function residual(eq: { lhs: string; rhs: string }, scope: Record<string, number>): number {
  const lhs = Number(evaluate(eq.lhs, scope));
  const rhs = Number(evaluate(eq.rhs, scope));
  return lhs - rhs;
}

function finite(value: number): boolean {
  return Number.isFinite(value) && !Number.isNaN(value);
}

export function compareEquationSteps(
  previousRaw: string,
  currentRaw: string,
  options?: { tolerance?: number }
): {
  comparable: boolean;
  equivalent: boolean;
  repeated: boolean;
  sampleMatches: number;
} {
  const tolerance = Math.max(1e-9, Number(options?.tolerance ?? 1e-6));
  const previous = splitEquation(previousRaw);
  const current = splitEquation(currentRaw);
  if (!previous || !current) {
    const previousExpr = normalizeExpression(previousRaw);
    const currentExpr = normalizeExpression(currentRaw);
    if (!previousExpr || !currentExpr) {
      return {
        comparable: false,
        equivalent: false,
        repeated: false,
        sampleMatches: 0,
      };
    }

    if (previousExpr === currentExpr) {
      return {
        comparable: true,
        equivalent: true,
        repeated: true,
        sampleMatches: 0,
      };
    }

    const variables = Array.from(
      new Set([
        ...extractVariables(previousExpr),
        ...extractVariables(currentExpr),
      ])
    );
    const scopes = buildSampleScopes(variables);
    let validPoints = 0;
    let sampleMatches = 0;

    for (const scope of scopes) {
      try {
        const previousValue = Number(evaluate(previousExpr, scope));
        const currentValue = Number(evaluate(currentExpr, scope));
        if (!finite(previousValue) || !finite(currentValue)) continue;
        validPoints += 1;
        if (Math.abs(previousValue - currentValue) > tolerance) {
          return {
            comparable: true,
            equivalent: false,
            repeated: false,
            sampleMatches,
          };
        }
        sampleMatches += 1;
      } catch {
        continue;
      }
    }

    if (validPoints < 3) {
      return {
        comparable: false,
        equivalent: false,
        repeated: false,
        sampleMatches,
      };
    }

    return {
      comparable: true,
      equivalent: true,
      repeated: false,
      sampleMatches,
    };
  }

  const previousCompact = `${previous.lhs}=${previous.rhs}`;
  const currentCompact = `${current.lhs}=${current.rhs}`;
  const repeated = previousCompact === currentCompact;
  if (repeated) {
    return { comparable: true, equivalent: true, repeated: true, sampleMatches: 0 };
  }

  const variables = Array.from(
    new Set([
      ...extractVariables(previous.lhs + previous.rhs),
      ...extractVariables(current.lhs + current.rhs),
    ])
  );

  const scopes = buildSampleScopes(variables);
  let validPoints = 0;
  let sampleMatches = 0;
  for (const scope of scopes) {
    try {
      const prevResidual = residual(previous, scope);
      const currResidual = residual(current, scope);
      if (!finite(prevResidual) || !finite(currResidual)) continue;
      validPoints += 1;
      if (Math.abs(prevResidual - currResidual) > tolerance) {
        return { comparable: true, equivalent: false, repeated: false, sampleMatches };
      }
      sampleMatches += 1;
    } catch {
      continue;
    }
  }

  if (validPoints < 3) {
    return { comparable: false, equivalent: false, repeated: false, sampleMatches };
  }

  return { comparable: true, equivalent: true, repeated: false, sampleMatches };
}
