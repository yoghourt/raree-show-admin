/**
 * Opaque Execution result pointer for generate_jobs.result_reference.
 * Job ≠ Candidate ≠ Asset — this is not Media Admission Candidate Truth.
 */

export type HostedImageResultReference = {
  v: 1;
  kind: "hosted_image";
  url: string;
  mimeType: string;
  capabilityId: string;
  usedFallback: boolean;
};

export function buildHostedImageResultReference(input: {
  url: string;
  mimeType: string;
  capabilityId: string;
  usedFallback: boolean;
}): string {
  const payload: HostedImageResultReference = {
    v: 1,
    kind: "hosted_image",
    url: input.url,
    mimeType: input.mimeType,
    capabilityId: input.capabilityId,
    usedFallback: input.usedFallback,
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
    return {
      v: 1,
      kind: "hosted_image",
      url: rec.url,
      mimeType: rec.mimeType,
      capabilityId: rec.capabilityId,
      usedFallback: rec.usedFallback,
    };
  } catch {
    return null;
  }
}
