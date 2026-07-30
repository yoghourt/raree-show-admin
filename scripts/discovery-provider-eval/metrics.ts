import type { FailureClass } from "./types";

export function percentile(sortedAsc: number[], p: number): number | null {
  if (sortedAsc.length === 0) return null;
  if (sortedAsc.length === 1) return sortedAsc[0]!;
  const idx = (sortedAsc.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedAsc[lo]!;
  const w = idx - lo;
  return sortedAsc[lo]! * (1 - w) + sortedAsc[hi]! * w;
}

export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function classifyFailure(
  code?: string,
  message?: string
): FailureClass {
  const msg = (message ?? "").toLowerCase();
  const c = code ?? "";
  if (!c && !msg) return "none";
  if (/timeout|aborted|etimedout|und_err_connect_timeout/i.test(msg)) {
    return "runtime_timeout";
  }
  if (
    /fetch failed|enotfound|econnrefused|network|http \d+|429|unreachable/i.test(
      msg
    )
  ) {
    return "infrastructure";
  }
  if (
    c === "GENERATION_PARSE_FAILED" ||
    /not a json array|json|parse/i.test(msg)
  ) {
    return "json_formatting";
  }
  if (
    c === "GENERATION_PARSE_FAILED" ||
    /could not be parsed into valid|parentStoryCandidateId|fields require/i.test(
      msg
    )
  ) {
    return "schema_validation";
  }
  if (c === "SCENE_REQUIRES_STORY") return "model_generation";
  return "model_generation";
}

export function emptyFailureHistogram(): Record<FailureClass, number> {
  return {
    model_generation: 0,
    json_formatting: 0,
    schema_validation: 0,
    runtime_timeout: 0,
    infrastructure: 0,
    none: 0,
  };
}
