export interface Notification {
  notification_id: string;
  recipient_id: string;
  notification_type:
    | "comment"
    | "upvote"
    | "expertResponse"
    | "mention"
    | "system"
    | "alert";
  message: string;
  related_post_id: string | null;
  related_comment_id: string | null;
  is_read: boolean;
  priority: "low" | "medium" | "high" | "urgent";
  created_at: Date;
}

export interface NotificationResponse {
  notification_id: string;
  notification_type: string;
  message: string;
  related_post_id: string | null;
  related_comment_id: string | null;
  is_read: boolean;
  priority: string;
  created_at: string;
}

export interface NotificationsResponse {
  notifications: NotificationResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  unreadCount: number;
}
