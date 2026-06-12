/**
 * SPEC-D2-003 — Binding write-path validation (Amendment A4)
 *
 * MUST run on seed / admin save — NOT at orchestrator runtime.
 */

import { FIELD_REGISTRY } from "@/lib/ai/field-registry";

export class BindingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BindingValidationError";
  }
}

/**
 * Each field MUST exist in field-registry with copilot_route === "fact".
 */
export function validateBindingFields(applicableFields: string[]): void {
  if (applicableFields.length === 0) {
    throw new BindingValidationError("applicable_fields must not be empty");
  }

  const seen = new Set<string>();
  for (const field of applicableFields) {
    if (seen.has(field)) {
      throw new BindingValidationError(`duplicate applicable field: ${field}`);
    }
    seen.add(field);

    let found = false;
    for (const entityType of Object.keys(FIELD_REGISTRY) as Array<
      keyof typeof FIELD_REGISTRY
    >) {
      const meta = FIELD_REGISTRY[entityType][field];
      if (meta?.copilot_route === "fact") {
        found = true;
        break;
      }
    }

    if (!found) {
      throw new BindingValidationError(
        `applicable field "${field}" is not a registered fact-route field`
      );
    }
  }
}
