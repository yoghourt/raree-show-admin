/**
 * Validates and documents Phase 1 seed bindings (run after SQL migration).
 *
 * Usage: npx tsx scripts/seed-source-registry.ts
 */

import { validateBindingFields } from "../lib/ai/validate-binding-fields";

const PHASE1_BINDINGS = [
  {
    bindingId: "asoiaf-awoiaf-house",
    applicableFields: ["house"],
  },
];

function main() {
  for (const binding of PHASE1_BINDINGS) {
    validateBindingFields(binding.applicableFields);
    console.log(`OK: ${binding.bindingId} → [${binding.applicableFields.join(", ")}]`);
  }
  console.log("All Phase 1 bindings validated.");
}

main();
