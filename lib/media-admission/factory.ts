import type { MediaAdmissionProvider } from "./port";
import { localUploadProvider } from "./providers/localUpload";
import { pasteUrlProvider } from "./providers/pasteUrl";
import type { MediaAdmissionProviderId } from "./types";

export type MediaAdmissionFactoryOptions = {
  /** Default: all Phase 1 providers enabled */
  enabled?: MediaAdmissionProviderId[];
};

const DEFAULT_ENABLED: MediaAdmissionProviderId[] = [
  "local_upload",
  "paste_url",
];

/**
 * Config-driven provider list. Swapping providers MUST NOT change
 * Assets / Accept / CPP Plan semantics.
 */
export function createMediaAdmissionProviders(
  options: MediaAdmissionFactoryOptions = {}
): MediaAdmissionProvider[] {
  const enabled = options.enabled ?? DEFAULT_ENABLED;
  const all: MediaAdmissionProvider[] = [
    localUploadProvider,
    pasteUrlProvider,
  ];
  return all.filter((p) => enabled.includes(p.id));
}

export function getMediaAdmissionProvider(
  id: MediaAdmissionProviderId,
  options?: MediaAdmissionFactoryOptions
): MediaAdmissionProvider {
  const providers = createMediaAdmissionProviders(options);
  const found = providers.find((p) => p.id === id);
  if (!found) {
    throw new Error(`Media Admission provider 未启用：${id}`);
  }
  return found;
}
