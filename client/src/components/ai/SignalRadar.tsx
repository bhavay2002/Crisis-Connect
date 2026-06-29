/**
 * SignalRadar — how different signals contributed to the AI decision.
 *
 * Shows the four signal fusion components on a radar chart.
 * Each axis = one signal source. The filled polygon = current report's profile.
 *
 * This pattern is used in fraud detection dashboards and risk scoring tools:
 * a multi-axis profile tells you *which* signals drove the decision.
 */
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Radar, ResponsiveContainer, Tooltip,
} from "recharts";

interface SignalData {
  signal: string;
  value: number; // 0–100
}

interface Props {
  components: {
    aiUrgency:       number;
    locationRisk:    number;
    repetitionScore: number;
    userTrustScore:  number;
  };
}

export function SignalRadar({ components }: Props) {
  const data: SignalData[] = [
    { signal: "AI Urgency",  value: Math.round(components.aiUrgency       * 100) },
    { signal: "Location",    value: Math.round(components.locationRisk     * 100) },
    { signal: "Repetition",  value: Math.round(components.repetitionScore  * 100) },
    { signal: "Trust",       value: Math.round(components.userTrustScore   * 100) },
  ];

  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Signal Fusion</p>
      <ResponsiveContainer width="100%" height={170}>
        <RadarChart data={data} margin={{ top: 4, right: 20, bottom: 4, left: 20 }}>
          <PolarGrid stroke="#334155" />
          <PolarAngleAxis
            dataKey="signal"
            tick={{ fontSize: 10, fill: "#94a3b8" }}
          />
          <PolarRadiusAxis
            domain={[0, 100]}
            tick={{ fontSize: 8, fill: "#64748b" }}
            axisLine={false}
            tickCount={4}
          />
          <Radar
            name="Signal"
            dataKey="value"
            stroke="#ef4444"
            fill="#ef4444"
            fillOpacity={0.25}
            strokeWidth={2}
            dot={{ r: 3, fill: "#ef4444" }}
          />
          <Tooltip
            contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8, fontSize: 11 }}
            formatter={(v: number) => [`${v}%`, "Score"]}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
