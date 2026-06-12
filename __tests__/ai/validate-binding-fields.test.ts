/**
 * Unit tests — lib/ai/validate-binding-fields.ts
 */

import { describe, it, expect } from "vitest";
import {
  validateBindingFields,
  BindingValidationError,
} from "@/lib/ai/validate-binding-fields";

describe("validateBindingFields", () => {
  it("accepts Phase 1 seed applicable_fields={house}", () => {
    expect(() => validateBindingFields(["house"])).not.toThrow();
  });

  it("rejects empty applicable_fields", () => {
    expect(() => validateBindingFields([])).toThrow(BindingValidationError);
  });

  it("rejects unregistered fact field", () => {
    expect(() => validateBindingFields(["allegiance"])).toThrow(
      BindingValidationError
    );
  });

  it("rejects narrative-only field", () => {
    expect(() => validateBindingFields(["description"])).toThrow(
      BindingValidationError
    );
  });

  it("rejects duplicate fields", () => {
    expect(() => validateBindingFields(["house", "house"])).toThrow(
      BindingValidationError
    );
  });
});
