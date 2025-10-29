import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Info, CheckCircle, XCircle, X } from "lucide-react";

interface AlertBannerProps {
  type: "critical" | "warning" | "info" | "success";
  title: string;
  message: string;
  onDismiss?: () => void;
  action?: {
    label: string;
    onClick: () => void;
  };
}

const alertConfig = {
  critical: {
    icon: AlertTriangle,
    className: "border-l-4 border-l-destructive bg-destructive/10",
  },
  warning: {
    icon: AlertTriangle,
    className: "border-l-4 border-l-yellow-500 bg-yellow-500/10",
  },
  info: {
    icon: Info,
    className: "border-l-4 border-l-primary bg-primary/10",
  },
  success: {
    icon: CheckCircle,
    className: "border-l-4 border-l-green-500 bg-green-500/10",
  },
};

export default function AlertBanner({
  type,
  title,
  message,
  onDismiss,
  action,
}: AlertBannerProps) {
  const config = alertConfig[type];
  const Icon = config.icon;

  return (
    <Alert className={config.className} data-testid={`alert-${type}`}>
      <Icon className="h-5 w-5" />
      <div className="flex-1">
        <AlertTitle className="font-semibold">{title}</AlertTitle>
        <AlertDescription className="mt-1">{message}</AlertDescription>
        {action && (
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={action.onClick}
            data-testid="button-alert-action"
          >
            {action.label}
          </Button>
        )}
      </div>
      {onDismiss && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 absolute top-3 right-3"
          onClick={onDismiss}
          data-testid="button-dismiss-alert"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </Alert>
  );
}
