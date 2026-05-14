import { v2 as cloudinary } from "cloudinary"

cloudinary.config({
  cloud_name: "dnuxz94n5",
})

/**
 * Upload image bytes with unsigned preset (no API secret, no temp files).
 */
export function uploadImageBufferToCloudinary(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  // Implementing A-02: Server-side Buffer Upload to Cloudinary
  const dataUri = `data:${mimeType};base64,${buffer.toString("base64")}`

  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload(
      dataUri,
      {
        upload_preset: "raree-show-admin",
        resource_type: "image",
      },
      (err, result) => {
        if (err) {
          reject(err)
          return
        }
        const url = result?.secure_url
        if (!url) {
          reject(new Error("Cloudinary response missing secure_url"))
          return
        }
        resolve(url)
      }
    )
  })
}
