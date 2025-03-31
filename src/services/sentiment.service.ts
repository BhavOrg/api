import axios from "axios";
import * as postModel from "../models/post.model";
import * as notificationModel from "../models/notification.model";
import { config } from "../config/config";

interface SentimentAnalysisResult {
  sentimentScore: number;
  urgencyLevel: "low" | "medium" | "high" | "critical";
  tags: string[];
}

/**
 * Analyze sentiment of post content
 * This function makes an API call to an external sentiment analysis service
 * and updates the post with sentiment score and urgency level
 */
export const analyzeSentiment = async (
  postId: string,
  content: string
): Promise<void> => {
  try {
    // For development/testing, we'll use a simple mock implementation
    // In production, this would call a real NLP service or ML model
    const result = await mockSentimentAnalysis(content);

    // Update post with sentiment analysis results
    await postModel.updatePostSentiment(
      postId,
      result.sentimentScore,
      result.urgencyLevel
    );

    // If post is urgent, notify experts
    if (result.urgencyLevel === "high" || result.urgencyLevel === "critical") {
      await notifyExpertsForUrgentPost(postId, result);
    }

    console.log(`Sentiment analysis completed for post ${postId}`, result);
  } catch (error) {
    console.error(`Error in sentiment analysis for post ${postId}:`, error);
  }
};

/**
 * Mock sentiment analysis implementation
 * In production, this would be replaced with a call to a real NLP service or ML model
 */
const mockSentimentAnalysis = async (
  content: string
): Promise<SentimentAnalysisResult> => {
  // Simulate an API call delay
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Simple keyword-based approach for demo
  const lowerContent = content.toLowerCase();

  // Detect potential mental health keywords
  const anxietyKeywords = ["anxiety", "anxious", "panic", "worry", "stressed"];
  const depressionKeywords = [
    "depression",
    "depressed",
    "hopeless",
    "sad",
    "suicidal",
  ];
  const traumaKeywords = ["trauma", "ptsd", "flashback", "nightmare", "abuse"];
  const urgentKeywords = [
    "kill",
    "die",
    "suicide",
    "end it all",
    "hurt myself",
  ];

  // Calculate "sentiment score" from -1 (negative) to 1 (positive)
  // This is simplified - a real implementation would use NLP
  let sentimentScore = 0;

  // Check for mental health keywords and adjust sentiment
  let hasAnxiety = anxietyKeywords.some((kw) => lowerContent.includes(kw));
  let hasDepression = depressionKeywords.some((kw) =>
    lowerContent.includes(kw)
  );
  let hasTrauma = traumaKeywords.some((kw) => lowerContent.includes(kw));
  let hasUrgent = urgentKeywords.some((kw) => lowerContent.includes(kw));

  // Adjust sentiment score based on keywords
  if (hasAnxiety) sentimentScore -= 0.3;
  if (hasDepression) sentimentScore -= 0.5;
  if (hasTrauma) sentimentScore -= 0.4;
  if (hasUrgent) sentimentScore -= 0.8;

  // Determine urgency level
  let urgencyLevel: "low" | "medium" | "high" | "critical" = "low";

  if (hasUrgent) {
    urgencyLevel = "critical";
  } else if (sentimentScore < -0.6) {
    urgencyLevel = "high";
  } else if (sentimentScore < -0.3) {
    urgencyLevel = "medium";
  }

  // Extract potential tags
  const tags: string[] = [];
  if (hasAnxiety) tags.push("anxiety");
  if (hasDepression) tags.push("depression");
  if (hasTrauma) tags.push("trauma");

  return {
    sentimentScore,
    urgencyLevel,
    tags,
  };
};

/**
 * Notify experts for urgent posts
 */
const notifyExpertsForUrgentPost = async (
  postId: string,
  result: SentimentAnalysisResult
): Promise<void> => {
  // Get the post to include its details
  const post = await postModel.getPostById(postId);

  // Create a message describing the urgent post
  const message = `Urgent post detected with ${
    result.urgencyLevel
  } severity. The post may indicate ${result.tags.join(", ")}.`;

  // Notify experts based on the tags
  await notificationModel.notifyExpertsByTags(postId, result.tags, "high");

  // For critical posts, create a system alert for all active moderators
  if (result.urgencyLevel === "critical") {
    // This would require a dedicated moderator role in a real implementation
    console.log(
      `CRITICAL ALERT: Potentially self-harm content detected in post ${postId}`
    );

    // In a real implementation, this might also:
    // 1. Send push notifications to on-call experts
    // 2. Create an escalation ticket in a support system
    // 3. Send an emergency email to the mental health response team
  }
};

/**
 * In a production environment, you would implement a real API call to a sentiment analysis service
 * This is a placeholder for that implementation
 */
const callRealSentimentAPI = async (
  content: string
): Promise<SentimentAnalysisResult> => {
  try {
    // This would be a real API endpoint in production
    const response = await axios.post(
      "https://api.sentiment-analysis-service.com/analyze",
      {
        text: content,
        apiKey: config.sentimentApi?.apiKey,
      }
    );

    // Transform the API response to our internal format
    return {
      sentimentScore: response.data.score,
      urgencyLevel: mapUrgencyLevel(response.data.urgency),
      tags: response.data.categories || [],
    };
  } catch (error) {
    console.error("Error calling sentiment analysis API:", error);
    // Return a neutral result if the API call fails
    return {
      sentimentScore: 0,
      urgencyLevel: "low",
      tags: [],
    };
  }
};

/**
 * Map external API urgency levels to our internal format
 */
const mapUrgencyLevel = (
  externalUrgency: string
): "low" | "medium" | "high" | "critical" => {
  const mapping: Record<string, "low" | "medium" | "high" | "critical"> = {
    "not-urgent": "low",
    "somewhat-urgent": "medium",
    urgent: "high",
    "very-urgent": "critical",
  };

  return mapping[externalUrgency] || "low";
};
