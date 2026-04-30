export interface KanbanTag {
  id: string;
  label: string;
  color?: string;
}

export interface KanbanAssignee {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl?: string;
}

export interface KanbanChecklistItem {
  id: string;
  text: string;
  done: boolean;
  assigneeId?: string;
  dueDate?: string;
}

export interface KanbanTaskLink {
  id: string;
  title: string;
  stateId: string;
  relationType?: 'blocks' | 'blocked_by' | 'relates_to';
}

export interface KanbanTask {
  id: string;
  title: string;
  description?: string;
  stateId: string;
  tags?: KanbanTag[];
  assignee?: KanbanAssignee;
  checklist?: KanbanChecklistItem[];
  relatedTasks?: KanbanTaskLink[];
  priority?: 'low' | 'medium' | 'high';
  dueDate?: string;
  order?: number;
  metadata?: Record<string, unknown>;
  comments?: Array<{ id: string; author: string; text: string; time: string }>;
}

export interface KanbanStateConfig {
  id: string;
  title: string;
  order: number;
  color?: string;
  wipLimit?: number;
}

export interface KanbanTagConfig {
  component?: any;
  className?: string;
  maxVisible?: number;
}

export interface KanbanColumnStyleConfig {
  [stateId: string]: {
    headerClass?: string;
    borderClass?: string;
    bgClass?: string;
  };
}
