import { Request, Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../types/request.types";
import { ApiError } from "../types/request.types";
import * as commentModel from "../models/comment.model";
import * as postModel from "../models/post.model";
import { Comment, CommentResponse } from "../types/comment.types";

/**
 * Create a new comment
 */
export const createComment = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new ApiError("Not authenticated", 401);
    }

    const { postId } = req.params;
    const {
      content,
      parentCommentId,
      isAnonymous = true,
      isExpertResponse = false,
    } = req.body;

    // Verify the post exists and is active
    const post = await postModel.getPostById(postId);
    if (post.status !== "active") {
      throw new ApiError("Post not found or has been removed", 404);
    }

    // Create the comment
    const comment = await commentModel.createComment({
      postId,
      authorId: req.user.user_id,
      content,
      parentCommentId,
      isAnonymous,
      isExpertResponse,
    });

    // If comment is anonymous, hide author username
    if (comment.is_anonymous) {
      comment.author_username = null;
    }

    res.status(201).json({
      status: "success",
      message: "Comment created successfully",
      data: {
        comment,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get a comment by ID
 */
export const getComment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { commentId } = req.params;
    const userId = (req as AuthenticatedRequest).user?.user_id;

    const comment = await commentModel.getCommentById(commentId);

    if (comment.status !== "active") {
      throw new ApiError("Comment not found or has been removed", 404);
    }

    // If the comment is anonymous, hide the author's username
    if (comment.is_anonymous) {
      comment.author_username = null;
    }

    // Get the user's vote on this comment if logged in
    let userVote = null;
    if (userId) {
      const votes = await commentModel.getUserVotesForComments(userId, [
        commentId,
      ]);
      userVote = votes[commentId] || null;
    }

    res.status(200).json({
      status: "success",
      data: {
        comment: {
          ...comment,
          user_vote: userVote,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update a comment
 */
export const updateComment = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new ApiError("Not authenticated", 401);
    }

    const { commentId } = req.params;
    const { content } = req.body;

    // Verify comment ownership
    const comment = await commentModel.getCommentById(commentId);

    if (comment.author_id !== req.user.user_id) {
      throw new ApiError("You are not authorized to update this comment", 403);
    }

    // Update the comment
    const updatedComment = await commentModel.updateComment(commentId, {
      content,
    });

    // If comment is anonymous, hide author username
    if (updatedComment.is_anonymous) {
      updatedComment.author_username = null;
    }

    // Get the user's vote on this comment
    const votes = await commentModel.getUserVotesForComments(req.user.user_id, [
      commentId,
    ]);
    const userVote = votes[commentId] || null;

    res.status(200).json({
      status: "success",
      message: "Comment updated successfully",
      data: {
        comment: {
          ...updatedComment,
          user_vote: userVote,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a comment
 */
export const deleteComment = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new ApiError("Not authenticated", 401);
    }

    const { commentId } = req.params;

    // Verify comment ownership
    const comment = await commentModel.getCommentById(commentId);

    if (comment.author_id !== req.user.user_id) {
      throw new ApiError("You are not authorized to delete this comment", 403);
    }

    // Delete the comment
    await commentModel.deleteComment(commentId);

    res.status(200).json({
      status: "success",
      message: "Comment deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Process comments into a threaded structure
 */
const processCommentThreads = (comments: Comment[]): CommentResponse[] => {
  const commentMap: Record<string, CommentResponse> = {};
  const rootComments: CommentResponse[] = [];

  // First pass: create a map of all comments and convert to response format
  comments.forEach((comment) => {
    const commentResponse: CommentResponse = {
      comment_id: comment.comment_id,
      post_id: comment.post_id,
      author_username: comment.author_username || null,
      parent_comment_id: comment.parent_comment_id,
      content: comment.content,
      upvotes: comment.upvotes,
      downvotes: comment.downvotes,
      is_expert_response: comment.is_expert_response,
      is_anonymous: comment.is_anonymous,
      created_at: comment.created_at.toISOString(),
      updated_at: comment.updated_at.toISOString(),
      user_vote: (comment as any).user_vote || null,
      replies: [],
    };

    commentMap[comment.comment_id] = commentResponse;
  });

  // Second pass: build the tree structure
  comments.forEach((comment) => {
    if (comment.parent_comment_id && commentMap[comment.parent_comment_id]) {
      // This is a reply - add it to its parent
      commentMap[comment.parent_comment_id].replies.push(
        commentMap[comment.comment_id]
      );
    } else {
      // This is a root comment
      rootComments.push(commentMap[comment.comment_id]);
    }
  });

  return rootComments;
};

/**
 * Get comments for a post with threading support
 */
export const getPostComments = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { postId } = req.params;
    const userId = (req as AuthenticatedRequest).user?.user_id;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;

    // Verify the post exists and is active
    const post = await postModel.getPostById(postId);
    if (post.status !== "active") {
      throw new ApiError("Post not found or has been removed", 404);
    }

    // Get comments
    const { comments, total } = await commentModel.getCommentsForPost(
      postId,
      page,
      limit
    );

    // Process comments for anonymity
    const processedComments = comments.map((comment) => {
      if (comment.is_anonymous) {
        comment.author_username = null;
      }
      return comment;
    });

    // Get user votes if logged in
    if (userId && processedComments.length > 0) {
      const commentIds = processedComments.map((comment) => comment.comment_id);
      const userVotes = await commentModel.getUserVotesForComments(
        userId,
        commentIds
      );

      processedComments.forEach((comment) => {
        comment["user_vote"] = userVotes[comment.comment_id] || null;
      });
    }

    // Organize comments into a threaded structure
    const threaded = processCommentThreads(processedComments);

    // Calculate total pages
    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      status: "success",
      data: {
        comments: threaded,
        pagination: {
          page,
          limit,
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
 * Vote on a comment
 */
export const voteOnComment = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new ApiError("Not authenticated", 401);
    }

    const { commentId } = req.params;
    const { voteType } = req.body;

    if (voteType !== "up" && voteType !== "down") {
      throw new ApiError("Invalid vote type. Must be 'up' or 'down'", 400);
    }

    // Register vote
    const updatedComment = await commentModel.voteOnComment(
      commentId,
      req.user.user_id,
      voteType
    );

    // If comment is anonymous, hide author username
    if (updatedComment.is_anonymous) {
      updatedComment.author_username = null;
    }

    // Get the user's updated vote
    const votes = await commentModel.getUserVotesForComments(req.user.user_id, [
      commentId,
    ]);
    const userVote = votes[commentId] || null;

    res.status(200).json({
      status: "success",
      message: `Vote ${userVote ? "registered" : "removed"} successfully`,
      data: {
        comment: {
          ...updatedComment,
          user_vote: userVote,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};
