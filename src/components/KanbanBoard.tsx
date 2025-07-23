import { useState, useEffect } from 'react';
import { DndContext, DragEndEvent, DragOverEvent, DragStartEvent, closestCorners } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { KanbanColumn } from './KanbanColumn';
import { IssueDialog } from './IssueDialog';

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

interface KanbanBoardProps {
  projectId: string;
  userId: string;
}

export function KanbanBoard({ projectId, userId }: KanbanBoardProps) {
  const [columns, setColumns] = useState<Column[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedColumnId, setSelectedColumnId] = useState<string | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (projectId) {
      fetchData();
    }
  }, [projectId]);

  const fetchData = async () => {
    try {
      // Fetch columns
      const { data: columnsData, error: columnsError } = await supabase
        .from('columns')
        .select('*')
        .eq('project_id', projectId)
        .order('position');

      if (columnsError) throw columnsError;

      // Fetch issues
      const { data: issuesData, error: issuesError } = await supabase
        .from('issues')
        .select('*')
        .eq('project_id', projectId)
        .order('position');

      if (issuesError) throw issuesError;

      setColumns(columnsData || []);
      setIssues((issuesData || []) as Issue[]);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to fetch board data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Find the active and over issues
    const activeIssue = issues.find(issue => issue.id === activeId);
    const overIssue = issues.find(issue => issue.id === overId);

    if (!activeIssue) return;

    // If dropping on a column
    if (columns.some(col => col.id === overId)) {
      const newColumnId = overId;
      if (activeIssue.column_id !== newColumnId) {
        setIssues(prevIssues => 
          prevIssues.map(issue => 
            issue.id === activeId 
              ? { ...issue, column_id: newColumnId }
              : issue
          )
        );
      }
      return;
    }

    // If dropping on another issue
    if (overIssue && activeIssue.column_id !== overIssue.column_id) {
      setIssues(prevIssues => 
        prevIssues.map(issue => 
          issue.id === activeId 
            ? { ...issue, column_id: overIssue.column_id }
            : issue
        )
      );
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeIssue = issues.find(issue => issue.id === activeId);
    if (!activeIssue) return;

    try {
      // Update the issue in the database
      const { error } = await supabase
        .from('issues')
        .update({ 
          column_id: activeIssue.column_id,
          updated_at: new Date().toISOString()
        })
        .eq('id', activeId);

      if (error) throw error;

      toast({
        title: "Issue moved",
        description: "Issue has been moved successfully.",
      });
    } catch (error) {
      console.error('Error updating issue:', error);
      toast({
        title: "Error",
        description: "Failed to move issue",
        variant: "destructive",
      });
      // Revert the change
      fetchData();
    }
  };

  const getIssuesForColumn = (columnId: string) => {
    return issues.filter(issue => issue.column_id === columnId);
  };

  const handleCreateIssue = (columnId: string) => {
    setSelectedColumnId(columnId);
    setSelectedIssue(null);
    setIsDialogOpen(true);
  };

  const handleEditIssue = (issue: Issue) => {
    setSelectedIssue(issue);
    setSelectedColumnId(issue.column_id);
    setIsDialogOpen(true);
  };

  const handleIssueSubmit = async (issueData: Partial<Issue>) => {
    try {
      if (selectedIssue) {
        // Update existing issue
        const { error } = await supabase
          .from('issues')
          .update({
            ...issueData,
            updated_at: new Date().toISOString()
          })
          .eq('id', selectedIssue.id);

        if (error) throw error;

        toast({
          title: "Issue updated",
          description: "Issue has been updated successfully.",
        });
      } else {
        // Create new issue
        const maxPosition = Math.max(...getIssuesForColumn(selectedColumnId!).map(i => i.position), -1);
        
        const { error } = await supabase
          .from('issues')
          .insert({
            title: issueData.title!,
            description: issueData.description || '',
            priority: issueData.priority || 'medium',
            project_id: projectId,
            column_id: selectedColumnId!,
            reporter_id: userId,
            position: maxPosition + 1,
          });

        if (error) throw error;

        toast({
          title: "Issue created",
          description: "New issue has been created successfully.",
        });
      }

      setIsDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error saving issue:', error);
      toast({
        title: "Error",
        description: "Failed to save issue",
        variant: "destructive",
      });
    }
  };

  const handleDeleteIssue = async (issueId: string) => {
    try {
      const { error } = await supabase
        .from('issues')
        .delete()
        .eq('id', issueId);

      if (error) throw error;

      toast({
        title: "Issue deleted",
        description: "Issue has been deleted successfully.",
      });

      fetchData();
    } catch (error) {
      console.error('Error deleting issue:', error);
      toast({
        title: "Error",
        description: "Failed to delete issue",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <>
      <DndContext
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        collisionDetection={closestCorners}
      >
        <div className="flex gap-6 overflow-x-auto pb-4">
          {columns.map((column) => (
            <div key={column.id} className="flex-shrink-0 w-80">
              <Card className="h-full">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">
                      {column.name}
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCreateIssue(column.id)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <SortableContext
                    items={getIssuesForColumn(column.id).map(issue => issue.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <KanbanColumn
                      column={column}
                      issues={getIssuesForColumn(column.id)}
                      onEditIssue={handleEditIssue}
                      onDeleteIssue={handleDeleteIssue}
                    />
                  </SortableContext>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      </DndContext>

      <IssueDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        issue={selectedIssue}
        onSubmit={handleIssueSubmit}
      />
    </>
  );
}