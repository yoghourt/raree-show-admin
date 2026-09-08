export {
  isValidLocationPin,
  mintGeometryId,
  normalizeLocationPinForPersist,
  resolveWorkMap,
  type LocationPinInput,
  type MapCapability,
  type WorkMapAuthorityInput,
  type WorkMapNotReadyReason,
  type WorkMapResolution,
} from "@/lib/work-maps/resolve";

export {
  acceptPublishedWorkMapAsset,
  acceptWorkMapGeometry,
  getWorkMap,
  getWorkMapCapability,
  resolveWorkMapForWork,
  setWorkMapCapability,
  type WorkMapRecord,
} from "@/lib/work-maps/crud";

export {
  createMediaAsset,
  getMediaAsset,
  type MediaAsset,
} from "@/lib/work-maps/media-assets";
