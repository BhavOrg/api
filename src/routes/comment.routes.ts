import { Router } from "express";
import * as commentController from "../controllers/comment.controller";
import { authenticateUser } from "../middleware/auth.middleware";
import { validateRequest } from "../middleware/validation.middleware";

const router = Router();

// Public routes
router.get("/:commentId", commentController.getComment);

router.get("/post/:postId", commentController.getPostComments);

// Protected routes (require authentication)
router.post(
  "/post/:postId",
  authenticateUser,
  validateRequest({
    body: {
      content: { type: "string", required: true, min: 1 },
      parentCommentId: { type: "string", optional: true },
      isAnonymous: { type: "boolean", optional: true },
      isExpertResponse: { type: "boolean", optional: true },
    },
  }),
  commentController.createComment
);

router.put(
  "/:commentId",
  authenticateUser,
  validateRequest({
    body: {
      content: { type: "string", required: true, min: 1 },
    },
  }),
  commentController.updateComment
);

router.delete("/:commentId", authenticateUser, commentController.deleteComment);

router.post(
  "/:commentId/vote",
  authenticateUser,
  validateRequest({
    body: {
      voteType: { type: "string", required: true, enum: ["up", "down"] },
    },
  }),
  commentController.voteOnComment
);

// Export the router as default
export default router;
