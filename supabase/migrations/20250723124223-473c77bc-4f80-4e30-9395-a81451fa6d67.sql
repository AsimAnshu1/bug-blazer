-- Fix function search path security warnings
CREATE OR REPLACE FUNCTION public.is_project_owner(project_id_param UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects 
    WHERE id = project_id_param 
    AND owner_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_project_member(project_id_param UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members 
    WHERE project_id = project_id_param 
    AND user_id = auth.uid()
    AND joined_at IS NOT NULL
  );
$$;