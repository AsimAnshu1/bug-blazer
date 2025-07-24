import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InvitationRequest {
  email: string;
  role: string;
  projectName: string;
  inviterName: string;
  invitationToken: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, role, projectName, inviterName, invitationToken }: InvitationRequest = await req.json();

    console.log(`Sending invitation to ${email} for project ${projectName}`);

    const invitationUrl = `${req.headers.get('origin')}/accept-invitation?token=${invitationToken}`;

    const emailResponse = await resend.emails.send({
      from: "Project Invitations <onboarding@resend.dev>",
      to: [email],
      subject: `You're invited to join "${projectName}"`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333; font-size: 24px; margin-bottom: 20px;">You're invited to collaborate!</h1>
          
          <p style="color: #666; font-size: 16px; line-height: 1.5;">
            <strong>${inviterName}</strong> has invited you to join the project <strong>"${projectName}"</strong> as a <strong>${role}</strong>.
          </p>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #333; margin-top: 0;">Project: ${projectName}</h3>
            <p style="color: #666; margin: 5px 0;"><strong>Role:</strong> ${role}</p>
            <p style="color: #666; margin: 5px 0;"><strong>Invited by:</strong> ${inviterName}</p>
          </div>
          
          <a href="${invitationUrl}" 
             style="display: inline-block; background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0;">
            Accept Invitation
          </a>
          
          <p style="color: #888; font-size: 14px; margin-top: 30px;">
            If you can't click the button above, copy and paste this link into your browser:<br>
            <a href="${invitationUrl}" style="color: #007bff; word-break: break-all;">${invitationUrl}</a>
          </p>
          
          <p style="color: #888; font-size: 12px; margin-top: 20px; border-top: 1px solid #eee; padding-top: 20px;">
            This invitation will expire in 7 days. If you didn't expect this invitation, you can safely ignore this email.
          </p>
        </div>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, emailResponse }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error sending invitation email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);