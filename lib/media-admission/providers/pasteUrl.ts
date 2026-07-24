import type { MediaAdmissionProvider } from "../port";

export function assertHttpUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("请粘贴图片 URL");
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("URL 格式无效");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("仅支持 http(s) URL");
  }
  return parsed.toString();
}

export const pasteUrlProvider: MediaAdmissionProvider = {
  id: "paste_url",
  label: "粘贴 URL",
  async obtainCandidate(input) {
    const url = assertHttpUrl(input.url ?? "");
    return {
      url,
      source: "paste_url",
      label: url,
    };
  },
};
