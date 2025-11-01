import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";
import { Link } from "wouter";
import { Bell, Check, Settings, Trash2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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

export default function Notifications() {
  const [activeTab, setActiveTab] = useState<"all" | "unread">("all");
  const { toast } = useToast();

  const { data: allNotifications = [], isLoading: isLoadingAll } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    enabled: activeTab === "all",
  });

  const { data: unreadNotifications = [], isLoading: isLoadingUnread } = useQuery<Notification[]>({
    queryKey: ["/api/notifications/unread"],
    enabled: activeTab === "unread",
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
      toast({
        title: "All notifications marked as read",
        description: "You're all caught up!",
      });
    },
  });

  const deleteNotificationMutation = useMutation({
    mutationFn: (notificationId: string) =>
      apiRequest(`/api/notifications/${notificationId}`, "DELETE", {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread/count"] });
      toast({
        title: "Notification deleted",
        description: "The notification has been removed.",
      });
    },
  });

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
      case "high":
        return "destructive";
      case "medium":
        return "default";
      default:
        return "secondary";
    }
  };

  const notifications = activeTab === "all" ? allNotifications : unreadNotifications;
  const isLoading = activeTab === "all" ? isLoadingAll : isLoadingUnread;

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground dark:text-foreground mb-2">
            Notifications
          </h1>
          <p className="text-muted-foreground dark:text-muted-foreground">
            Stay updated with all your alerts and updates
          </p>
        </div>
        <Link href="/notification-preferences">
          <Button variant="outline" data-testid="button-settings">
            <Settings className="h-4 w-4 mr-2" />
            Preferences
          </Button>
        </Link>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "all" | "unread")}>
        <div className="flex items-center justify-between mb-6">
          <TabsList data-testid="tabs-notifications">
            <TabsTrigger value="all" data-testid="tab-all">
              All
            </TabsTrigger>
            <TabsTrigger value="unread" data-testid="tab-unread">
              Unread {unreadNotifications.length > 0 && `(${unreadNotifications.length})`}
            </TabsTrigger>
          </TabsList>

          {notifications.length > 0 && activeTab === "unread" && (
            <Button
              variant="ghost"
              onClick={() => markAllAsReadMutation.mutate()}
              disabled={markAllAsReadMutation.isPending}
              data-testid="button-mark-all-read"
            >
              <Check className="h-4 w-4 mr-2" />
              Mark all read
            </Button>
          )}
        </div>

        <TabsContent value="all" className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground dark:text-muted-foreground">Loading notifications...</p>
              </div>
            </div>
          ) : notifications.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Bell className="h-16 w-16 text-muted-foreground dark:text-muted-foreground opacity-50 mb-4" />
                <h3 className="text-lg font-semibold mb-2">No notifications yet</h3>
                <p className="text-muted-foreground dark:text-muted-foreground text-sm text-center">
                  When you receive notifications, they'll appear here
                </p>
              </CardContent>
            </Card>
          ) : (
            notifications.map((notification, index) => (
              <Card
                key={notification.id}
                className={`border-l-4 transition-all ${getPriorityColor(notification.priority)} ${
                  !notification.isRead ? "bg-accent/50 dark:bg-accent/50" : ""
                }`}
                data-testid={`notification-card-${index}`}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-lg text-foreground dark:text-foreground">
                          {notification.title}
                        </h3>
                        <Badge
                          variant={getPriorityBadgeVariant(notification.priority) as any}
                          data-testid={`badge-priority-${notification.id}`}
                        >
                          {notification.priority}
                        </Badge>
                        {!notification.isRead && (
                          <Badge variant="outline" data-testid={`badge-unread-${notification.id}`}>
                            Unread
                          </Badge>
                        )}
                      </div>
                      <p className="text-muted-foreground dark:text-muted-foreground">
                        {notification.message}
                      </p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground dark:text-muted-foreground">
                        <span>
                          {formatDistanceToNow(new Date(notification.createdAt), {
                            addSuffix: true,
                          })}
                        </span>
                        {notification.readAt && (
                          <span>
                            Read {formatDistanceToNow(new Date(notification.readAt), {
                              addSuffix: true,
                            })}
                          </span>
                        )}
                      </div>
                      {notification.actionUrl && (
                        <Link href={notification.actionUrl}>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-2"
                            data-testid={`button-view-${notification.id}`}
                          >
                            View Details
                          </Button>
                        </Link>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      {!notification.isRead && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => markAsReadMutation.mutate(notification.id)}
                          disabled={markAsReadMutation.isPending}
                          data-testid={`button-mark-read-${notification.id}`}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteNotificationMutation.mutate(notification.id)}
                        disabled={deleteNotificationMutation.isPending}
                        data-testid={`button-delete-${notification.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="unread" className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground dark:text-muted-foreground">Loading unread notifications...</p>
              </div>
            </div>
          ) : notifications.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <AlertTriangle className="h-16 w-16 text-muted-foreground dark:text-muted-foreground opacity-50 mb-4" />
                <h3 className="text-lg font-semibold mb-2">All caught up!</h3>
                <p className="text-muted-foreground dark:text-muted-foreground text-sm text-center">
                  You have no unread notifications
                </p>
              </CardContent>
            </Card>
          ) : (
            notifications.map((notification, index) => (
              <Card
                key={notification.id}
                className={`border-l-4 transition-all ${getPriorityColor(notification.priority)} bg-accent/50 dark:bg-accent/50`}
                data-testid={`notification-card-${index}`}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-lg text-foreground dark:text-foreground">
                          {notification.title}
                        </h3>
                        <Badge
                          variant={getPriorityBadgeVariant(notification.priority) as any}
                          data-testid={`badge-priority-${notification.id}`}
                        >
                          {notification.priority}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground dark:text-muted-foreground">
                        {notification.message}
                      </p>
                      <p className="text-sm text-muted-foreground dark:text-muted-foreground">
                        {formatDistanceToNow(new Date(notification.createdAt), {
                          addSuffix: true,
                        })}
                      </p>
                      {notification.actionUrl && (
                        <Link href={notification.actionUrl}>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-2"
                            data-testid={`button-view-${notification.id}`}
                          >
                            View Details
                          </Button>
                        </Link>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => markAsReadMutation.mutate(notification.id)}
                        disabled={markAsReadMutation.isPending}
                        data-testid={`button-mark-read-${notification.id}`}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteNotificationMutation.mutate(notification.id)}
                        disabled={deleteNotificationMutation.isPending}
                        data-testid={`button-delete-${notification.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
