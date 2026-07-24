/**
 * Media Admission — candidate supply only (never writes Assets).
 * Phase 1 providers: local_upload · paste_url
 */

export type MediaAdmissionProviderId = "local_upload" | "paste_url";

export type MediaCandidateSource = MediaAdmissionProviderId;

export type MediaCandidate = {
  url: string;
  source: MediaCandidateSource;
  label?: string;
};

export type ObtainCandidateInput = {
  /** Optional slot caption (context for future providers) */
  caption?: string;
  /** Optional route title (context for future providers) */
  routeTitle?: string;
  /** Local file for local_upload */
  file?: File;
  /** Raw URL string for paste_url */
  url?: string;
};
