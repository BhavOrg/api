import { query, getClient } from "../config/database";
import {
  Post,
  PostCreationData,
  PostUpdateData,
  FeedQuery,
} from "../types/post.types";

/**
 * Create a new post
 */
export const createPost = async (postData: PostCreationData): Promise<Post> => {
  const { authorId, content, isAnonymous, tags } = postData;

  // Start a transaction
  const { client, release } = await getClient();

  try {
    await client.query("BEGIN");

    // Insert the post
    const postResult = await client.query(
      `INSERT INTO posts 
       (author_id, content, is_anonymous, status) 
       VALUES ($1, $2, $3, $4) 
       RETURNING *`,
      [authorId, content, isAnonymous, "active"]
    );

    const post = postResult.rows[0] as Post;

    // Add tags if provided
    if (tags && tags.length > 0) {
      for (const tagName of tags) {
        // First find or create the tag
        const tagResult = await client.query(
          `INSERT INTO tags (name) 
           VALUES ($1) 
           ON CONFLICT (name) DO UPDATE SET name = $1
           RETURNING tag_id`,
          [tagName.toLowerCase()]
        );

        const tagId = tagResult.rows[0].tag_id;

        // Associate tag with post
        await client.query(
          `INSERT INTO post_tags (post_id, tag_id) 
           VALUES ($1, $2)`,
          [post.post_id, tagId]
        );
      }
    }

    // Commit transaction
    await client.query("COMMIT");

    // Return post with fully populated data
    release();
    return getPostById(post.post_id);
  } catch (error) {
    // Rollback on error
    await client.query("ROLLBACK");
    release();
    throw error;
  }
};

/**
 * Update a post's content and metadata
 */
export const updatePost = async (
  postId: string,
  updateData: PostUpdateData
): Promise<Post> => {
  const { content, urgencyLevel, status, tags } = updateData;

  // Start transaction
  const { client, release } = await getClient();

  try {
    await client.query("BEGIN");

    // Build the SET clause dynamically
    const updateFields = [];
    const values = [];
    let valueIndex = 1;

    if (content !== undefined) {
      updateFields.push(`content = $${valueIndex}`);
      values.push(content);
      valueIndex++;
    }

    if (urgencyLevel !== undefined) {
      updateFields.push(`urgency_level = $${valueIndex}`);
      values.push(urgencyLevel);
      valueIndex++;
    }

    if (status !== undefined) {
      updateFields.push(`status = $${valueIndex}`);
      values.push(status);
      valueIndex++;
    }

    // Always update the updated_at timestamp
    updateFields.push(`updated_at = NOW()`);

    // Only proceed with post update if there are fields to update
    if (updateFields.length > 0) {
      values.push(postId);
      await client.query(
        `UPDATE posts 
         SET ${updateFields.join(", ")} 
         WHERE post_id = $${valueIndex}`,
        values
      );
    }

    // Update tags if provided
    if (tags !== undefined) {
      // First remove existing tags
      await client.query(`DELETE FROM post_tags WHERE post_id = $1`, [postId]);

      // Then add new tags
      if (tags.length > 0) {
        for (const tagName of tags) {
          // Find or create the tag
          const tagResult = await client.query(
            `INSERT INTO tags (name) 
             VALUES ($1) 
             ON CONFLICT (name) DO UPDATE SET name = $1
             RETURNING tag_id`,
            [tagName.toLowerCase()]
          );

          const tagId = tagResult.rows[0].tag_id;

          // Associate tag with post
          await client.query(
            `INSERT INTO post_tags (post_id, tag_id) 
             VALUES ($1, $2)`,
            [postId, tagId]
          );
        }
      }
    }

    // Commit transaction
    await client.query("COMMIT");
    release();

    // Return updated post
    return getPostById(postId);
  } catch (error) {
    // Rollback on error
    await client.query("ROLLBACK");
    release();
    throw error;
  }
};

/**
 * Get a post by ID including its tags
 */
export const getPostById = async (postId: string): Promise<Post> => {
  // Get basic post data
  const postResult = await query(
    `SELECT p.*, u.username as author_username
     FROM posts p
     LEFT JOIN users u ON p.author_id = u.user_id
     WHERE p.post_id = $1`,
    [postId]
  );

  if (postResult.rows.length === 0) {
    throw new Error("Post not found");
  }

  const post = postResult.rows[0] as Post;

  // Get post tags
  const tagsResult = await query(
    `SELECT t.name 
     FROM tags t
     JOIN post_tags pt ON t.tag_id = pt.tag_id
     WHERE pt.post_id = $1`,
    [postId]
  );

  post.tags = tagsResult.rows.map((row) => row.name);

  return post;
};

