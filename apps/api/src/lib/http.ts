import {
  ValidationAppError,
  buildApiErrorEnvelope,
  formatValidationIssues,
  toAppError,
} from "@signal-console/shared";

import type { ZodTypeAny, output } from "zod";

export function parseWithSchema<TSchema extends ZodTypeAny>(
  schema: TSchema,
  input: unknown
): output<TSchema> {
  const result = schema.safeParse(input);
  if (result.success) {
    return result.data;
  }

  throw new ValidationAppError(formatValidationIssues(result.error.issues));
}

export function normalizeApiError(error: unknown, requestId?: string) {
  const appError = toAppError(error);

  return {
    appError,
    body: buildApiErrorEnvelope(appError, requestId),
  };
}
