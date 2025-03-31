import { query, getClient } from "../config/database";
import {
  Comment,
  CommentCreationData,
  CommentUpdateData,
} from "../types/comment.types";

/**
 * Create a new comment
 */
export const createComment = async (
  commentData: CommentCreationData
): Promise<Comment> => {
  const {
    postId,
    authorId,
    content,
    parentCommentId,
    isAnonymous,
    isExpertResponse,
  } = commentData;

  // Start a transaction
  const { client, release } = await getClient();

  try {
    await client.query("BEGIN");

    // Insert the comment
    const commentResult = await client.query(
      `INSERT INTO comments 
       (post_id, author_id, parent_comment_id, content, is_anonymous, is_expert_response) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING *`,
      [
        postId,
        authorId,
        parentCommentId || null,
        content,
        isAnonymous,
        isExpertResponse || false,
      ]
    );

    const comment = commentResult.rows[0] as Comment;

    // Increment comment count on the post
    await client.query(
      `UPDATE posts SET comment_count = comment_count + 1 WHERE post_id = $1`,
      [postId]
    );

    // If this is an expert response, mark the post
    if (isExpertResponse) {
      await client.query(
        `UPDATE posts SET expert_responded = TRUE WHERE post_id = $1`,
        [postId]
      );
    }

    // Get post and parent comment author for notification
    const postResult = await client.query(
      `SELECT author_id FROM posts WHERE post_id = $1`,
      [postId]
    );

    const postAuthorId = postResult.rows[0]?.author_id;

    // Notify post author about the comment if it's not their own comment
    if (postAuthorId && postAuthorId !== authorId) {
      const notificationType = isExpertResponse ? "expertResponse" : "comment";
      const message = isExpertResponse
        ? "An expert has responded to your post"
        : "Someone commented on your post";

      await client.query(
        `INSERT INTO notifications 
         (recipient_id, notification_type, message, related_post_id, related_comment_id, priority) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          postAuthorId,
          notificationType,
          message,
          postId,
          comment.comment_id,
          isExpertResponse ? "high" : "medium",
        ]
      );
    }

    // If this is a reply to another comment, notify that comment's author
    if (parentCommentId) {
      const parentCommentResult = await client.query(
        `SELECT author_id FROM comments WHERE comment_id = $1`,
        [parentCommentId]
      );

      const parentCommentAuthorId = parentCommentResult.rows[0]?.author_id;

      // Notify parent comment author if it's not their own comment
      if (parentCommentAuthorId && parentCommentAuthorId !== authorId) {
        const notificationType = isExpertResponse
          ? "expertResponse"
          : "comment";
        const message = isExpertResponse
          ? "An expert has replied to your comment"
          : "Someone replied to your comment";

        await client.query(
          `INSERT INTO notifications 
           (recipient_id, notification_type, message, related_post_id, related_comment_id, priority) 
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            parentCommentAuthorId,
            notificationType,
            message,
            postId,
            comment.comment_id,
            isExpertResponse ? "high" : "medium",
          ]
        );
      }
    }

    // Commit transaction
    await client.query("COMMIT");
    release();

    // Return comment with author information
    return getCommentById(comment.comment_id);
  } catch (error) {
    // Rollback on error
    await client.query("ROLLBACK");
    release();
    throw error;
  }
};

/**
 * Get a comment by ID
 */
export const getCommentById = async (commentId: string): Promise<Comment> => {
  const result = await query(
    `SELECT c.*, u.username as author_username
     FROM comments c
     LEFT JOIN users u ON c.author_id = u.user_id
     WHERE c.comment_id = $1`,
    [commentId]
  );

  if (result.rows.length === 0) {
    throw new Error("Comment not found");
  }

  return result.rows[0] as Comment;
};

/**
 * Update a comment's content
 */
export const updateComment = async (
  commentId: string,
  updateData: CommentUpdateData
): Promise<Comment> => {
  const { content, status } = updateData;

  // Build the SET clause dynamically
  const updateFields = [];
  const values = [];
  let valueIndex = 1;

  if (content !== undefined) {
    updateFields.push(`content = $${valueIndex}`);
    values.push(content);
    valueIndex++;
  }

  if (status !== undefined) {
    updateFields.push(`status = $${valueIndex}`);
    values.push(status);
    valueIndex++;
  }

  // Always update the updated_at timestamp
  updateFields.push(`updated_at = NOW()`);

  // Only proceed with update if there are fields to update
  if (updateFields.length > 0) {
    values.push(commentId);
    await query(
      `UPDATE comments 
       SET ${updateFields.join(", ")} 
       WHERE comment_id = $${valueIndex}`,
      values
    );
  }

  return getCommentById(commentId);
};

/**
 * Delete a comment (mark as deleted)
 */
export const deleteComment = async (commentId: string): Promise<void> => {
  // Get post ID before deleting to update comment count
  const commentResult = await query(
    `SELECT post_id FROM comments WHERE comment_id = $1`,
    [commentId]
  );

  if (commentResult.rows.length === 0) {
    throw new Error("Comment not found");
  }

  const postId = commentResult.rows[0].post_id;

  // Start a transaction
  const { client, release } = await getClient();

  try {
    await client.query("BEGIN");

    // Mark comment as deleted
    await client.query(
      `UPDATE comments 
       SET status = 'deleted', updated_at = NOW() 
       WHERE comment_id = $1`,
      [commentId]
    );

    // Decrement comment count on the post
    await client.query(
      `UPDATE posts SET comment_count = comment_count - 1 WHERE post_id = $1`,
      [postId]
    );

    // Commit transaction
    await client.query("COMMIT");
    release();
  } catch (error) {
    // Rollback on error
    await client.query("ROLLBACK");
    release();
    throw error;
  }
};

