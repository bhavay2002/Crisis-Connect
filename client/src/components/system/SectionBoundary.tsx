/**
 * SectionBoundary — in-place section-level error boundary.
 *
 * Unlike the app-level ErrorBoundary (which catches catastrophic crashes
 * and shows a full-page error), SectionBoundary wraps individual widgets
 * or sections and renders a compact error card IN-PLACE — the rest of
 * the page keeps working.
 *
 * This pattern is used by:
 *   - Datadog (individual dashboard widgets can fail independently)
 *   - Vercel (analytics panels fail gracefully without killing the page)
 *   - Linear (notification panel can crash without losing your board)
 *
 * Usage:
 *   <SectionBoundary label="Risk Analysis">
 *     <RiskChart />
 *   </SectionBoundary>
 */
import { Component, type ReactNode, type ErrorInfo } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  label?:   string;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error:    Error | null;
}

export class SectionBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.warn(`[SectionBoundary:${this.props.label ?? "unknown"}]`, error, info);
    }
  }

  handleReset = () => this.setState({ hasError: false, error: null });

  render() {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 flex items-start gap-3">
        <div className="w-7 h-7 rounded-lg bg-destructive/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">
            {this.props.label ? `${this.props.label} failed` : "Section failed to load"}
          </p>
          {import.meta.env.DEV && this.state.error && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate font-mono">
              {this.state.error.message}
            </p>
          )}
        </div>
        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs flex-shrink-0" onClick={this.handleReset}>
          <RefreshCw className="w-3 h-3 mr-1" />Retry
        </Button>
      </div>
    );
  }
}
