export interface Comment {
  comment_id: string;
  post_id: string;
  author_id: string;
  author_username?: string;
  parent_comment_id: string | null;
  content: string;
  upvotes: number;
  downvotes: number;
  is_expert_response: boolean;
  is_anonymous: boolean;
  status: "active" | "moderated" | "deleted";
  created_at: Date;
  updated_at: Date;
}

export interface CommentCreationData {
  postId: string;
  authorId: string;
  content: string;
  parentCommentId?: string | null;
  isAnonymous?: boolean;
  isExpertResponse?: boolean;
}

export interface CommentUpdateData {
  content?: string;
  status?: "active" | "moderated" | "deleted";
}

export interface CommentResponse {
  comment_id: string;
  post_id: string;
  author_username: string | null;
  parent_comment_id: string | null;
  content: string;
  upvotes: number;
  downvotes: number;
  is_expert_response: boolean;
  is_anonymous: boolean;
  created_at: string;
  updated_at: string;
  user_vote?: "up" | "down" | null;
  replies?: CommentResponse[];
}

export interface CommentsResponse {
  comments: CommentResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
