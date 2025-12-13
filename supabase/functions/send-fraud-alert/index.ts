// Deno.serve is now built-in
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface FraudAlertRequest {
  email: string;
  callId: string;
  riskScore: number;
  fraudIndicators: string[];
  duration: number;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("Fraud alert function invoked");

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, callId, riskScore, fraudIndicators, duration }: FraudAlertRequest = await req.json();

    console.log(`Sending fraud alert to ${email} for call ${callId}`);

    const indicatorsList = fraudIndicators.length > 0
      ? fraudIndicators.map(i => `<li style="color: #ef4444; margin: 8px 0;">${i}</li>`).join('')
      : '<li style="color: #888;">No specific indicators detected</li>';

    const emailResponse = await resend.emails.send({
      from: "CallGuard-Sentinel <onboarding@resend.dev>",
      to: [email],
      subject: `🚨 High-Risk Fraud Alert - Risk Score: ${riskScore.toFixed(0)}%`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
        </head>
        <body style="font-family: 'IBM Plex Sans', Arial, sans-serif; background-color: #0a0a0a; color: #f5f5f5; padding: 40px 20px; margin: 0;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #141414; border-radius: 12px; padding: 32px; border: 1px solid #262626;">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 24px;">
              <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #ef4444, #dc2626); border-radius: 8px; display: flex; align-items: center; justify-content: center;">
                <span style="font-size: 20px;">🛡️</span>
              </div>
              <h1 style="margin: 0; font-size: 24px; font-weight: 700;">CallGuard-Sentinel</h1>
            </div>
            
            <div style="background-color: #1f1f1f; border-radius: 8px; padding: 20px; margin-bottom: 24px; border-left: 4px solid #ef4444;">
              <h2 style="color: #ef4444; margin: 0 0 8px 0; font-size: 18px;">⚠️ High-Risk Call Detected</h2>
              <p style="margin: 0; color: #999;">A call has been flagged as potentially fraudulent.</p>
            </div>
            
            <div style="margin-bottom: 24px;">
              <h3 style="color: #f5f5f5; margin-bottom: 16px;">Call Details</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 12px; background-color: #1f1f1f; border-radius: 8px 0 0 0;">
                    <span style="color: #888; font-size: 12px; text-transform: uppercase;">Risk Score</span><br>
                    <span style="color: #ef4444; font-size: 24px; font-weight: 700;">${riskScore.toFixed(0)}%</span>
                  </td>
                  <td style="padding: 12px; background-color: #1f1f1f; border-radius: 0 8px 0 0;">
                    <span style="color: #888; font-size: 12px; text-transform: uppercase;">Duration</span><br>
                    <span style="color: #f5f5f5; font-size: 24px; font-weight: 700;">${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}</span>
                  </td>
                </tr>
              </table>
            </div>
            
            <div style="margin-bottom: 24px;">
              <h3 style="color: #f5f5f5; margin-bottom: 12px;">Detected Fraud Indicators</h3>
              <ul style="list-style: none; padding: 0; margin: 0; background-color: #1f1f1f; border-radius: 8px; padding: 16px;">
                ${indicatorsList}
              </ul>
            </div>
            
            <div style="text-align: center; padding-top: 24px; border-top: 1px solid #262626;">
              <p style="color: #888; font-size: 12px; margin: 0;">
                This is an automated alert from CallGuard-Sentinel fraud detection system.
              </p>
              <p style="color: #666; font-size: 11px; margin: 8px 0 0 0;">
                Call ID: ${callId}
              </p>
            </div>
          </div>
        </body>
        </html>
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
    console.error("Error in send-fraud-alert function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

Deno.serve(handler);
