/**
 * Reader app (raree-show-web) origin for Admin「打开读者端验读」links.
 * Override with NEXT_PUBLIC_READER_ORIGIN when pointing at a local Reader.
 */

export const DEFAULT_READER_ORIGIN = "https://raree-show-web.vercel.app";

export function getReaderOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_READER_ORIGIN?.trim() || DEFAULT_READER_ORIGIN
  ).replace(/\/$/, "");
}

export function readerWorkUrl(workId: string): string {
  return `${getReaderOrigin()}/works/${encodeURIComponent(workId)}`;
}
