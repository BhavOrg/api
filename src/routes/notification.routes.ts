import { Router } from "express";
import * as notificationController from "../controllers/notification.controller";
import { authenticateUser } from "../middleware/auth.middleware";
import { validateRequest } from "../middleware/validation.middleware";

const router = Router();

// All notification routes require authentication
router.use(authenticateUser);

// Get notifications
router.get("/", notificationController.getUserNotifications);

// Mark specific notifications as read
router.post(
  "/read",
  validateRequest({
    body: {
      notificationIds: { type: "array", required: true },
    },
  }),
  notificationController.markNotificationsAsRead
);

// Mark all notifications as read
router.post("/read-all", notificationController.markAllNotificationsAsRead);

// Delete notifications
router.post(
  "/delete",
  validateRequest({
    body: {
      notificationIds: { type: "array", required: true },
    },
  }),
  notificationController.deleteNotifications
);

export default router;
