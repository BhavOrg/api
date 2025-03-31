import { Router } from "express";
import * as postController from "../controllers/post.controller";
import { authenticateUser } from "../middleware/auth.middleware";
import { validateRequest } from "../middleware/validation.middleware";

const router = Router();

// Public routes
router.get("/feed", postController.getFeed);

router.get("/tags/popular", postController.getPopularTags);

router.get("/:postId", postController.getPost);

// Protected routes (require authentication)
router.post(
  "/",
  authenticateUser,
  validateRequest({
    body: {
      content: { type: "string", required: true, min: 1 },
      isAnonymous: { type: "boolean", optional: true },
      tags: { type: "array", optional: true },
    },
  }),
  postController.createPost
);

router.put(
  "/:postId",
  authenticateUser,
  validateRequest({
    body: {
      content: { type: "string", optional: true, min: 1 },
      urgencyLevel: {
        type: "string",
        optional: true,
        enum: ["low", "medium", "high", "critical"],
      },
      status: {
        type: "string",
        optional: true,
        enum: ["active", "moderated", "deleted"],
      },
      tags: { type: "array", optional: true },
    },
  }),
  postController.updatePost
);

router.delete("/:postId", authenticateUser, postController.deletePost);

router.post(
  "/:postId/vote",
  authenticateUser,
  validateRequest({
    body: {
      voteType: { type: "string", required: true, enum: ["up", "down"] },
    },
  }),
  postController.voteOnPost
);

export default router;
