import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, XCircle, UserPlus } from 'lucide-react';

export default function AcceptInvitation() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, signIn, signUp } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState<any>(null);
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'need-auth'>('loading');
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setLoading(false);
      return;
    }

    fetchInvitation();
  }, [token]);

  useEffect(() => {
    if (user && invitation) {
      handleAcceptInvitation();
    }
  }, [user, invitation]);

  const fetchInvitation = async () => {
    try {
      const { data, error } = await supabase
        .from('project_invitations')
        .select('*, projects(name)')
        .eq('token', token)
        .is('accepted_at', null)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (error || !data) {
        setStatus('error');
        toast({
          title: "Invalid invitation",
          description: "This invitation is invalid or has expired.",
          variant: "destructive",
        });
      } else {
        setInvitation(data);
        setEmail(data.email);
        if (user) {
          if (user.email === data.email) {
            handleAcceptInvitation();
          } else {
            setStatus('error');
            toast({
              title: "Email mismatch",
              description: "You must be logged in with the invited email address.",
              variant: "destructive",
            });
          }
        } else {
          setStatus('need-auth');
        }
      }
    } catch (error) {
      console.error('Error fetching invitation:', error);
      setStatus('error');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptInvitation = async () => {
    if (!user || !invitation) return;

    try {
      setLoading(true);
      
      const { error } = await supabase.rpc('accept_invitation', {
        invitation_token: token,
      });

      if (error) throw error;

      setStatus('success');
      toast({
        title: "Invitation accepted",
        description: `You've successfully joined "${invitation.projects.name}"!`,
      });

      setTimeout(() => {
        navigate(`/project/${invitation.project_id}`);
      }, 2000);
    } catch (error: any) {
      console.error('Error accepting invitation:', error);
      setStatus('error');
      toast({
        title: "Error",
        description: error.message || "Failed to accept invitation",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setAuthLoading(true);
    try {
      if (authMode === 'signin') {
        const { error } = await signIn(email, password);
        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            toast({
              title: "Account not found",
              description: "No account found with this email. Try signing up instead.",
              variant: "destructive",
            });
          } else {
            throw error;
          }
        }
      } else {
        const { error } = await signUp(email, password);
        if (error) throw error;
        
        toast({
          title: "Account created",
          description: "Your account has been created. You can now accept the invitation.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Authentication error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setAuthLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="text-center p-8">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Welcome to the team!</h1>
            <p className="text-muted-foreground mb-4">
              You've successfully joined "{invitation?.projects?.name}". 
              Redirecting to the project...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="text-center p-8">
            <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Invalid Invitation</h1>
            <p className="text-muted-foreground mb-4">
              This invitation link is invalid or has expired.
            </p>
            <Button onClick={() => navigate('/dashboard')}>
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'need-auth') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center flex items-center justify-center gap-2">
              <UserPlus className="h-6 w-6" />
              Join "{invitation?.projects?.name}"
            </CardTitle>
            <p className="text-center text-muted-foreground">
              You've been invited as a <strong>{invitation?.role}</strong>
            </p>
          </CardHeader>
          <CardContent>
            <div className="text-center mb-4">
              <Button
                variant={authMode === 'signin' ? 'default' : 'outline'}
                onClick={() => setAuthMode('signin')}
                className="mr-2"
              >
                Sign In
              </Button>
              <Button
                variant={authMode === 'signup' ? 'default' : 'outline'}
                onClick={() => setAuthMode('signup')}
              >
                Sign Up
              </Button>
            </div>
            
            <form onSubmit={handleAuth} className="space-y-4">
              <div>
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-3 border rounded-lg"
                  disabled={true} // Email is pre-filled from invitation
                />
              </div>
              <div>
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-3 border rounded-lg"
                  required
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={authLoading || !password}
              >
                {authLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                {authMode === 'signin' ? 'Sign In & Accept' : 'Sign Up & Accept'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}