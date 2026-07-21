/**
 * Server-side unsigned upload (same preset as browser `lib/cloudinary.ts`).
 * Avoids cloudinary Node SDK, which requires api_key even for unsigned presets.
 */
export async function uploadImageBufferToCloudinary(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  const ext = mimeType.includes("png")
    ? "png"
    : mimeType.includes("webp")
      ? "webp"
      : "jpg"
  const formData = new FormData()
  formData.append(
    "file",
    new Blob([new Uint8Array(buffer)], { type: mimeType }),
    `portrait.${ext}`
  )
  formData.append("upload_preset", "raree-show-admin")

  const res = await fetch(
    "https://api.cloudinary.com/v1_1/dnuxz94n5/image/upload",
    { method: "POST", body: formData }
  )

  const data = (await res.json()) as {
    secure_url?: string
    error?: { message?: string }
  }

  if (!res.ok) {
    throw new Error(
      data.error?.message ?? `Cloudinary upload failed (HTTP ${res.status})`
    )
  }

  if (!data.secure_url) {
    throw new Error("Cloudinary response missing secure_url")
  }

  return data.secure_url
}
