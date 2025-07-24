-- Fix RLS policies for project_invitations table to allow project owners to create invitations

-- Drop the existing problematic policy
DROP POLICY IF EXISTS "Project owners can manage invitations" ON public.project_invitations;

-- Create new policies that properly allow project owners to manage invitations
CREATE POLICY "Project owners can create invitations" 
ON public.project_invitations 
FOR INSERT 
WITH CHECK (is_project_owner(project_id));

CREATE POLICY "Project owners can update invitations" 
ON public.project_invitations 
FOR UPDATE 
USING (is_project_owner(project_id));

CREATE POLICY "Project owners can delete invitations" 
ON public.project_invitations 
FOR DELETE 
USING (is_project_owner(project_id));

CREATE POLICY "Project owners can view invitations" 
ON public.project_invitations 
FOR SELECT 
USING (is_project_owner(project_id));