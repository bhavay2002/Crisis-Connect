import AlertBanner from '../AlertBanner';

export default function AlertBannerExample() {
  return (
    <div className="p-6 space-y-4 max-w-2xl">
      <AlertBanner
        type="critical"
        title="Critical Emergency Alert"
        message="Major earthquake detected in downtown area. Seek shelter immediately."
        onDismiss={() => console.log("Alert dismissed")}
        action={{
          label: "View Details",
          onClick: () => console.log("View details clicked"),
        }}
      />
      <AlertBanner
        type="warning"
        title="Warning"
        message="Storm warning issued for your area. Expected in 2 hours."
        onDismiss={() => console.log("Alert dismissed")}
      />
    </div>
  );
}
