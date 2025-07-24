import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { UserPlus, MoreHorizontal, Trash2, Crown, User } from 'lucide-react';

interface TeamMember {
  id: string;
  user_id: string;
  role: 'owner' | 'contributor';
  joined_at: string | null;
  profiles: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

interface PendingInvitation {
  id: string;
  email: string;
  role: 'owner' | 'contributor';
  invited_at: string;
  expires_at: string;
}

interface TeamManagementProps {
  projectId: string;
  userId: string;
  isOwner: boolean;
}

export function TeamManagement({ projectId, userId, isOwner }: TeamManagementProps) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'contributor' | 'owner'>('contributor');
  const [isInviting, setIsInviting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchTeamData();
  }, [projectId]);

  const fetchTeamData = async () => {
    try {
      // Fetch current members
      const { data: membersData, error: membersError } = await supabase
        .from('project_members')
        .select('id, user_id, role, joined_at')
        .eq('project_id', projectId)
        .not('joined_at', 'is', null);

      if (membersError) throw membersError;

      // Fetch profiles for members
      const profilesPromises = (membersData || []).map(async (member) => {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, avatar_url')
          .eq('user_id', member.user_id)
          .maybeSingle();
        
        return {
          ...member,
          profiles: profile
        };
      });

      const membersWithProfiles = await Promise.all(profilesPromises);

      // If no members found but user is the owner, add them to the list
      if (membersWithProfiles.length === 0 && isOwner) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, avatar_url')
          .eq('user_id', userId)
          .maybeSingle();

        membersWithProfiles.push({
          id: 'owner-' + userId,
          user_id: userId,
          role: 'owner' as const,
          joined_at: new Date().toISOString(),
          profiles: profile
        });
      }

      // Try to fetch pending invitations, but don't fail if there's an error
      let invitationsData = [];
      try {
        const { data, error: invitationsError } = await supabase
          .from('project_invitations')
          .select('id, email, role, created_at, expires_at')
          .eq('project_id', projectId)
          .is('accepted_at', null)
          .gt('expires_at', new Date().toISOString());

        if (!invitationsError) {
          invitationsData = data || [];
        }
      } catch (invError) {
        console.log('Could not fetch invitations:', invError);
      }

      setMembers(membersWithProfiles as TeamMember[]);
      setPendingInvitations(invitationsData.map(inv => ({
        ...inv,
        invited_at: inv.created_at
      })) as PendingInvitation[]);
    } catch (error) {
      console.error('Error fetching team data:', error);
      toast({
        title: "Error",
        description: "Failed to fetch team data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInviteUser = async () => {
    if (!inviteEmail.trim()) return;

    setIsInviting(true);
    try {
      // First, revoke any existing pending invitations for this email
      await supabase
        .from('project_invitations')
        .delete()
        .eq('project_id', projectId)
        .eq('email', inviteEmail.trim().toLowerCase())
        .is('accepted_at', null);

      // Create new invitation
      const { data: invitationData, error: insertError } = await supabase
        .from('project_invitations')
        .insert({
          project_id: projectId,
          email: inviteEmail.trim().toLowerCase(),
          role: inviteRole,
          invited_by: userId,
        })
        .select('token')
        .single();

      if (insertError) throw insertError;

      // Get project and inviter details
      const { data: projectData } = await supabase
        .from('projects')
        .select('name')
        .eq('id', projectId)
        .single();

      const { data: inviterData } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', userId)
        .single();

      // Send invitation email
      const { error: emailError } = await supabase.functions.invoke('send-invitation', {
        body: {
          email: inviteEmail.trim().toLowerCase(),
          role: inviteRole,
          projectName: projectData?.name || 'Project',
          inviterName: inviterData?.full_name || 'Someone',
          invitationToken: invitationData.token,
        },
      });

      if (emailError) {
        console.error('Email error:', emailError);
        toast({
          title: "Warning",
          description: "Invitation created but email could not be sent. Please check your email configuration.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Invitation sent",
          description: `Invitation email sent to ${inviteEmail}`,
        });
      }
      
      setInviteEmail('');
      setIsDialogOpen(false);
      fetchTeamData();
    } catch (error) {
      console.error('Error inviting user:', error);
      toast({
        title: "Error",
        description: "Failed to send invitation",
        variant: "destructive",
      });
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      const { error } = await supabase
        .from('project_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      toast({
        title: "Member removed",
        description: "Team member has been removed from the project",
      });
      fetchTeamData();
    } catch (error) {
      console.error('Error removing member:', error);
      toast({
        title: "Error",
        description: "Failed to remove member",
        variant: "destructive",
      });
    }
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    try {
      const { error } = await supabase
        .from('project_invitations')
        .delete()
        .eq('id', invitationId);

      if (error) throw error;

      toast({
        title: "Invitation revoked",
        description: "Invitation has been revoked",
      });
      fetchTeamData();
    } catch (error) {
      console.error('Error revoking invitation:', error);
      toast({
        title: "Error",
        description: "Failed to revoke invitation",
        variant: "destructive",
      });
    }
  };

  const handleUpdateRole = async (memberId: string, newRole: 'owner' | 'contributor') => {
    try {
      const { error } = await supabase
        .from('project_members')
        .update({ role: newRole })
        .eq('id', memberId);

      if (error) throw error;

      toast({
        title: "Role updated",
        description: "Member role has been updated",
      });
      fetchTeamData();
    } catch (error) {
      console.error('Error updating role:', error);
      toast({
        title: "Error",
        description: "Failed to update role",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return <div className="animate-pulse h-32 bg-muted rounded-lg"></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Team Members</h3>
        {isOwner && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <UserPlus className="h-4 w-4 mr-2" />
                Invite Member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite Team Member</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="colleague@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="role">Role</Label>
                  <Select value={inviteRole} onValueChange={(value: 'contributor' | 'owner') => setInviteRole(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contributor">Contributor</SelectItem>
                      <SelectItem value="owner">Owner</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button 
                  onClick={handleInviteUser} 
                  disabled={isInviting || !inviteEmail.trim()}
                  className="w-full"
                >
                  {isInviting ? 'Sending...' : 'Send Invitation'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Current Members */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active Members ({members.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {members.map((member) => (
            <div key={member.id} className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center space-x-3">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-medium text-sm">
                    {member.profiles?.full_name || 'Unknown User'}
                  </p>
                  <div className="flex items-center space-x-2">
                    <Badge variant={member.role === 'owner' ? 'default' : 'secondary'} className="text-xs">
                      {member.role === 'owner' ? (
                        <>
                          <Crown className="h-3 w-3 mr-1" />
                          Owner
                        </>
                      ) : (
                        'Contributor'
                      )}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Joined {new Date(member.joined_at!).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
              {isOwner && member.user_id !== userId && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleUpdateRole(member.id, member.role === 'owner' ? 'contributor' : 'owner')}>
                      {member.role === 'owner' ? 'Make Contributor' : 'Make Owner'}
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => handleRemoveMember(member.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Remove
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Pending Invitations */}
      {pendingInvitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pending Invitations ({pendingInvitations.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingInvitations.map((invitation) => (
              <div key={invitation.id} className="flex items-center justify-between p-3 rounded-lg border border-dashed">
                <div className="flex items-center space-x-3">
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                    <User className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{invitation.email}</p>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline" className="text-xs">
                        {invitation.role}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        Expires {new Date(invitation.expires_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
                {isOwner && (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleRevokeInvitation(invitation.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}