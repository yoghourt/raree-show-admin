import { uploadToCloudinary } from "@/lib/cloudinary";

import type { MediaAdmissionProvider } from "../port";

export const localUploadProvider: MediaAdmissionProvider = {
  id: "local_upload",
  label: "上传",
  async obtainCandidate(input) {
    if (!input.file) {
      throw new Error("请选择要上传的图片文件");
    }
    const url = await uploadToCloudinary(input.file);
    return {
      url,
      source: "local_upload",
      label: input.file.name,
    };
  },
};
