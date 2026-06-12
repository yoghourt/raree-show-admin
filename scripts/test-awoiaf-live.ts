/**
 * Quick live check for AWOIAF MediaWiki API.
 * Loads `.env.local` automatically (same vars as `npm run dev`).
 *
 * Architect ruling: local HTTP 403 is expected when Cloudflare blocks server egress.
 * Tier-1 live validation — Staging/Production (SPEC-D2-003 §8.2).
 *
 * Usage: npm run test:awoiaf -- "Arya Stark"
 */

import { loadEnvLocal } from "./load-env-local";
import { liveAwoiafRetrieve } from "../lib/ai/connectors/awoiaf-connector";

loadEnvLocal();

async function main() {
  const title = process.argv[2]?.trim() || "Arya_Stark";
  const scope = title.replace(/_/g, " ");

  console.log("Live AWOIAF connector test (no cookie bypass — Architect Ruling D2-003)");
  console.log("scope:", scope);

  const result = await liveAwoiafRetrieve({
    entityType: "character",
    scopeFieldValue: scope,
    profile: {
      profileId: "asoiaf-profile",
      kind: "public_franchise",
      displayName: "ASOIAF",
      workPattern: "asoiaf",
      tier2Enabled: true,
      createdAt: "",
      updatedAt: "",
    },
    connectorId: "awoiaf",
    baseUrl: "https://awoiaf.westeros.org",
  });

  console.log("\nitems:", result.items.length);
  console.log("diagnostics:", result.diagnostics);
  if (result.items[0]) {
    console.log("excerpt preview:", result.items[0].excerpt.slice(0, 200));
  } else if (result.diagnostics.some((d) => d.message.includes("403"))) {
    console.log(
      "\nLocal 403 is not an architectural defect. Use mock locally or validate Tier-1 green in Staging."
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