/**
 * Get comments for a post (with threading and pagination)
 */
export const getCommentsForPost = async (
  postId: string,
  page = 1,
  limit = 50
): Promise<{ comments: Comment[]; total: number }> => {
  // Get total comment count
  const countResult = await query(
    `SELECT COUNT(*) FROM comments WHERE post_id = $1 AND status = 'active'`,
    [postId]
  );

  const total = parseInt(countResult.rows[0].count);

  // Calculate pagination
  const offset = (page - 1) * limit;

  // Get comments with author information
  const commentsResult = await query(
    `SELECT c.*, u.username as author_username
     FROM comments c
     LEFT JOIN users u ON c.author_id = u.user_id
     WHERE c.post_id = $1 AND c.status = 'active'
     ORDER BY 
       c.parent_comment_id NULLS FIRST, 
       c.created_at ASC
     LIMIT $2 OFFSET $3`,
    [postId, limit, offset]
  );

  return { comments: commentsResult.rows, total };
};

/**
 * Register a vote on a comment
 */
export const voteOnComment = async (
  commentId: string,
  userId: string,
  voteType: "up" | "down"
): Promise<Comment> => {
  // Start a transaction
  const { client, release } = await getClient();

  try {
    await client.query("BEGIN");

    // Check if user already voted on this comment
    const existingVoteResult = await client.query(
      `SELECT vote_type FROM comment_votes WHERE comment_id = $1 AND user_id = $2`,
      [commentId, userId]
    );

    const existingVote = existingVoteResult.rows[0]?.vote_type;

    if (existingVote) {
      if (existingVote === voteType) {
        // User is trying to vote the same way again - remove their vote
        await client.query(
          `DELETE FROM comment_votes WHERE comment_id = $1 AND user_id = $2`,
          [commentId, userId]
        );

        // Update comment vote counts
        if (voteType === "up") {
          await client.query(
            `UPDATE comments SET upvotes = upvotes - 1 WHERE comment_id = $1`,
            [commentId]
          );
        } else {
          await client.query(
            `UPDATE comments SET downvotes = downvotes - 1 WHERE comment_id = $1`,
            [commentId]
          );
        }
      } else {
        // User is changing their vote
        await client.query(
          `UPDATE comment_votes SET vote_type = $3 WHERE comment_id = $1 AND user_id = $2`,
          [commentId, userId, voteType]
        );

        // Update comment vote counts
        if (voteType === "up") {
          await client.query(
            `UPDATE comments SET upvotes = upvotes + 1, downvotes = downvotes - 1 WHERE comment_id = $1`,
            [commentId]
          );
        } else {
          await client.query(
            `UPDATE comments SET upvotes = upvotes - 1, downvotes = downvotes + 1 WHERE comment_id = $1`,
            [commentId]
          );
        }
      }
    } else {
      // New vote
      await client.query(
        `INSERT INTO comment_votes (comment_id, user_id, vote_type) VALUES ($1, $2, $3)`,
        [commentId, userId, voteType]
      );

      // Update comment vote counts
      if (voteType === "up") {
        await client.query(
          `UPDATE comments SET upvotes = upvotes + 1 WHERE comment_id = $1`,
          [commentId]
        );
      } else {
        await client.query(
          `UPDATE comments SET downvotes = downvotes + 1 WHERE comment_id = $1`,
          [commentId]
        );
      }
    }

    // Get comment author for notification
    const commentResult = await client.query(
      `SELECT author_id FROM comments WHERE comment_id = $1`,
      [commentId]
    );

    const authorId = commentResult.rows[0]?.author_id;

    // Create notification for upvotes only (people generally only want to be notified of upvotes)
    if (authorId && authorId !== userId && !existingVote && voteType === "up") {
      await client.query(
        `INSERT INTO notifications 
         (recipient_id, notification_type, message, related_comment_id) 
         VALUES ($1, $2, $3, $4)`,
        [authorId, "upvote", "Someone upvoted your comment", commentId]
      );
    }

    // Commit transaction
    await client.query("COMMIT");
    release();

    // Return updated comment
    return getCommentById(commentId);
  } catch (error) {
    // Rollback on error
    await client.query("ROLLBACK");
    release();
    throw error;
  }
};

/**
 * Get user voting status for a set of comments
 */
export const getUserVotesForComments = async (
  userId: string,
  commentIds: string[]
): Promise<Record<string, string>> => {
  if (commentIds.length === 0) {
    return {};
  }

  const votesResult = await query(
    `SELECT comment_id, vote_type 
     FROM comment_votes 
     WHERE user_id = $1 AND comment_id = ANY($2)`,
    [userId, commentIds]
  );

  const votes: Record<string, string> = {};
  votesResult.rows.forEach((row) => {
    votes[row.comment_id] = row.vote_type;
  });

  return votes;
};
