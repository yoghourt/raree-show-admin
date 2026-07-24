import type {
  MediaAdmissionProviderId,
  MediaCandidate,
  ObtainCandidateInput,
} from "./types";

/**
 * Port: obtain an ephemeral candidate URL.
 * MUST NOT write Assets / story_images_v2. Accept remains Human-only.
 */
export type MediaAdmissionProvider = {
  id: MediaAdmissionProviderId;
  label: string;
  obtainCandidate: (input: ObtainCandidateInput) => Promise<MediaCandidate>;
};
