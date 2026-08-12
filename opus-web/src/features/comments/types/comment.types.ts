export interface Comment {
  id: number;
  typeOfActivity: 'comment';
  previousValue: string;
  newValue: string;
  visibilityLevel: 'public' | 'internal';
  requirementId: number;
  changedBy: string;
  createdAt: string;
}

export interface CreateCommentPayload {
  comment: string;
  attachmentIds?: number[];
}

export interface CreateCommentResponse {
  id: number;
  typeOfActivity: 'comment';
  previousValue: string;
  newValue: string;
  visibilityLevel: 'public';
  requirementId: number;
  changedBy: string;
}
