import { describe, it, expect } from "vitest";

import {
  parseBatchCopilotValues,
  parseCopilotFieldValue,
} from "@/lib/ai/parse-copilot-value";

describe("parseCopilotFieldValue", () => {
  it("parses valid JSON object", () => {
    expect(parseCopilotFieldValue('{"value": "叶文洁是物理学家"}')).toBe(
      "叶文洁是物理学家"
    );
  });

  it("parses empty value for inapplicable fields", () => {
    expect(parseCopilotFieldValue('{"value": ""}')).toBe("");
    expect(parseCopilotFieldValue(`{"value': ''}`)).toBe("");
  });

  it("salvages broken free-model JSON via regex", () => {
    expect(
      parseCopilotFieldValue(`{"value"}]}}{"value': ''}`)
    ).toBe("");
  });

  it("accepts plain text when not JSON-shaped", () => {
    expect(parseCopilotFieldValue("A short biography.")).toBe(
      "A short biography."
    );
  });

  it("throws on unrecoverable JSON garbage", () => {
    expect(() => parseCopilotFieldValue('{"value"}]}}{"broken')).toThrow(
      "模型返回格式无效"
    );
  });

  it("parses batch multi-field JSON", () => {
    const raw = JSON.stringify({
      house: "",
      description: "物理学家",
      signatureQuote: "这是人类的落日……",
    });
    const result = parseBatchCopilotValues(raw, [
      "house",
      "description",
      "signatureQuote",
    ]);
    expect(result.house).toBe("");
    expect(result.description).toBe("物理学家");
    expect(result.signatureQuote).toBe("这是人类的落日……");
  });
});
