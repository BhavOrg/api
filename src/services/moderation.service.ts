import axios from "axios";
import { config } from "../config/config";
import * as postModel from "../models/post.model";
import * as commentModel from "../models/comment.model";

interface ModerationResult {
  isApproved: boolean;
  reason?: string;
  moderationScore: number;
}

/**
 * Check content against moderation rules
 * This helps ensure all content follows community guidelines and is safe
 */
export const moderateContent = async (
  content: string
): Promise<ModerationResult> => {
  // Skip moderation if disabled in config
  if (!config.moderation.enabled) {
    return { isApproved: true, moderationScore: 0 };
  }

  try {
    // In production, this would call a real moderation API
    // For development, we'll use a mock implementation
    return await mockModerationCheck(content);
  } catch (error) {
    console.error("Error in content moderation:", error);
    // Default to approval if moderation service fails
    // This is a business decision - you might want to fail closed instead
    return { isApproved: true, moderationScore: 0 };
  }
};

/**
 * Moderate a post after creation or update
 * This is designed to be called asynchronously after post creation
 */
export const moderatePost = async (
  postId: string,
  content: string
): Promise<void> => {
  try {
    const result = await moderateContent(content);

    if (!result.isApproved) {
      // Automatically moderate the post
      await postModel.updatePost(postId, { status: "moderated" });

      console.log(
        `Post ${postId} was automatically moderated. Reason: ${result.reason}`
      );

      // In a real implementation, this might also:
      // 1. Create a moderation ticket for review
      // 2. Notify the user their post was flagged
      // 3. Log the incident for compliance purposes
    }
  } catch (error) {
    console.error(`Error moderating post ${postId}:`, error);
  }
};

/**
 * Moderate a comment after creation or update
 */
export const moderateComment = async (
  commentId: string,
  content: string
): Promise<void> => {
  try {
    const result = await moderateContent(content);

    if (!result.isApproved) {
      // Automatically moderate the comment
      await commentModel.updateComment(commentId, { status: "moderated" });

      console.log(
        `Comment ${commentId} was automatically moderated. Reason: ${result.reason}`
      );
    }
  } catch (error) {
    console.error(`Error moderating comment ${commentId}:`, error);
  }
};

/**
 * Mock implementation of content moderation
 * In production, this would be replaced with a call to a real moderation API
 */
const mockModerationCheck = async (
  content: string
): Promise<ModerationResult> => {
  // Simulate API call delay
  await new Promise((resolve) => setTimeout(resolve, 300));

  const lowerContent = content.toLowerCase();

  // Simple list of prohibited content patterns
  const prohibitedPatterns = [
    { pattern: /\b(hate|racist|sexist)\b/i, reason: "Hate speech", score: 0.8 },
    {
      pattern: /\b(bomb|terrorist|attack)\b/i,
      reason: "Violent content",
      score: 0.7,
    },
    { pattern: /\b(nude|porn|xxx)\b/i, reason: "Adult content", score: 0.9 },
  ];

  // Check content against prohibited patterns
  for (const item of prohibitedPatterns) {
    if (item.pattern.test(lowerContent)) {
      return {
        isApproved: false,
        reason: item.reason,
        moderationScore: item.score,
      };
    }
  }

  // Content passed all checks
  return {
    isApproved: true,
    moderationScore: 0,
  };
};

/**
 * In a production environment, you would implement a real API call to a moderation service
 * This is a placeholder for that implementation
 */
const callRealModerationAPI = async (
  content: string
): Promise<ModerationResult> => {
  try {
    const response = await axios.post(
      config.moderation.apiUrl as string,
      {
        text: content,
        apiKey: config.moderation.apiKey,
      },
      { timeout: 3000 } // 3-second timeout
    );

    return {
      isApproved: response.data.approved,
      reason: response.data.reason,
      moderationScore: response.data.score,
    };
  } catch (error) {
    console.error("Error calling moderation API:", error);
    // Default to approval if API fails
    return { isApproved: true, moderationScore: 0 };
  }
};
