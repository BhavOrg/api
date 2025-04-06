import { Router, Request, Response, NextFunction } from "express";
import * as tagService from "../services/tag.service";
import { validateRequest } from "../middleware/validation.middleware";
import { authenticateUser } from "../middleware/auth.middleware";

const router = Router();

// Get all tags
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const searchQuery = req.query.search as string | undefined;
    const limit = Number(req.query.limit) || 20;

    let tags;
    if (searchQuery) {
      tags = await tagService.searchTags(searchQuery, limit);
    } else {
      tags = await tagService.getPopularTags(limit);
    }

    res.status(200).json({
      status: "success",
      data: { tags },
    });
  } catch (error) {
    next(error);
  }
});

// Get popular tags
router.get(
  "/popular",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = Number(req.query.limit) || 20;
      const tags = await tagService.getPopularTags(limit);

      res.status(200).json({
        status: "success",
        data: { tags },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Search tags
router.get(
  "/search",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const searchQuery = req.query.q as string;
      const limit = Number(req.query.limit) || 10;

      if (!searchQuery) {
        res.status(400).json({
          status: "error",
          message: "Search query is required",
        });
        return; // Use separate return statement
      }

      const tags = await tagService.searchTags(searchQuery, limit);

      res.status(200).json({
        status: "success",
        data: { tags },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Create a new tag (requires auth)
router.post(
  "/",
  authenticateUser,
  validateRequest({
    body: {
      name: { type: "string", required: true },
    },
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name } = req.body;
      const tag = await tagService.createTag(name);

      res.status(201).json({
        status: "success",
        message: "Tag created successfully",
        data: { tag },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get related tags
router.get(
  "/:tagName/related",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tagName } = req.params;
      const limit = Number(req.query.limit) || 5;

      const tags = await tagService.getRelatedTags(tagName, limit);

      res.status(200).json({
        status: "success",
        data: { tags },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
