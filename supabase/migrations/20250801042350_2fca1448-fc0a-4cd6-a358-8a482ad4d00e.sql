-- Fix RLS policies for project_invitations to allow both owners AND members to create invitations
-- This is needed because the team management interface should be accessible to team members

-- Drop the existing policies
DROP POLICY IF EXISTS "Project owners can create invitations" ON public.project_invitations;
DROP POLICY IF EXISTS "Project owners can update invitations" ON public.project_invitations;
DROP POLICY IF EXISTS "Project owners can delete invitations" ON public.project_invitations;
DROP POLICY IF EXISTS "Project owners can view invitations" ON public.project_invitations;

-- Create new policies that allow both owners and members to manage invitations
CREATE POLICY "Project members can create invitations" 
ON public.project_invitations 
FOR INSERT 
WITH CHECK (is_project_owner(project_id) OR is_project_member(project_id));

CREATE POLICY "Project members can update invitations" 
ON public.project_invitations 
FOR UPDATE 
USING (is_project_owner(project_id) OR is_project_member(project_id));

CREATE POLICY "Project members can delete invitations" 
ON public.project_invitations 
FOR DELETE 
USING (is_project_owner(project_id) OR is_project_member(project_id));

CREATE POLICY "Project members can view invitations" 
ON public.project_invitations 
FOR SELECT 
USING (is_project_owner(project_id) OR is_project_member(project_id));