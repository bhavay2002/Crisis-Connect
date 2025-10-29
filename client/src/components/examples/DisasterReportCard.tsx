import DisasterReportCard from '../DisasterReportCard';

export default function DisasterReportCardExample() {
  const mockReport = {
    id: "1",
    title: "Building Fire on Main Street",
    type: "fire" as const,
    severity: "critical" as const,
    location: "123 Main St, Downtown",
    description: "Large fire reported in commercial building. Multiple floors affected. Emergency services on scene.",
    timestamp: "15 minutes ago",
    verificationCount: 12,
    status: "verified" as const,
  };

  return (
    <div className="p-6 max-w-2xl">
      <DisasterReportCard
        report={mockReport}
        onVerify={() => console.log("Verify clicked")}
        onViewDetails={() => console.log("View details clicked")}
      />
    </div>
  );
}
