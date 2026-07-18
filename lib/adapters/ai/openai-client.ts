import OpenAI from "openai";

export const getOpenAIModel = () => process.env.OPENAI_MODEL ?? "gpt-4.1-mini";

export const createOpenAIClient = () => new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export type OpenAIResponsesClient = Pick<OpenAI, "responses">;
