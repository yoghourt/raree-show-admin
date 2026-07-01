/**
 * Unit tests — Discovery session platform invariants
 *
 * SPEC-D3-001 D3-RC-02 / D3-RC-07 / D3-RC-10 (D3-AC-IMP-01, D3-AC-IMP-03)
 */

import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  claimClientSession,
  hasClientSessionConflict,
  releaseClientSession,
  resetClientSessionRegistry,
} from "@/lib/discovery/client-session-registry";
import {
  claimServerLock,
  releaseServerLock,
  resetServerLockRegistry,
} from "@/lib/discovery/server-session-registry";
import {
  canStartPropose,
  createDiscoverySession,
  isNarrativeEditable,
  switchNarrativeInputMode,
} from "@/lib/discovery/session-factory";
import { computeTotalProse } from "@/lib/discovery/narrative-gate";

describe("D3-RC-10 — one active session per (workId, operatorId)", () => {
  beforeEach(() => {
    resetClientSessionRegistry();
    resetServerLockRegistry();
  });

  it("client registry rejects second session for same work+operator", () => {
    expect(claimClientSession("work-1", "op-1", "sess-a")).toEqual({ ok: true });
    expect(claimClientSession("work-1", "op-1", "sess-b")).toEqual({
      ok: false,
      code: "SESSION_ALREADY_ACTIVE",
    });
  });

  it("hasClientSessionConflict detects foreign session id", () => {
    claimClientSession("work-1", "op-1", "sess-a");
    expect(hasClientSessionConflict("work-1", "op-1", "sess-b")).toBe(true);
    expect(hasClientSessionConflict("work-1", "op-1", "sess-a")).toBe(false);
  });

  it("client registry allows same sessionId re-claim", () => {
    expect(claimClientSession("work-1", "op-1", "sess-a")).toEqual({ ok: true });
    expect(claimClientSession("work-1", "op-1", "sess-a")).toEqual({ ok: true });
  });

  it("release frees slot for a new session", () => {
    expect(claimClientSession("work-1", "op-1", "sess-a")).toEqual({ ok: true });
    releaseClientSession("work-1", "op-1", "sess-a");
    expect(claimClientSession("work-1", "op-1", "sess-b")).toEqual({ ok: true });
  });

  it("server lock registry enforces SESSION_ALREADY_ACTIVE", () => {
    expect(claimServerLock("work-1", "op-1", "sess-a")).toEqual({ ok: true });
    expect(claimServerLock("work-1", "op-1", "sess-b")).toEqual({
      ok: false,
      code: "SESSION_ALREADY_ACTIVE",
    });
    releaseServerLock("work-1", "op-1", "sess-a");
    expect(claimServerLock("work-1", "op-1", "sess-b")).toEqual({ ok: true });
  });
});

describe("Discovery session state helpers", () => {
  it("draft is editable; narrative_locked enables propose handoff", () => {
    const session = createDiscoverySession("work-1", "op-1", "sess-a");
    expect(isNarrativeEditable(session)).toBe(true);
    expect(canStartPropose(session)).toBe(false);

    const locked = { ...session, state: "narrative_locked" as const };
    expect(isNarrativeEditable(locked)).toBe(false);
    expect(canStartPropose(locked)).toBe(true);
  });

  it("session is work-scoped with operatorId", () => {
    const session = createDiscoverySession("work-abc", "op-xyz", "sess-a");
    expect(session.workId).toBe("work-abc");
    expect(session.operatorId).toBe("op-xyz");
  });

  it("switchNarrativeInputMode resets prose — no m+n carryover across modes", () => {
    const excerptMode = {
      excerpts: [{ text: "excerpt prose here.", orderIndex: 0 }],
      operatorSummary: "summary from excerpt mode",
      inputMode: "excerpt_bundle" as const,
      summaryAttested: false,
    };
    expect(computeTotalProse(excerptMode)).toBeGreaterThan(0);

    const switched = switchNarrativeInputMode(excerptMode, "approved_summary");
    expect(switched.inputMode).toBe("approved_summary");
    expect(switched.operatorSummary).toBeNull();
    expect(switched.excerpts).toEqual([]);
    expect(computeTotalProse(switched)).toBe(0);

    const withNewSummary = {
      ...switched,
      operatorSummary: "n chars only",
    };
    expect(computeTotalProse(withNewSummary)).toBe("n chars only".length);
  });
});

describe("D3-RC-02 — separate from Enrichment Copilot", () => {
  it("useDiscoverySession does not import Enrichment Copilot hook", () => {
    const hookPath = path.resolve("hooks/useDiscoverySession.ts");
    const source = readFileSync(hookPath, "utf8");
    expect(source).not.toMatch(/from\s+["']@\/hooks\/useCopilotSession["']/);
    expect(source).not.toContain("/api/admin/ai/suggest");
  });

  it("Discovery lock route does not import suggest-service", () => {
    const routePath = path.resolve(
      "app/api/admin/discovery/session/lock/route.ts"
    );
    const source = readFileSync(routePath, "utf8");
    expect(source).not.toContain("suggest-service");
    expect(source).not.toContain("generateSuggestions");
  });
});

describe("D3-RC-07 — platform layer has no entity persist imports", () => {
  it("lock route only reads works for access check", () => {
    const routePath = path.resolve(
      "app/api/admin/discovery/session/lock/route.ts"
    );
    const source = readFileSync(routePath, "utf8");
    expect(source).toContain('.from("works")');
    expect(source).not.toContain(".insert(");
    expect(source).not.toContain(".update(");
    expect(source).not.toContain(".upsert(");
  });
});
