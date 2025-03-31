import { Request, Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../types/request.types";
import { ApiError } from "../types/request.types";
import * as postModel from "../models/post.model";
import { query } from "../config/database";
import { analyzeSentiment } from "../services/sentiment.service";

/**
 * Create a new post
 */
export const createPost = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new ApiError("Not authenticated", 401);
    }

    const { content, isAnonymous = true, tags } = req.body;

    // Create the post
    const post = await postModel.createPost({
      authorId: req.user.user_id,
      content,
      isAnonymous,
      tags,
    });

    // Analyze sentiment asynchronously
    // This will not block the response
    analyzeSentiment(post.post_id, content)
      .then((result) => {
        console.log(`Sentiment analysis completed for post ${post.post_id}`);
      })
      .catch((error) => {
        console.error(
          `Error analyzing sentiment for post ${post.post_id}:`,
          error
        );
      });

    res.status(201).json({
      status: "success",
      message: "Post created successfully",
      data: {
        post: {
          ...post,
          author_username: isAnonymous ? null : post.author_username,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get post by ID
 */
export const getPost = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { postId } = req.params;
    const userId = (req as AuthenticatedRequest).user?.user_id;

    const post = await postModel.getPostById(postId);

    if (post.status !== "active") {
      throw new ApiError("Post not found or has been removed", 404);
    }

    // If the post is anonymous, hide the author's username
    if (post.is_anonymous) {
      post.author_username = null;
    }

    // Get the user's vote on this post if logged in
    let userVote = null;
    if (userId) {
      const votes = await postModel.getUserVotesForPosts(userId, [postId]);
      userVote = votes[postId] || null;
    }

    res.status(200).json({
      status: "success",
      data: {
        post: {
          ...post,
          user_vote: userVote,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update a post
 */
export const updatePost = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new ApiError("Not authenticated", 401);
    }

    const { postId } = req.params;
    const { content, urgencyLevel, status, tags } = req.body;

    // Verify post ownership
    const post = await postModel.getPostById(postId);

    if (post.author_id !== req.user.user_id) {
      throw new ApiError("You are not authorized to update this post", 403);
    }

    // Update the post
    const updatedPost = await postModel.updatePost(postId, {
      content,
      urgencyLevel,
      status,
      tags,
    });

    // If content was updated, re-analyze sentiment
    if (content) {
      analyzeSentiment(postId, content)
        .then((result) => {
          console.log(`Sentiment analysis updated for post ${postId}`);
        })
        .catch((error) => {
          console.error(`Error updating sentiment for post ${postId}:`, error);
        });
    }

    // If post is anonymous, hide author username
    if (updatedPost.is_anonymous) {
      updatedPost.author_username = null;
    }

    // Get the user's vote on this post
    const votes = await postModel.getUserVotesForPosts(req.user.user_id, [
      postId,
    ]);
    const userVote = votes[postId] || null;

    res.status(200).json({
      status: "success",
      message: "Post updated successfully",
      data: {
        post: {
          ...updatedPost,
          user_vote: userVote,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a post
 */
export const deletePost = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new ApiError("Not authenticated", 401);
    }

    const { postId } = req.params;

    // Verify post ownership
    const post = await postModel.getPostById(postId);

    if (post.author_id !== req.user.user_id) {
      throw new ApiError("You are not authorized to delete this post", 403);
    }

    // Delete the post
    await postModel.deletePost(postId);

    res.status(200).json({
      status: "success",
      message: "Post deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get posts for feed with filtering and pagination
 */
export const getFeed = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as AuthenticatedRequest).user?.user_id;

    // Extract query parameters
    const {
      tags,
      urgencyLevel,
      withExpertResponse,
      sortBy = "created_at",
      sortOrder = "desc",
      page = 1,
      limit = 10,
    } = req.query;

    // Parse tags from comma-separated string if needed
    const parsedTags =
      typeof tags === "string" ? tags.split(",") : (tags as string[]) || [];

    // Parse boolean parameters
    const parsedWithExpert =
      withExpertResponse === "true"
        ? true
        : withExpertResponse === "false"
        ? false
        : undefined;

    // Get posts
    const { posts, total } = await postModel.getFeedPosts({
      userId,
      tags: parsedTags,
      urgencyLevel: urgencyLevel as string,
      withExpertResponse: parsedWithExpert,
      sortBy: sortBy as "created_at" | "upvotes" | "comment_count",
      sortOrder: sortOrder as "asc" | "desc",
      page: Number(page),
      limit: Number(limit),
    });

    // Process posts for anonymous content and get user votes if logged in
    const processedPosts = posts.map((post) => {
      // For anonymous posts, remove author information
      if (post.is_anonymous) {
        post.author_username = null;
      }
      return post;
    });

    // If user is logged in, get their votes for these posts
    if (userId && processedPosts.length > 0) {
      const postIds = processedPosts.map((post) => post.post_id);
      const userVotes = await postModel.getUserVotesForPosts(userId, postIds);

      // Add user's vote to each post
      processedPosts.forEach((post) => {
        post["user_vote"] = userVotes[post.post_id] || null;
      });
    }

    // Calculate total pages
    const totalPages = Math.ceil(total / Number(limit));

    res.status(200).json({
      status: "success",
      data: {
        posts: processedPosts,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Vote on a post
 */
export const voteOnPost = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new ApiError("Not authenticated", 401);
    }

    const { postId } = req.params;
    const { voteType } = req.body;

    if (voteType !== "up" && voteType !== "down") {
      throw new ApiError("Invalid vote type. Must be 'up' or 'down'", 400);
    }

    // Register vote
    const updatedPost = await postModel.voteOnPost(
      postId,
      req.user.user_id,
      voteType
    );

    // If post is anonymous, hide author username
    if (updatedPost.is_anonymous) {
      updatedPost.author_username = null;
    }

    // Get the user's updated vote
    const votes = await postModel.getUserVotesForPosts(req.user.user_id, [
      postId,
    ]);
    const userVote = votes[postId] || null;

    res.status(200).json({
      status: "success",
      message: `Vote ${userVote ? "registered" : "removed"} successfully`,
      data: {
        post: {
          ...updatedPost,
          user_vote: userVote,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get popular tags with post counts
 */
/**
 * Get popular tags with post counts
 */
export const getPopularTags = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Use the imported query function directly from database config
    const result = await query(
      `SELECT t.name, COUNT(pt.post_id) as post_count
         FROM tags t
         JOIN post_tags pt ON t.tag_id = pt.tag_id
         JOIN posts p ON pt.post_id = p.post_id
         WHERE p.status = 'active'
         GROUP BY t.name
         ORDER BY post_count DESC
         LIMIT 20`
    );

    res.status(200).json({
      status: "success",
      data: {
        tags: result.rows,
      },
    });
  } catch (error) {
    next(error);
  }
};
