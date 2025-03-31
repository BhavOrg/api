import { query as dbQuery } from "../config/database";

export interface Tag {
  tag_id: number;
  name: string;
  post_count?: number;
}

/**
 * Get popular tags
 */
export const getPopularTags = async (limit = 20): Promise<Tag[]> => {
  const result = await dbQuery(
    `SELECT t.tag_id, t.name, COUNT(pt.post_id) as post_count
     FROM tags t
     JOIN post_tags pt ON t.tag_id = pt.tag_id
     JOIN posts p ON pt.post_id = p.post_id
     WHERE p.status = 'active'
     GROUP BY t.tag_id, t.name
     ORDER BY post_count DESC
     LIMIT $1`,
    [limit]
  );

  return result.rows;
};

/**
 * Search for tags by partial name
 */
export const searchTags = async (
  searchQuery: string,
  limit = 10
): Promise<Tag[]> => {
  const result = await dbQuery(
    `SELECT tag_id, name
     FROM tags
     WHERE name ILIKE $1
     ORDER BY name ASC
     LIMIT $2`,
    [`%${searchQuery}%`, limit]
  );

  return result.rows;
};

/**
 * Suggest tags based on post content
 * This function analyzes post content and suggests relevant tags
 */
export const suggestTagsFromContent = async (
  content: string
): Promise<string[]> => {
  // In a real implementation, this might use NLP to extract keywords
  // For this example, we'll use a simple keyword matching approach

  const lowerContent = content.toLowerCase();

  // Map of keywords to potential tags
  const keywordTagMap: Record<string, string[]> = {
    anxiety: ["anxiety", "mental-health"],
    depression: ["depression", "mental-health"],
    therapy: ["therapy", "professional-help"],
    medication: ["medication", "treatment"],
    panic: ["anxiety", "panic-attacks"],
    stress: ["stress", "coping"],
    sleep: ["sleep", "insomnia", "health"],
    exercise: ["exercise", "physical-health", "wellness"],
    meditation: ["meditation", "mindfulness", "coping"],
    family: ["family", "relationships"],
    friend: ["friendship", "relationships"],
    work: ["work", "career", "stress"],
    school: ["education", "academic", "student"],
    college: ["education", "university", "student"],
  };

  const suggestedTags = new Set<string>();

  // Check content for keywords and add associated tags
  Object.entries(keywordTagMap).forEach(([keyword, tags]) => {
    if (lowerContent.includes(keyword)) {
      tags.forEach((tag) => suggestedTags.add(tag));
    }
  });

  return Array.from(suggestedTags).slice(0, 5); // Limit to 5 suggestions
};

/**
 * Get related tags (tags often used together)
 */
export const getRelatedTags = async (
  tagName: string,
  limit = 5
): Promise<Tag[]> => {
  const result = await dbQuery(
    `SELECT t2.tag_id, t2.name, COUNT(pt2.post_id) as post_count
     FROM tags t1
     JOIN post_tags pt1 ON t1.tag_id = pt1.tag_id
     JOIN post_tags pt2 ON pt1.post_id = pt2.post_id
     JOIN tags t2 ON pt2.tag_id = t2.tag_id
     WHERE t1.name = $1 AND t2.name != $1
     GROUP BY t2.tag_id, t2.name
     ORDER BY post_count DESC
     LIMIT $2`,
    [tagName, limit]
  );

  return result.rows;
};

/**
 * Create a new tag if it doesn't exist
 */
export const createTag = async (name: string): Promise<Tag> => {
  const result = await dbQuery(
    `INSERT INTO tags (name) 
     VALUES ($1) 
     ON CONFLICT (name) DO UPDATE SET name = $1
     RETURNING tag_id, name`,
    [name.toLowerCase()]
  );

  return result.rows[0];
};

/**
 * Get or create multiple tags
 */
export const getOrCreateTags = async (tagNames: string[]): Promise<Tag[]> => {
  if (!tagNames || tagNames.length === 0) {
    return [];
  }

  const tags: Tag[] = [];

  // Process tags in batches to avoid too many concurrent queries
  for (const name of tagNames) {
    const tag = await createTag(name);
    tags.push(tag);
  }

  return tags;
};
