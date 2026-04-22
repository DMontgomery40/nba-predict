import { Component } from "react";

import { ErrorState } from "../components/ErrorState";
import { clientLogger } from "../lib/client-logger";

import type { ErrorInfo, ReactNode } from "react";

type ErrorBoundaryState = {
  error: Error | null;
};

export class ErrorBoundary extends Component<
  { children: ReactNode },
  ErrorBoundaryState
> {
  override state: ErrorBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: Error) {
    return {
      error,
    };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    clientLogger.error("react-error-boundary", {
      componentStack: errorInfo.componentStack,
      error: {
        message: error.message,
        name: error.name,
        stack: error.stack,
      },
    });
  }

  private handleReload = () => {
    window.location.reload();
  };

  override render() {
    if (this.state.error) {
      return (
        <div className="shell shell-fallback">
          <main className="workspace">
            <ErrorState
              actionLabel="Reload console"
              description="A render-time exception escaped the page boundary."
              error={this.state.error}
              onAction={this.handleReload}
              title="Console shell crashed"
            />
          </main>
        </div>
      );
    }

    return this.props.children;
  }
}
