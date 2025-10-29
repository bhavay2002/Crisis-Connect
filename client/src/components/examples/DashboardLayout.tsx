import DashboardLayout from '../DashboardLayout';

export default function DashboardLayoutExample() {
  return (
    <DashboardLayout>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Dashboard Content</h1>
        <p className="text-muted-foreground">
          This is where the main dashboard content will appear.
        </p>
      </div>
    </DashboardLayout>
  );
}
