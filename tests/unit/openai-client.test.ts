import { afterEach, describe, expect, it } from "vitest";

import { getOpenAIModel, getServerOpenAIConfig } from "@/lib/adapters/ai/openai-client";

const originalOpenAIModel = process.env.OPENAI_MODEL;
const originalOpenAIApiKey = process.env.OPENAI_API_KEY;

const restoreEnv = (name: "OPENAI_MODEL" | "OPENAI_API_KEY", value: string | undefined) => {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
};

afterEach(() => {
  restoreEnv("OPENAI_MODEL", originalOpenAIModel);
  restoreEnv("OPENAI_API_KEY", originalOpenAIApiKey);
});

describe("server OpenAI configuration", () => {
  it("reads the configured model from OPENAI_MODEL", () => {
    process.env.OPENAI_MODEL = "gpt-test-model";
    process.env.OPENAI_API_KEY = "test-key";

    expect(getServerOpenAIConfig()).toEqual({ apiKey: "test-key", model: "gpt-test-model" });
    expect(getOpenAIModel()).toBe("gpt-test-model");
  });

  it("fails clearly when live extraction has no configured model", () => {
    delete process.env.OPENAI_MODEL;

    expect(() => getServerOpenAIConfig()).toThrow("OPENAI_MODEL is required for live OpenAI quote extraction");
  });
});