/**
 * Delete a post (mark as deleted)
 */
export const deletePost = async (postId: string): Promise<void> => {
  await query(
    `UPDATE posts 
     SET status = 'deleted', updated_at = NOW() 
     WHERE post_id = $1`,
    [postId]
  );
};

/**
 * Get feed posts with filtering, sorting, and pagination
 */
export const getFeedPosts = async (
  feedQuery: FeedQuery
): Promise<{ posts: Post[]; total: number }> => {
  const {
    userId,
    tags,
    urgencyLevel,
    sortBy = "created_at",
    sortOrder = "desc",
    page = 1,
    limit = 10,
    withExpertResponse = false,
  } = feedQuery;

  // Building query conditions
  const conditions = ["p.status = 'active'"];
  const queryParams: any[] = [];
  let paramIndex = 1;

  // Add tag filter
  if (tags && tags.length > 0) {
    const placeholders = tags
      .map((_, idx) => `$${paramIndex + idx}`)
      .join(", ");
    conditions.push(`EXISTS (
      SELECT 1 FROM post_tags pt 
      JOIN tags t ON pt.tag_id = t.tag_id 
      WHERE pt.post_id = p.post_id AND t.name IN (${placeholders})
    )`);
    queryParams.push(...tags.map((tag) => tag.toLowerCase()));
    paramIndex += tags.length;
  }

  // Add urgency level filter
  if (urgencyLevel) {
    conditions.push(`p.urgency_level = $${paramIndex}`);
    queryParams.push(urgencyLevel);
    paramIndex++;
  }

  // Add expert response filter
  if (withExpertResponse !== undefined) {
    conditions.push(`p.expert_responded = $${paramIndex}`);
    queryParams.push(withExpertResponse);
    paramIndex++;
  }

  // Validate sort fields (preventing SQL injection)
  const allowedSortFields = ["created_at", "upvotes", "comment_count"];
  const actualSortBy = allowedSortFields.includes(sortBy)
    ? sortBy
    : "created_at";
  const actualSortOrder = sortOrder.toUpperCase() === "ASC" ? "ASC" : "DESC";

  // Calculate pagination
  const offset = (page - 1) * limit;

  // Count total matching posts for pagination
  const countQuery = `
    SELECT COUNT(*) 
    FROM posts p
    WHERE ${conditions.join(" AND ")}
  `;

  const countResult = await query(countQuery, queryParams);
  const total = parseInt(countResult.rows[0].count);

  // Query to get posts
  const postsQuery = `
    SELECT p.*, u.username as author_username
    FROM posts p
    LEFT JOIN users u ON p.author_id = u.user_id
    WHERE ${conditions.join(" AND ")}
    ORDER BY p.${actualSortBy} ${actualSortOrder}
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  // Add pagination parameters
  queryParams.push(limit, offset);

  const postsResult = await query(postsQuery, queryParams);

  // Get all post IDs to fetch tags in a single query
  const postIds = postsResult.rows.map((post) => post.post_id);

  if (postIds.length === 0) {
    return { posts: [], total };
  }

  // Get all tags for these posts in one query
  const tagsQuery = `
    SELECT pt.post_id, t.name
    FROM post_tags pt
    JOIN tags t ON pt.tag_id = t.tag_id
    WHERE pt.post_id = ANY($1)
  `;

  const tagsResult = await query(tagsQuery, [postIds]);

  // Group tags by post
  const postTags: Record<string, string[]> = {};
  tagsResult.rows.forEach((row) => {
    if (!postTags[row.post_id]) {
      postTags[row.post_id] = [];
    }
    postTags[row.post_id].push(row.name);
  });

  // Add tags to posts
  const posts = postsResult.rows.map((post) => {
    return {
      ...post,
      tags: postTags[post.post_id] || [],
    };
  });

  return { posts, total };
};

/**
 * Register a vote on a post
 */
export const voteOnPost = async (
  postId: string,
  userId: string,
  voteType: "up" | "down"
): Promise<Post> => {
  // Start a transaction
  const { client, release } = await getClient();

  try {
    await client.query("BEGIN");

    // Check if user already voted on this post
    const existingVoteResult = await client.query(
      `SELECT vote_type FROM post_votes WHERE post_id = $1 AND user_id = $2`,
      [postId, userId]
    );

    const existingVote = existingVoteResult.rows[0]?.vote_type;

    if (existingVote) {
      if (existingVote === voteType) {
        // User is trying to vote the same way again - remove their vote
        await client.query(
          `DELETE FROM post_votes WHERE post_id = $1 AND user_id = $2`,
          [postId, userId]
        );

        // Update post vote counts
        if (voteType === "up") {
          await client.query(
            `UPDATE posts SET upvotes = upvotes - 1 WHERE post_id = $1`,
            [postId]
          );
        } else {
          await client.query(
            `UPDATE posts SET downvotes = downvotes - 1 WHERE post_id = $1`,
            [postId]
          );
        }
      } else {
        // User is changing their vote
        await client.query(
          `UPDATE post_votes SET vote_type = $3 WHERE post_id = $1 AND user_id = $2`,
          [postId, userId, voteType]
        );

        // Update post vote counts
        if (voteType === "up") {
          await client.query(
            `UPDATE posts SET upvotes = upvotes + 1, downvotes = downvotes - 1 WHERE post_id = $1`,
            [postId]
          );
        } else {
          await client.query(
            `UPDATE posts SET upvotes = upvotes - 1, downvotes = downvotes + 1 WHERE post_id = $1`,
            [postId]
          );
        }
      }
    } else {
      // New vote
      await client.query(
        `INSERT INTO post_votes (post_id, user_id, vote_type) VALUES ($1, $2, $3)`,
        [postId, userId, voteType]
      );

      // Update post vote counts
      if (voteType === "up") {
        await client.query(
          `UPDATE posts SET upvotes = upvotes + 1 WHERE post_id = $1`,
          [postId]
        );
      } else {
        await client.query(
          `UPDATE posts SET downvotes = downvotes + 1 WHERE post_id = $1`,
          [postId]
        );
      }
    }

    // Get post author for notification
    const postResult = await client.query(
      `SELECT author_id FROM posts WHERE post_id = $1`,
      [postId]
    );

    const authorId = postResult.rows[0]?.author_id;

    // Create notification for author if this is a new upvote (people generally only want to be notified of upvotes)
    if (authorId && authorId !== userId && !existingVote && voteType === "up") {
      await client.query(
        `INSERT INTO notifications 
         (recipient_id, notification_type, message, related_post_id) 
         VALUES ($1, $2, $3, $4)`,
        [authorId, "upvote", "Someone upvoted your post", postId]
      );
    }

    // Commit transaction
    await client.query("COMMIT");
    release();

    // Return updated post
    return getPostById(postId);
  } catch (error) {
    // Rollback on error
    await client.query("ROLLBACK");
    release();
    throw error;
  }
};

/**
 * Update sentiment score and urgency level for a post (called after AI analysis)
 */
export const updatePostSentiment = async (
  postId: string,
  sentimentScore: number,
  urgencyLevel: "low" | "medium" | "high" | "critical"
): Promise<Post> => {
  await query(
    `UPDATE posts 
     SET sentiment_score = $2, urgency_level = $3 
     WHERE post_id = $1`,
    [postId, sentimentScore, urgencyLevel]
  );

  return getPostById(postId);
};

/**
 * Mark a post as having received an expert response
 */
export const markPostExpertResponded = async (
  postId: string
): Promise<Post> => {
  await query(`UPDATE posts SET expert_responded = TRUE WHERE post_id = $1`, [
    postId,
  ]);

  return getPostById(postId);
};

/**
 * Get user voting status for a set of posts
 */
export const getUserVotesForPosts = async (
  userId: string,
  postIds: string[]
): Promise<Record<string, string>> => {
  if (postIds.length === 0) {
    return {};
  }

  const votesResult = await query(
    `SELECT post_id, vote_type 
     FROM post_votes 
     WHERE user_id = $1 AND post_id = ANY($2)`,
    [userId, postIds]
  );

  const votes: Record<string, string> = {};
  votesResult.rows.forEach((row) => {
    votes[row.post_id] = row.vote_type;
  });

  return votes;
};
