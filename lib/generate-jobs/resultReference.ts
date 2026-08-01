/**
 * Opaque Execution result pointer for generate_jobs.result_reference.
 * Job ≠ Candidate ≠ Asset — this is not Media Admission Candidate Truth.
 */

/** Face Safety policy snapshot (Rule 6) — advisory for Human Accept; not CV. */
export type FaceSafetyResultReference = {
  safety_status: "allowed" | "requires_human_review" | "restricted";
  reason: string;
};

export type HostedImageResultReference = {
  v: 1;
  kind: "hosted_image";
  url: string;
  mimeType: string;
  capabilityId: string;
  usedFallback: boolean;
  /** Present on scene_frame when Expression was assessed (Rule 6). */
  faceSafety?: FaceSafetyResultReference;
};

export function buildHostedImageResultReference(input: {
  url: string;
  mimeType: string;
  capabilityId: string;
  usedFallback: boolean;
  faceSafety?: FaceSafetyResultReference;
}): string {
  const payload: HostedImageResultReference = {
    v: 1,
    kind: "hosted_image",
    url: input.url,
    mimeType: input.mimeType,
    capabilityId: input.capabilityId,
    usedFallback: input.usedFallback,
    ...(input.faceSafety ? { faceSafety: input.faceSafety } : {}),
  };
  return JSON.stringify(payload);
}

export function parseHostedImageResultReference(
  raw: string | null | undefined
): HostedImageResultReference | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    const rec = parsed as Record<string, unknown>;
    if (rec.v !== 1 || rec.kind !== "hosted_image") return null;
    if (typeof rec.url !== "string" || !rec.url.trim()) return null;
    if (typeof rec.mimeType !== "string") return null;
    if (typeof rec.capabilityId !== "string") return null;
    if (typeof rec.usedFallback !== "boolean") return null;
    let faceSafety: FaceSafetyResultReference | undefined;
    const rawFs = rec.faceSafety;
    if (rawFs && typeof rawFs === "object" && !Array.isArray(rawFs)) {
      const fs = rawFs as Record<string, unknown>;
      const status = fs.safety_status;
      const reason = fs.reason;
      if (
        (status === "allowed" ||
          status === "requires_human_review" ||
          status === "restricted") &&
        typeof reason === "string" &&
        reason.trim()
      ) {
        faceSafety = { safety_status: status, reason: reason.trim() };
      }
    }
    return {
      v: 1,
      kind: "hosted_image",
      url: rec.url,
      mimeType: rec.mimeType,
      capabilityId: rec.capabilityId,
      usedFallback: rec.usedFallback,
      ...(faceSafety ? { faceSafety } : {}),
    };
  } catch {
    return null;
  }
}
