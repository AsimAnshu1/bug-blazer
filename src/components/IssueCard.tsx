import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Edit, Trash2, AlertCircle, Circle, CheckCircle2, User } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

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

interface IssueCardProps {
  issue: Issue;
  onEdit: () => void;
  onDelete: () => void;
}

const priorityConfig = {
  low: { color: 'bg-priority-low', label: 'Low' },
  medium: { color: 'bg-priority-medium', label: 'Medium' },
  high: { color: 'bg-priority-high', label: 'High' },
  urgent: { color: 'bg-priority-urgent', label: 'Urgent' },
};

const statusIcons = {
  todo: Circle,
  in_progress: AlertCircle,
  done: CheckCircle2,
};

export function IssueCard({ issue, onEdit, onDelete }: IssueCardProps) {
  const [assigneeName, setAssigneeName] = useState<string>('');
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: issue.id,
  });

  useEffect(() => {
    if (issue.assignee_id) {
      fetchAssigneeName();
    }
  }, [issue.assignee_id]);

  const fetchAssigneeName = async () => {
    if (!issue.assignee_id) return;
    
    try {
      const { data } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', issue.assignee_id)
        .maybeSingle();
      
      setAssigneeName(data?.full_name || 'Unknown User');
    } catch (error) {
      console.error('Error fetching assignee name:', error);
      setAssigneeName('Unknown User');
    }
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const StatusIcon = statusIcons[issue.status];
  const priorityInfo = priorityConfig[issue.priority];

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`transition-all hover:shadow-md ${
        isDragging ? 'opacity-50 shadow-lg' : ''
      }`}
      {...attributes}
    >
        <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div 
            className="flex items-center space-x-2 flex-1 cursor-grab active:cursor-grabbing"
            {...listeners}
          >
            <StatusIcon 
              className="h-4 w-4 text-muted-foreground" 
            />
            <h4 className="font-medium text-sm line-clamp-2">{issue.title}</h4>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 w-6 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
              >
                <MoreHorizontal className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  e.preventDefault();
                  onEdit(); 
                }}
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  e.preventDefault();
                  onDelete(); 
                }}
                className="text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        </CardHeader>
        <CardContent className="pt-0">
        {issue.description && (
          <p className="text-sm text-muted-foreground line-clamp-3 mb-3">
            {issue.description}
          </p>
        )}
        <div className="flex items-center justify-between">
          <Badge variant="secondary" className={`text-xs ${priorityInfo.color} text-white`}>
            {priorityInfo.label}
          </Badge>
          <div className="flex items-center space-x-2">
            {issue.assignee_id && assigneeName && (
              <div className="flex items-center space-x-1" title={`Assigned to ${assigneeName}`}>
                <User className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground truncate max-w-20">
                  {assigneeName}
                </span>
              </div>
            )}
            <span className="text-xs text-muted-foreground">
              {new Date(issue.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}