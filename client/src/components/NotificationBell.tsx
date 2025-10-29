import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Bell, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";
import { Link } from "wouter";

interface Notification {
  id: string;
  userId: string;
  type: string;
  priority: "low" | "medium" | "high" | "critical";
  title: string;
  message: string;
  actionUrl: string | null;
  relatedEntityId: string | null;
  relatedEntityType: string | null;
  metadata: any;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);

  const { data: unreadCount = 0 } = useQuery<number>({
    queryKey: ["/api/notifications/unread/count"],
    refetchInterval: 30000,
  });

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["/api/notifications/unread"],
    enabled: open,
  });

  const markAsReadMutation = useMutation({
    mutationFn: (notificationId: string) =>
      apiRequest(`/api/notifications/${notificationId}/read`, "PATCH", {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread/count"] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: () => apiRequest("/api/notifications/mark-all-read", "PATCH", {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread/count"] });
    },
  });

  const deleteNotificationMutation = useMutation({
    mutationFn: (notificationId: string) =>
      apiRequest(`/api/notifications/${notificationId}`, "DELETE", {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread/count"] });
    },
  });

  useEffect(() => {
    const handleNewNotification = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "new_notification") {
          queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
          queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread"] });
          queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread/count"] });
        }
      } catch (error) {
        console.error("Error handling WebSocket message:", error);
      }
    };

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = handleNewNotification;

    return () => {
      ws.close();
    };
  }, []);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "critical":
        return "bg-red-100 dark:bg-red-900 border-red-500 dark:border-red-600";
      case "high":
        return "bg-orange-100 dark:bg-orange-900 border-orange-500 dark:border-orange-600";
      case "medium":
        return "bg-yellow-100 dark:bg-yellow-900 border-yellow-500 dark:border-yellow-600";
      default:
        return "bg-blue-100 dark:bg-blue-900 border-blue-500 dark:border-blue-600";
    }
  };

  const getPriorityBadgeVariant = (priority: string) => {
    switch (priority) {
      case "critical":
        return "destructive";
      case "high":
        return "destructive";
      case "medium":
        return "default";
      default:
        return "secondary";
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markAsReadMutation.mutate(notification.id);
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          data-testid="button-notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
              data-testid="badge-notification-count"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end" data-testid="popover-notifications">
        <div className="flex items-center justify-between p-4 border-b border-border dark:border-border">
          <h3 className="font-semibold text-base">Notifications</h3>
          {notifications.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllAsReadMutation.mutate()}
              disabled={markAllAsReadMutation.isPending}
              data-testid="button-mark-all-read"
            >
              <Check className="h-4 w-4 mr-2" />
              Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="h-[400px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground dark:text-muted-foreground">
              <Bell className="h-12 w-12 mb-2 opacity-50" />
              <p className="text-sm" data-testid="text-no-notifications">No new notifications</p>
            </div>
          ) : (
            <div className="divide-y divide-border dark:divide-border">
              {notifications.map((notification, index) => (
                <div
                  key={notification.id}
                  className={`p-4 hover:bg-accent dark:hover:bg-accent transition-colors cursor-pointer border-l-4 ${getPriorityColor(
                    notification.priority
                  )}`}
                  data-testid={`notification-item-${index}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm text-foreground dark:text-foreground">
                          {notification.title}
                        </p>
                        <Badge
                          variant={getPriorityBadgeVariant(notification.priority) as any}
                          className="text-xs"
                          data-testid={`badge-priority-${notification.id}`}
                        >
                          {notification.priority}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground dark:text-muted-foreground">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground dark:text-muted-foreground">
                        {formatDistanceToNow(new Date(notification.createdAt), {
                          addSuffix: true,
                        })}
                      </p>
                      {notification.actionUrl && (
                        <Link
                          href={notification.actionUrl}
                          onClick={() => handleNotificationClick(notification)}
                        >
                          <button
                            className="p-0 h-auto text-sm text-primary dark:text-primary hover:underline"
                            data-testid={`button-view-${notification.id}`}
                          >
                            View Details →
                          </button>
                        </Link>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 flex-shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotificationMutation.mutate(notification.id);
                      }}
                      data-testid={`button-delete-${notification.id}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        {notifications.length > 0 && (
          <>
            <Separator />
            <div className="p-2">
              <Link href="/notifications" onClick={() => setOpen(false)}>
                <Button
                  variant="ghost"
                  className="w-full"
                  data-testid="button-view-all"
                >
                  View All Notifications
                </Button>
              </Link>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
