import { query } from "../config/database";
import { Notification } from "../types/notification.types";

/**
 * Create a notification
 */
export const createNotification = async (notification: {
  recipientId: string;
  notificationType: string;
  message: string;
  relatedPostId?: string;
  relatedCommentId?: string;
  priority?: string;
}): Promise<Notification> => {
  const {
    recipientId,
    notificationType,
    message,
    relatedPostId,
    relatedCommentId,
    priority = "low",
  } = notification;

  const result = await query(
    `INSERT INTO notifications 
     (recipient_id, notification_type, message, related_post_id, related_comment_id, priority) 
     VALUES ($1, $2, $3, $4, $5, $6) 
     RETURNING *`,
    [
      recipientId,
      notificationType,
      message,
      relatedPostId || null,
      relatedCommentId || null,
      priority,
    ]
  );

  return result.rows[0] as Notification;
};

/**
 * Get notifications for a user with pagination
 */
export const getUserNotifications = async (
  userId: string,
  page = 1,
  limit = 20,
  unreadOnly = false
): Promise<{ notifications: Notification[]; total: number }> => {
  // Build query conditions
  const conditions = ["recipient_id = $1"];
  const queryParams = [userId];

  if (unreadOnly) {
    conditions.push("is_read = FALSE");
  }

  // Count total notifications
  const countQuery = `
    SELECT COUNT(*) 
    FROM notifications 
    WHERE ${conditions.join(" AND ")}
  `;

  const countResult = await query(countQuery, queryParams);
  const total = parseInt(countResult.rows[0].count);

  // Calculate pagination
  const offset = (page - 1) * limit;

  // Clone params and add pagination
  const paginatedParams = [...queryParams, limit, offset];

  // Query to get notifications
  const notificationsQuery = `
    SELECT * 
    FROM notifications 
    WHERE ${conditions.join(" AND ")}
    ORDER BY created_at DESC
    LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
  `;

  const notificationsResult = await query(notificationsQuery, paginatedParams);

  return {
    notifications: notificationsResult.rows as Notification[],
    total,
  };
};

/**
 * Get unread notification count for a user
 */
export const getUnreadNotificationCount = async (
  userId: string
): Promise<number> => {
  const result = await query(
    `SELECT COUNT(*) FROM notifications WHERE recipient_id = $1 AND is_read = FALSE`,
    [userId]
  );

  return parseInt(result.rows[0].count);
};

/**
 * Mark notifications as read
 */
export const markNotificationsAsRead = async (
  notificationIds: string[]
): Promise<void> => {
  if (notificationIds.length === 0) return;

  await query(
    `UPDATE notifications SET is_read = TRUE WHERE notification_id = ANY($1)`,
    [notificationIds]
  );
};

/**
 * Mark all notifications as read for a user
 */
export const markAllNotificationsAsRead = async (
  userId: string
): Promise<void> => {
  await query(
    `UPDATE notifications SET is_read = TRUE WHERE recipient_id = $1 AND is_read = FALSE`,
    [userId]
  );
};

/**
 * Delete notifications
 */
export const deleteNotifications = async (
  notificationIds: string[]
): Promise<void> => {
  if (notificationIds.length === 0) return;

  await query(`DELETE FROM notifications WHERE notification_id = ANY($1)`, [
    notificationIds,
  ]);
};

/**
 * Create a system notification for all users
 */
export const createSystemNotification = async (
  message: string,
  priority = "medium"
): Promise<void> => {
  // Get all active users
  const usersResult = await query(
    `SELECT user_id FROM users WHERE account_status = 'active'`
  );

  const userIds = usersResult.rows.map((row) => row.user_id);

  // Create notifications in batches to avoid overwhelming the database
  const batchSize = 100;
  for (let i = 0; i < userIds.length; i += batchSize) {
    const batch = userIds.slice(i, i + batchSize);
    const placeholders = batch.map((_, idx) => `($1, $2, $3, $4)`).join(", ");
    const params = [];

    for (const userId of batch) {
      params.push(userId, "system", message, priority);
    }

    await query(
      `INSERT INTO notifications 
       (recipient_id, notification_type, message, priority) 
       VALUES ${placeholders}`,
      params
    );
  }
};

/**
 * Create notifications for users with specific expertise based on post tags
 */
export const notifyExpertsByTags = async (
  postId: string,
  tags: string[],
  priority = "high"
): Promise<void> => {
  // This is a placeholder function - in a real implementation, you would
  // have a table mapping experts to their expertise areas (tags)

  // For now, we'll simulate by assuming there's an "experts" table with a many-to-many
  // relationship to tags through "expert_tags" (these tables would need to be created)

  /* 
  Example implementation assuming these tables exist:
  
  const expertsResult = await query(
    `SELECT DISTINCT e.user_id 
     FROM experts e
     JOIN expert_tags et ON e.expert_id = et.expert_id
     JOIN tags t ON et.tag_id = t.tag_id
     WHERE t.name = ANY($1)`,
    [tags]
  );
  
  const expertIds = expertsResult.rows.map(row => row.user_id);
  
  for (const expertId of expertIds) {
    await createNotification({
      recipientId: expertId,
      notificationType: 'expertRequired',
      message: 'A post requiring your expertise has been created',
      relatedPostId: postId,
      priority: priority
    });
  }
  */

  // For now, just log that we would notify experts
  console.log(
    `Would notify experts with tags ${tags.join(", ")} about post ${postId}`
  );
};
