import { beforeEach, describe, expect, it, vi } from "vitest";

const undiciFetch = vi.fn();

vi.mock("undici", async (importOriginal) => {
  const actual = await importOriginal<typeof import("undici")>();
  return {
    ...actual,
    fetch: undiciFetch,
  };
});

const { uploadImageBufferToCloudinary, isRetryableCloudinaryNetworkError } =
  await import("@/lib/cloudinary/serverUpload");

function connectTimeout(): Error {
  const cause = new Error(
    "Connect Timeout Error (attempted address: api.cloudinary.com:443, timeout: 10000ms)"
  ) as Error & { code: string };
  cause.code = "UND_ERR_CONNECT_TIMEOUT";
  const err = new Error("fetch failed");
  err.cause = cause;
  return err;
}

describe("isRetryableCloudinaryNetworkError", () => {
  it("retries connect timeout and socket close", () => {
    expect(isRetryableCloudinaryNetworkError(connectTimeout())).toBe(true);
    expect(isRetryableCloudinaryNetworkError(new Error("other side closed"))).toBe(
      true
    );
    expect(
      isRetryableCloudinaryNetworkError(new Error("Cloudinary upload failed (HTTP 400)"))
    ).toBe(false);
  });
});

describe("uploadImageBufferToCloudinary", () => {
  beforeEach(() => {
    undiciFetch.mockReset();
  });

  it("retries connect timeout then succeeds", async () => {
    undiciFetch
      .mockRejectedValueOnce(connectTimeout())
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          secure_url: "https://res.cloudinary.com/dnuxz94n5/image/upload/v1/ok.png",
        }),
      });

    const url = await uploadImageBufferToCloudinary(
      Buffer.from("img"),
      "image/png"
    );
    expect(url).toContain("ok.png");
    expect(undiciFetch).toHaveBeenCalledTimes(2);
  });

  it("does not retry HTTP 400", async () => {
    undiciFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: { message: "Invalid preset" } }),
    });
    await expect(
      uploadImageBufferToCloudinary(Buffer.from("img"), "image/png")
    ).rejects.toThrow(/Invalid preset/);
    expect(undiciFetch).toHaveBeenCalledTimes(1);
  });
});
