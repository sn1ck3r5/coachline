export interface PaginatedResponse<T> {
  data: T[];
  cursor: string | null;
  hasMore: boolean;
}

export interface PresignedUrlResponse {
  url: string;
  key: string;
  expiresAt: string;
}

export interface ErrorResponse {
  error: string;
  message: string;
}
