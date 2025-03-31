export interface Post {
  post_id: string;
  author_id: string;
  author_username?: string;
  content: string;
  upvotes: number;
  downvotes: number;
  comment_count: number;
  is_anonymous: boolean;
  sentiment_score: number | null;
  urgency_level: "low" | "medium" | "high" | "critical";
  expert_responded: boolean;
  status: "active" | "moderated" | "deleted";
  created_at: Date;
  updated_at: Date;
  tags?: string[];
}

export interface PostCreationData {
  authorId: string;
  content: string;
  isAnonymous?: boolean;
  tags?: string[];
}

export interface PostUpdateData {
  content?: string;
  urgencyLevel?: "low" | "medium" | "high" | "critical";
  status?: "active" | "moderated" | "deleted";
  tags?: string[];
}

export interface FeedQuery {
  userId?: string;
  tags?: string[];
  urgencyLevel?: string;
  withExpertResponse?: boolean;
  sortBy?: "created_at" | "upvotes" | "comment_count";
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
}

export interface PostResponse {
  post_id: string;
  author_username: string | null;
  content: string;
  upvotes: number;
  downvotes: number;
  comment_count: number;
  is_anonymous: boolean;
  urgency_level: string;
  expert_responded: boolean;
  created_at: string;
  updated_at: string;
  tags: string[];
  user_vote?: "up" | "down" | null;
}

export interface FeedResponse {
  posts: PostResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
