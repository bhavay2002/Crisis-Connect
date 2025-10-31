import { Profiler, ProfilerOnRenderCallback, memo, useMemo, useCallback } from "react";

export interface PerformanceMetrics {
  id: string;
  phase: "mount" | "update";
  actualDuration: number;
  baseDuration: number;
  startTime: number;
  commitTime: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private maxMetrics: number = 100;
  private enabled: boolean = import.meta.env.DEV;

  enable(): void {
    this.enabled = true;
  }

  disable(): void {
    this.enabled = false;
  }

  onRender: ProfilerOnRenderCallback = (
    id,
    phase,
    actualDuration,
    baseDuration,
    startTime,
    commitTime
  ) => {
    if (!this.enabled) return;

    const metric: PerformanceMetrics = {
      id,
      phase,
      actualDuration,
      baseDuration,
      startTime,
      commitTime,
    };

    this.metrics.unshift(metric);
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.pop();
    }

    // Log slow renders
    if (actualDuration > 16) {
      console.warn(`[Performance] Slow ${phase}: ${id}`, {
        actualDuration: `${actualDuration.toFixed(2)}ms`,
        baseDuration: `${baseDuration.toFixed(2)}ms`,
      });
    }
  };

  getMetrics(): PerformanceMetrics[] {
    return this.metrics;
  }

  getSlowRenders(threshold: number = 16): PerformanceMetrics[] {
    return this.metrics.filter((m) => m.actualDuration > threshold);
  }

  getAverageDuration(componentId?: string): number {
    const relevantMetrics = componentId
      ? this.metrics.filter((m) => m.id === componentId)
      : this.metrics;

    if (relevantMetrics.length === 0) return 0;

    const sum = relevantMetrics.reduce((acc, m) => acc + m.actualDuration, 0);
    return sum / relevantMetrics.length;
  }

  clear(): void {
    this.metrics = [];
  }
}

export const performanceMonitor = new PerformanceMonitor();

interface PerformanceProfilerProps {
  id: string;
  children: React.ReactNode;
}

export function PerformanceProfiler({ id, children }: PerformanceProfilerProps) {
  return (
    <Profiler id={id} onRender={performanceMonitor.onRender}>
      {children}
    </Profiler>
  );
}

export { memo, useMemo, useCallback };
