import { useDroppable } from '@dnd-kit/core';
import { IssueCard } from './IssueCard';

interface Column {
  id: string;
  name: string;
  position: number;
}

interface Issue {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'todo' | 'in_progress' | 'done';
  position: number;
  column_id: string;
  project_id: string;
  assignee_id: string | null;
  reporter_id: string;
  created_at: string;
  updated_at: string;
}

interface KanbanColumnProps {
  column: Column;
  issues: Issue[];
  onEditIssue: (issue: Issue) => void;
  onDeleteIssue: (issueId: string) => void;
}

export function KanbanColumn({ column, issues, onEditIssue, onDeleteIssue }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  });

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[200px] space-y-3 transition-colors ${
        isOver ? 'bg-muted/50 rounded-lg p-2' : ''
      }`}
    >
      {issues.map((issue) => (
        <IssueCard
          key={issue.id}
          issue={issue}
          onEdit={() => onEditIssue(issue)}
          onDelete={() => onDeleteIssue(issue.id)}
        />
      ))}
      {issues.length === 0 && (
        <div className="text-center text-muted-foreground py-8 border-2 border-dashed border-muted rounded-lg">
          Drop issues here
        </div>
      )}
    </div>
  );
}