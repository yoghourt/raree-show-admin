export type {
  AuthorityBindStatus,
  AuthorityInspection,
  CanonNecessity,
  RequiredUnitAuthorityContext,
  StoryBind,
  WorkCanon,
  WorkCanonUnit,
} from "./types";

export {
  AUTHORITY_BIND_INCOMPLETE,
  authorityBindIncomplete,
} from "./accept-guard";

export {
  authorityForSingleStory,
  inspectAuthority,
  requiredCanonIds,
  resolveStoryClaimedUnits,
  workCanonFromRequiredClaims,
} from "./resolve";
