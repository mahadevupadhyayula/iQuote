"use server";

import {
  applyRepCorrections as applyRepCorrectionsAction,
  continueQuoteConfiguration as continueQuoteConfigurationAction,
  createQuoteDraft as createQuoteDraftAction,
  extractAndBuildQuote as extractAndBuildQuoteAction,
  generateQuote as generateQuoteAction,
  saveQuoteDraft as saveQuoteDraftAction,
  reviseRejectedQuote as reviseRejectedQuoteAction,
  selectFulfillment as selectFulfillmentAction,
  resolveQuoteLineSelection as resolveQuoteLineSelectionAction,
  sendQuote as sendQuoteAction,
  submitQuoteForApproval as submitQuoteForApprovalAction,
} from "@/lib/actions/quote-actions";
import type {
  ApplyRepCorrectionsActionInput,
  ContinueQuoteConfigurationActionInput,
  CreateQuoteDraftActionInput,
  ExtractAndBuildQuoteActionInput,
  GenerateQuoteActionInput,
  SaveQuoteDraftActionInput,
  ReviseRejectedQuoteActionInput,
  SelectFulfillmentActionInput,
  ResolveQuoteLineSelectionActionInput,
  SendQuoteActionInput,
  SubmitQuoteForApprovalActionInput,
} from "@/lib/schemas/quote-action-schemas";

export async function applyRepCorrections(input: ApplyRepCorrectionsActionInput) {
  return applyRepCorrectionsAction(input);
}

export async function continueQuoteConfiguration(input: ContinueQuoteConfigurationActionInput) {
  return continueQuoteConfigurationAction(input);
}

export async function createQuoteDraft(input: CreateQuoteDraftActionInput) {
  return createQuoteDraftAction(input);
}

export async function extractAndBuildQuote(input: ExtractAndBuildQuoteActionInput) {
  return extractAndBuildQuoteAction(input);
}

export async function generateQuote(input: GenerateQuoteActionInput) {
  return generateQuoteAction(input);
}

export async function saveQuoteDraft(input: SaveQuoteDraftActionInput) {
  return saveQuoteDraftAction(input);
}

export async function selectFulfillment(input: SelectFulfillmentActionInput) {
  return selectFulfillmentAction(input);
}

export async function resolveQuoteLineSelection(input: ResolveQuoteLineSelectionActionInput) {
  return resolveQuoteLineSelectionAction(input);
}

export async function sendQuote(input: SendQuoteActionInput) {
  return sendQuoteAction(input);
}

export async function submitQuoteForApproval(input: SubmitQuoteForApprovalActionInput) {
  return submitQuoteForApprovalAction(input);
}

export async function reviseRejectedQuote(input: ReviseRejectedQuoteActionInput) {
  return reviseRejectedQuoteAction(input);
}
