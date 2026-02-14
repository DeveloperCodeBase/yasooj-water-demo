import React from "react";
import { ErrorBoundaryPage } from "../pages/ErrorBoundaryPage";

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: unknown | null }> {
  state: { error: unknown | null } = { error: null };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  componentDidCatch(error: unknown, info: unknown) {
    // Keep a trace in the console for debugging (demo).
    // eslint-disable-next-line no-console
    console.error("UI error boundary caught an error", error, info);
  }

  render() {
    if (this.state.error) {
      return <ErrorBoundaryPage error={this.state.error} onReset={() => this.setState({ error: null })} />;
    }
    return this.props.children;
  }
}

