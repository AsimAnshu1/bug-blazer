-- Create enum for member roles
CREATE TYPE public.member_role AS ENUM ('owner', 'contributor');

-- Create project_members table for collaboration
CREATE TABLE public.project_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  user_id UUID NOT NULL,
  role member_role NOT NULL DEFAULT 'contributor',
  invited_by UUID NOT NULL,
  invited_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  joined_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);

-- Create project_invitations table
CREATE TABLE public.project_invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  email TEXT NOT NULL,
  role member_role NOT NULL DEFAULT 'contributor',
  invited_by UUID NOT NULL,
  token UUID NOT NULL DEFAULT gen_random_uuid(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, email)
);

-- Enable RLS
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_invitations ENABLE ROW LEVEL SECURITY;

-- RLS policies for project_members
CREATE POLICY "Users can view members of projects they belong to"
ON public.project_members
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.projects p 
    WHERE p.id = project_members.project_id 
    AND p.owner_id = auth.uid()
  ) OR 
  EXISTS (
    SELECT 1 FROM public.project_members pm 
    WHERE pm.project_id = project_members.project_id 
    AND pm.user_id = auth.uid()
    AND pm.joined_at IS NOT NULL
  )
);

CREATE POLICY "Project owners can manage members"
ON public.project_members
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.projects p 
    WHERE p.id = project_members.project_id 
    AND p.owner_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own membership"
ON public.project_members
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- RLS policies for project_invitations
CREATE POLICY "Project owners can manage invitations"
ON public.project_invitations
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.projects p 
    WHERE p.id = project_invitations.project_id 
    AND p.owner_id = auth.uid()
  )
);

CREATE POLICY "Users can view invitations sent to them"
ON public.project_invitations
FOR SELECT
USING (
  email = (SELECT email FROM auth.users WHERE id = auth.uid())
);

-- Update existing RLS policies for projects, columns, and issues to include project members

-- Drop existing policies
DROP POLICY "Users can view columns of their projects" ON public.columns;
DROP POLICY "Users can manage columns of their projects" ON public.columns;
DROP POLICY "Users can view issues of their projects" ON public.issues;
DROP POLICY "Users can manage issues of their projects" ON public.issues;

-- Recreate with member access
CREATE POLICY "Users can view columns of accessible projects"
ON public.columns
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.projects p 
    WHERE p.id = columns.project_id 
    AND p.owner_id = auth.uid()
  ) OR 
  EXISTS (
    SELECT 1 FROM public.project_members pm 
    WHERE pm.project_id = columns.project_id 
    AND pm.user_id = auth.uid()
    AND pm.joined_at IS NOT NULL
  )
);

CREATE POLICY "Project owners can manage columns"
ON public.columns
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.projects p 
    WHERE p.id = columns.project_id 
    AND p.owner_id = auth.uid()
  )
);

CREATE POLICY "Users can view issues of accessible projects"
ON public.issues
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.projects p 
    WHERE p.id = issues.project_id 
    AND p.owner_id = auth.uid()
  ) OR 
  EXISTS (
    SELECT 1 FROM public.project_members pm 
    WHERE pm.project_id = issues.project_id 
    AND pm.user_id = auth.uid()
    AND pm.joined_at IS NOT NULL
  )
);

CREATE POLICY "Project members can manage issues"
ON public.issues
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.projects p 
    WHERE p.id = issues.project_id 
    AND p.owner_id = auth.uid()
  ) OR 
  EXISTS (
    SELECT 1 FROM public.project_members pm 
    WHERE pm.project_id = issues.project_id 
    AND pm.user_id = auth.uid()
    AND pm.joined_at IS NOT NULL
  )
);

-- Function to automatically add project owner as member
CREATE OR REPLACE FUNCTION public.add_owner_as_member()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.project_members (project_id, user_id, role, invited_by, joined_at)
  VALUES (NEW.id, NEW.owner_id, 'owner', NEW.owner_id, now());
  RETURN NEW;
END;
$$;

-- Trigger to add owner as member when project is created
CREATE TRIGGER add_owner_as_member_trigger
  AFTER INSERT ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.add_owner_as_member();

-- Add trigger for updating timestamps
CREATE TRIGGER update_project_members_updated_at
  BEFORE UPDATE ON public.project_members
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to accept invitation
CREATE OR REPLACE FUNCTION public.accept_invitation(invitation_token UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  invitation_record RECORD;
  result JSON;
BEGIN
  -- Get invitation details
  SELECT * INTO invitation_record 
  FROM public.project_invitations 
  WHERE token = invitation_token 
  AND expires_at > now() 
  AND accepted_at IS NULL;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Invalid or expired invitation');
  END IF;
  
  -- Check if user email matches invitation
  IF (SELECT email FROM auth.users WHERE id = auth.uid()) != invitation_record.email THEN
    RETURN json_build_object('success', false, 'error', 'Email does not match invitation');
  END IF;
  
  -- Add user to project members
  INSERT INTO public.project_members (project_id, user_id, role, invited_by, joined_at)
  VALUES (invitation_record.project_id, auth.uid(), invitation_record.role, invitation_record.invited_by, now())
  ON CONFLICT (project_id, user_id) 
  DO UPDATE SET joined_at = now(), role = invitation_record.role;
  
  -- Mark invitation as accepted
  UPDATE public.project_invitations 
  SET accepted_at = now() 
  WHERE id = invitation_record.id;
  
  RETURN json_build_object('success', true, 'project_id', invitation_record.project_id);
END;
$$;