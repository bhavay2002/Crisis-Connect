import StatsCard from '../StatsCard';
import { AlertTriangle } from 'lucide-react';

export default function StatsCardExample() {
  return (
    <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatsCard
        title="Active Reports"
        value={42}
        icon={AlertTriangle}
        description="Pending verification"
        trend={{ value: "12%", isPositive: false }}
      />
    </div>
  );
}
