import OpenAI from "openai";

export type ServerOpenAIConfig = {
  apiKey?: string;
  model: string;
};

const readRequiredServerEnv = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required for live OpenAI quote extraction. Set ${name} in the server environment before starting the app.`);
  }
  return value;
};

export const getServerOpenAIConfig = (): ServerOpenAIConfig => ({
  apiKey: process.env.OPENAI_API_KEY,
  model: readRequiredServerEnv("OPENAI_MODEL"),
});

export const getOpenAIModel = () => getServerOpenAIConfig().model;

export const createOpenAIClient = () => {
  const { apiKey } = getServerOpenAIConfig();
  return new OpenAI({ apiKey });
};

export type OpenAIResponsesClient = Pick<OpenAI, "responses">;
