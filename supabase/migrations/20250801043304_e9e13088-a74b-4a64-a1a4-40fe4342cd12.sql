-- Fix the RLS policy that's causing permission denied for table users
-- The issue is in the policy that references auth.users table directly

-- Drop the problematic policy that tries to access auth.users
DROP POLICY IF EXISTS "Users can view invitations sent to them" ON public.project_invitations;

-- Recreate it using email comparison without auth.users reference
-- Since we store email in project_invitations, we can use that directly with a function
CREATE OR REPLACE FUNCTION public.get_current_user_email()
RETURNS TEXT AS $$
  SELECT email FROM auth.users WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Create a new policy that doesn't cause permission errors
CREATE POLICY "Users can view invitations sent to their email" 
ON public.project_invitations 
FOR SELECT 
USING (email = get_current_user_email());