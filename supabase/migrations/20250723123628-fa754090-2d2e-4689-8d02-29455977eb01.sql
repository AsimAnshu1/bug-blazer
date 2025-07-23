-- Fix infinite recursion in RLS policies by using security definer functions

-- Create security definer function to check if user is project owner
CREATE OR REPLACE FUNCTION public.is_project_owner(project_id_param UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects 
    WHERE id = project_id_param 
    AND owner_id = auth.uid()
  );
$$;

-- Create security definer function to check if user is project member
CREATE OR REPLACE FUNCTION public.is_project_member(project_id_param UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members 
    WHERE project_id = project_id_param 
    AND user_id = auth.uid()
    AND joined_at IS NOT NULL
  );
$$;

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view members of projects they belong to" ON public.project_members;
DROP POLICY IF EXISTS "Project owners can manage members" ON public.project_members;
DROP POLICY IF EXISTS "Users can update their own membership" ON public.project_members;

DROP POLICY IF EXISTS "Users can view columns of accessible projects" ON public.columns;
DROP POLICY IF EXISTS "Project owners can manage columns" ON public.columns;

DROP POLICY IF EXISTS "Users can view issues of accessible projects" ON public.issues;
DROP POLICY IF EXISTS "Project members can manage issues" ON public.issues;

-- Recreate policies using security definer functions
CREATE POLICY "Users can view members of accessible projects"
ON public.project_members
FOR SELECT
USING (
  public.is_project_owner(project_id) OR 
  public.is_project_member(project_id)
);

CREATE POLICY "Project owners can manage members"
ON public.project_members
FOR ALL
USING (public.is_project_owner(project_id));

CREATE POLICY "Users can update their own membership"
ON public.project_members
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Recreate column policies
CREATE POLICY "Users can view columns of accessible projects"
ON public.columns
FOR SELECT
USING (
  public.is_project_owner(project_id) OR 
  public.is_project_member(project_id)
);

CREATE POLICY "Project owners and members can manage columns"
ON public.columns
FOR ALL
USING (
  public.is_project_owner(project_id) OR 
  public.is_project_member(project_id)
);

-- Recreate issue policies
CREATE POLICY "Users can view issues of accessible projects"
ON public.issues
FOR SELECT
USING (
  public.is_project_owner(project_id) OR 
  public.is_project_member(project_id)
);

CREATE POLICY "Project members can manage issues"
ON public.issues
FOR ALL
USING (
  public.is_project_owner(project_id) OR 
  public.is_project_member(project_id)
);

-- Insert dummy profiles for testing
INSERT INTO public.profiles (user_id, full_name, avatar_url) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Alice Developer', null),
  ('22222222-2222-2222-2222-222222222222', 'Bob Designer', null),
  ('33333333-3333-3333-3333-333333333333', 'Charlie Tester', null)
ON CONFLICT (user_id) DO NOTHING;

-- Insert dummy project members for testing (for the current project)
INSERT INTO public.project_members (project_id, user_id, role, invited_by, joined_at) VALUES
  ('a9e39531-5b22-49dd-add2-48922fb9daaa', '11111111-1111-1111-1111-111111111111', 'contributor', (SELECT owner_id FROM public.projects WHERE id = 'a9e39531-5b22-49dd-add2-48922fb9daaa'), now()),
  ('a9e39531-5b22-49dd-add2-48922fb9daaa', '22222222-2222-2222-2222-222222222222', 'contributor', (SELECT owner_id FROM public.projects WHERE id = 'a9e39531-5b22-49dd-add2-48922fb9daaa'), now()),
  ('a9e39531-5b22-49dd-add2-48922fb9daaa', '33333333-3333-3333-3333-333333333333', 'contributor', (SELECT owner_id FROM public.projects WHERE id = 'a9e39531-5b22-49dd-add2-48922fb9daaa'), now())
ON CONFLICT (project_id, user_id) DO NOTHING;