import type { CaseSpec, LedgerRow, Presence } from "./types";
import {
  acceptedHay,
  CASES,
  discoveryHay,
  hasNeedles,
  LEDGER,
} from "./cases";

function captionHay(slice: CaseSpec["slice"]): string {
  return slice.frames.map((f) => f.caption).join("\n");
}

function contextHay(slice: CaseSpec["slice"]): string {
  const ctx = slice.context;
  if (!ctx) return "";
  return [ctx.beatSummary, ctx.relationship, ctx.emotion, ctx.purpose]
    .filter(Boolean)
    .join("\n");
}

function appearanceHay(slice: CaseSpec["slice"]): string {
  return (slice.context?.appearanceNames ?? []).join(" ");
}

function observedPresence(text: string, needles: string[]): Presence {
  if (needles.length === 0) return "N";
  const hits = needles.filter((n) =>
    text.toLowerCase().includes(n.toLowerCase())
  ).length;
  if (hits === 0) return "N";
  if (hits === needles.length) return "Y";
  return "P";
}

function compatible(annotated: Presence, observed: Presence): boolean {
  return annotated === observed;
}

export type RowProbe = {
  id: string;
  ok: boolean;
  failures: string[];
  observed: {
    discovery: Presence;
    accepted: Presence;
    runtimeCaption: Presence;
    runtimeContext: Presence;
    runtimeAppearance: Presence;
  };
};

export function probeRow(row: LedgerRow, slice: CaseSpec["slice"]): RowProbe {
  const failures: string[] = [];
  if (row.needles.length === 0) {
    return {
      id: row.id,
      ok: true,
      failures: [],
      observed: {
        discovery: row.discovery,
        accepted: row.accepted,
        runtimeCaption: row.runtimeCaption,
        runtimeContext: row.runtimeContext,
        runtimeAppearance: row.runtimeAppearance,
      },
    };
  }

  const observed = {
    discovery: observedPresence(discoveryHay(slice), row.needles),
    accepted: observedPresence(acceptedHay(slice), row.needles),
    runtimeCaption: observedPresence(captionHay(slice), row.needles),
    runtimeContext: observedPresence(contextHay(slice), row.needles),
    runtimeAppearance: observedPresence(appearanceHay(slice), row.needles),
  };

  const checks: Array<keyof typeof observed> = [
    "discovery",
    "accepted",
    "runtimeCaption",
    "runtimeContext",
    "runtimeAppearance",
  ];
  for (const key of checks) {
    if (!compatible(row[key], observed[key])) {
      failures.push(
        `${key}: annotated ${row[key]} observed ${observed[key]}`
      );
    }
  }

  return { id: row.id, ok: failures.length === 0, failures, observed };
}

export function caseById(id: CaseSpec["id"]): CaseSpec {
  const found = CASES.find((c) => c.id === id);
  if (!found) throw new Error(`unknown case ${id}`);
  return found;
}

export function probeLedger(): RowProbe[] {
  return LEDGER.map((row) => probeRow(row, caseById(row.caseId).slice));
}

export function architectureSplit(): Record<
  LedgerRow["architecture"],
  string[]
> {
  const out: Record<string, string[]> = {
    "A. Discovery extraction problem": [],
    "B. Discovery → Scene contract problem": [],
    "C. Projection / Runtime mapping problem": [],
  };
  for (const row of LEDGER) {
    if (row.lossPoint === "none") continue;
    out[row.architecture].push(row.id);
  }
  return out as Record<LedgerRow["architecture"], string[]>;
}

export function firstLossRows(): LedgerRow[] {
  return LEDGER.filter((row) => {
    if (row.lossPoint === "none") return false;
    return row.runtimeCaption !== "Y";
  });
}

export function captionAuthorityDrops(): LedgerRow[] {
  return LEDGER.filter(
    (row) =>
      (row.discovery === "Y" || row.accepted === "Y") &&
      row.runtimeCaption !== "Y" &&
      row.lossPoint !== "none"
  );
}
