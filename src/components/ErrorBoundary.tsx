import React from "react";

/** Last-resort boundary: keeps a broken render from silently blanking the app. */
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("App crashed:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, color: "#3D1B2E", fontFamily: "sans-serif" }}>
          <h1 style={{ fontSize: 20 }}>Что-то сломалось</h1>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, marginTop: 12 }}>
            {this.state.error.message}
            {"\n\n"}
            {this.state.error.stack}
          </pre>
          <button
            onClick={() => {
              this.setState({ error: null });
              location.href = "/";
            }}
            style={{ marginTop: 16, padding: "10px 20px", borderRadius: 999 }}
          >
            Перезапустить
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
