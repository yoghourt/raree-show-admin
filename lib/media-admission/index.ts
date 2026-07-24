/**
 * Media Admission (Phase 1) — candidate providers for CPP frame fill.
 * Returns candidates only; never writes Assets.
 */

export {
  createMediaAdmissionProviders,
  getMediaAdmissionProvider,
  type MediaAdmissionFactoryOptions,
} from "./factory";
export type { MediaAdmissionProvider } from "./port";
export { assertHttpUrl, pasteUrlProvider } from "./providers/pasteUrl";
export { localUploadProvider } from "./providers/localUpload";
export type {
  MediaAdmissionProviderId,
  MediaCandidate,
  ObtainCandidateInput,
} from "./types";
