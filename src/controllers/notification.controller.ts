import { Request, Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../types/request.types";
import { ApiError } from "../types/request.types";
import * as notificationModel from "../models/notification.model";

/**
 * Get notifications for the authenticated user
 */
export const getUserNotifications = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new ApiError("Not authenticated", 401);
    }

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const unreadOnly = req.query.unreadOnly === "true";

    // Get notifications
    const { notifications, total } =
      await notificationModel.getUserNotifications(
        req.user.user_id,
        page,
        limit,
        unreadOnly
      );

    // Get unread count
    const unreadCount = await notificationModel.getUnreadNotificationCount(
      req.user.user_id
    );

    // Calculate total pages
    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      status: "success",
      data: {
        notifications,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
        unreadCount,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark notifications as read
 */
export const markNotificationsAsRead = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new ApiError("Not authenticated", 401);
    }

    const { notificationIds } = req.body;

    if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
      throw new ApiError(
        "Invalid notificationIds. Must be a non-empty array",
        400
      );
    }

    // Mark notifications as read
    await notificationModel.markNotificationsAsRead(notificationIds);

    // Get updated unread count
    const unreadCount = await notificationModel.getUnreadNotificationCount(
      req.user.user_id
    );

    res.status(200).json({
      status: "success",
      message: "Notifications marked as read",
      data: {
        unreadCount,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark all notifications as read
 */
export const markAllNotificationsAsRead = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new ApiError("Not authenticated", 401);
    }

    // Mark all notifications as read
    await notificationModel.markAllNotificationsAsRead(req.user.user_id);

    res.status(200).json({
      status: "success",
      message: "All notifications marked as read",
      data: {
        unreadCount: 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete notifications
 */
export const deleteNotifications = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new ApiError("Not authenticated", 401);
    }

    const { notificationIds } = req.body;

    if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
      throw new ApiError(
        "Invalid notificationIds. Must be a non-empty array",
        400
      );
    }

    // Delete notifications
    await notificationModel.deleteNotifications(notificationIds);

    // Get updated unread count
    const unreadCount = await notificationModel.getUnreadNotificationCount(
      req.user.user_id
    );

    res.status(200).json({
      status: "success",
      message: "Notifications deleted",
      data: {
        unreadCount,
      },
    });
  } catch (error) {
    next(error);
  }
};
