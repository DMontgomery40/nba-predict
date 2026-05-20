import { createAppLogger } from "@signal-console/shared";

export type ServiceLogger = {
  child: (bindings: Record<string, unknown>) => ServiceLogger;
  debug: (bindings: Record<string, unknown>, message?: string) => void;
  info: (bindings: Record<string, unknown>, message?: string) => void;
  warn: (bindings: Record<string, unknown>, message?: string) => void;
};

export type ServiceContext = {
  logger?: ServiceLogger;
};

export function createServiceLogger(component: string) {
  return createAppLogger({ component });
}

export function getLogger(
  baseLogger: ServiceLogger,
  context: ServiceContext | undefined,
  operation: string
) {
  return (context?.logger ?? baseLogger).child({ operation });
}

export function generatedMeta() {
  return {
    generatedAt: new Date().toISOString(),
  };
}
