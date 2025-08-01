-- Fix missing project owner membership - add the project owner as a member for existing projects
-- This ensures owners can send invitations and access team features

INSERT INTO public.project_members (project_id, user_id, role, invited_by, joined_at)
SELECT 
  p.id,
  p.owner_id,
  'owner'::member_role,
  p.owner_id,
  now()
FROM public.projects p
LEFT JOIN public.project_members pm ON p.id = pm.project_id AND p.owner_id = pm.user_id
WHERE pm.id IS NULL
ON CONFLICT (project_id, user_id) DO NOTHING;