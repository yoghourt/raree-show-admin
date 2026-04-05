/**
 * Unsigned upload to Cloudinary（preset：raree-show-admin，cloud：dnuxz94n5）
 */
export async function uploadToCloudinary(file: File): Promise<string> {
  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", "raree-show-admin");

    const res = await fetch(
      "https://api.cloudinary.com/v1_1/dnuxz94n5/image/upload",
      { method: "POST", body: formData }
    );

    const data = (await res.json()) as {
      secure_url?: string;
      error?: { message?: string };
    };

    if (!res.ok) {
      throw new Error(
        data.error?.message ?? `上传失败（HTTP ${res.status}）`
      );
    }

    if (!data.secure_url) {
      throw new Error("上传响应缺少 secure_url");
    }

    return data.secure_url;
  } catch (e) {
    if (e instanceof Error) {
      throw e;
    }
    throw new Error(String(e));
  }
}
