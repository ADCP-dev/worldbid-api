export interface FileType {
  id: string;
  path: string;
  name: string;
  isPublic: boolean;
  entityName: string | null;
  entityId: string | null;
  context: string | null;
  userId: number;
  user?: {
    id: number;
    name: string;
    email: string;
  };
  type: string;
  size: number;
  createdAt?: string;
}

export interface FileStats {
  totalFiles: number;
  totalSize: number;
  byType: FileTypeStat[];
  recentFiles: FileType[];
}

export interface FileTypeStat {
  type: 'image' | 'document' | 'video' | 'audio' | 'other';
  count: number;
  size: number;
}

export interface FileUploadMeta {
  entityName?: string;
  entityId?: string;
  context?: string;
  isPublic?: boolean;
}
