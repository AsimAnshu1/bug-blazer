import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User } from 'lucide-react';

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

interface TeamMember {
  id: string;
  user_id: string;
  profiles: {
    full_name: string | null;
  } | null;
}

interface IssueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issue?: Issue | null;
  onSubmit: (issueData: Partial<Issue>) => void;
  projectId: string;
}

export function IssueDialog({ open, onOpenChange, issue, onSubmit, projectId }: IssueDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open && projectId) {
      fetchTeamMembers();
    }
  }, [open, projectId]);

  useEffect(() => {
    if (issue) {
      setTitle(issue.title);
      setDescription(issue.description || '');
      setPriority(issue.priority);
      setAssigneeId(issue.assignee_id || '');
    } else {
      setTitle('');
      setDescription('');
      setPriority('medium');
      setAssigneeId('');
    }
  }, [issue, open]);

  const fetchTeamMembers = async () => {
    try {
      const { data: membersData, error: membersError } = await supabase
        .from('project_members')
        .select('id, user_id')
        .eq('project_id', projectId)
        .not('joined_at', 'is', null);

      if (membersError) throw membersError;

      // Fetch profiles for members
      const profilesPromises = (membersData || []).map(async (member) => {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', member.user_id)
          .maybeSingle();
        
        return {
          ...member,
          profiles: profile
        };
      });

      const membersWithProfiles = await Promise.all(profilesPromises);
      setTeamMembers(membersWithProfiles as TeamMember[]);
    } catch (error) {
      console.error('Error fetching team members:', error);
      toast({
        title: "Error",
        description: "Failed to fetch team members",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await onSubmit({
        title,
        description,
        priority,
        assignee_id: assigneeId || null,
      });
      onOpenChange(false);
    } catch (error) {
      console.error('Error submitting issue:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
    setTitle('');
    setDescription('');
    setPriority('medium');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {issue ? 'Edit Issue' : 'Create New Issue'}
          </DialogTitle>
          <DialogDescription>
            {issue 
              ? 'Update the issue details below.' 
              : 'Create a new issue to track a bug or task.'
            }
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter issue title"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the issue in detail"
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <Select value={priority} onValueChange={(value: 'low' | 'medium' | 'high' | 'urgent') => setPriority(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="assignee">Assignee</Label>
            <Select value={assigneeId} onValueChange={setAssigneeId}>
              <SelectTrigger>
                <SelectValue placeholder="Select assignee (optional)">
                  {assigneeId ? (
                    <div className="flex items-center space-x-2">
                      <User className="h-4 w-4" />
                      <span>
                        {teamMembers.find(m => m.user_id === assigneeId)?.profiles?.full_name || 'Unknown User'}
                      </span>
                    </div>
                  ) : (
                    'Select assignee (optional)'
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No assignee</SelectItem>
                {teamMembers.map((member) => (
                  <SelectItem key={member.user_id} value={member.user_id}>
                    <div className="flex items-center space-x-2">
                      <User className="h-4 w-4" />
                      <span>{member.profiles?.full_name || 'Unknown User'}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !title.trim()}>
              {isLoading ? 'Saving...' : (issue ? 'Update Issue' : 'Create Issue')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}