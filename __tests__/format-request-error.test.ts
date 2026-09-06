import { describe, expect, it } from "vitest";

import { formatRequestError } from "@/lib/format-request-error";

function fetchFailed(causeMessage: string, code: string): Error {
  const cause = new Error(causeMessage) as Error & { code: string };
  cause.code = code;
  const err = new Error("fetch failed");
  err.cause = cause;
  return err;
}

describe("formatRequestError", () => {
  it("names Cloudinary for api.cloudinary.com connect timeout", () => {
    const err = fetchFailed(
      "Connect Timeout Error (attempted address: api.cloudinary.com:443, timeout: 10000ms)",
      "UND_ERR_CONNECT_TIMEOUT"
    );
    const msg = formatRequestError(err);
    expect(msg).toMatch(/Cloudinary/);
    expect(msg).not.toMatch(/Google API/);
    expect(msg).not.toMatch(/可降低 IMAGE_CREATOR_LOCALAI_MAX_EDGE/);
  });

  it("keeps Google advice when the peer is Gemini", () => {
    const err = fetchFailed(
      "Connect Timeout Error (attempted address: generativelanguage.googleapis.com:443, timeout: 10000ms)",
      "UND_ERR_CONNECT_TIMEOUT"
    );
    expect(formatRequestError(err)).toMatch(/Google API/);
  });

  it("does not blame Google for a generic connect timeout", () => {
    const err = fetchFailed(
      "Connect Timeout Error (attempted address: example.com:443, timeout: 10000ms)",
      "UND_ERR_CONNECT_TIMEOUT"
    );
    const msg = formatRequestError(err);
    expect(msg).toMatch(/TCP 连接超时/);
    expect(msg).not.toMatch(/Google API/);
  });

  it("wraps Cloudinary-prefixed errors with hosting advice", () => {
    const cause = fetchFailed(
      "Connect Timeout Error (attempted address: api.cloudinary.com:443, timeout: 10000ms)",
      "UND_ERR_CONNECT_TIMEOUT"
    );
    const wrapped = new Error("Cloudinary upload failed");
    wrapped.cause = cause;
    expect(formatRequestError(wrapped)).toMatch(/Cloudinary/);
    expect(formatRequestError(wrapped)).not.toMatch(/Google API/);
  });
});
