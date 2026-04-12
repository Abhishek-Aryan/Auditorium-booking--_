import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const { booking, user, auditorium } = payload;

    if (!booking || !user || !auditorium) {
      throw new Error("Missing required payload fields");
    }

    if (!RESEND_API_KEY) {
      throw new Error("Missing RESEND_API_KEY securely injected env variable");
    }

    // HTML Email Generation per specifications
    const htmlBody = `
      <div style="font-family: -apple-system, sans-serif; background-color: #0F172A; color: #F8FAFC; padding: 16px; margin: 0; width: 100%; box-sizing: border-box;">
        <div style="max-width: 560px; margin: 0 auto; background-color: #0F172A;">
          
          <!-- Header -->
          <h1 style="color: #F8FAFC; margin-bottom: 4px; font-weight: 700;">AudiSync</h1>
          <p style="color: #10B981; font-weight: 600; margin-top: 0; font-size: 18px;">Your booking is confirmed</p>
          
          <!-- Booking Details Card -->
          <div style="background-color: #1E293B; border-radius: 12px; padding: 24px; margin: 24px 0; border: 1px solid rgba(255,255,255,0.1);">
            <table cellpadding="0" cellspacing="0" style="width: 100%; font-size: 15px; color: #F8FAFC; line-height: 1.6;">
              <tr><td style="padding-bottom: 8px; color: #94A3B8; width: 100px;">Hall:</td><td style="padding-bottom: 8px; font-weight: 600;">${auditorium.name}</td></tr>
              <tr><td style="padding-bottom: 8px; color: #94A3B8;">Block:</td><td style="padding-bottom: 8px;">${auditorium.block}</td></tr>
              <tr><td style="padding-bottom: 8px; color: #94A3B8;">Date:</td><td style="padding-bottom: 8px;">${new Date(booking.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</td></tr>
              <tr><td style="padding-bottom: 8px; color: #94A3B8;">Time:</td><td style="padding-bottom: 8px;">${booking.startSlot} – ${booking.endSlot}</td></tr>
              <tr><td style="padding-bottom: 8px; color: #94A3B8;">Purpose:</td><td style="padding-bottom: 8px; line-height: 1.4;">${booking.purpose}</td></tr>
              <tr><td style="padding-bottom: 8px; color: #94A3B8;">Attendance:</td><td style="padding-bottom: 8px;">${booking.attendance} people</td></tr>
              <tr><td style="color: #94A3B8;">Status:</td><td style="font-weight: 600; color: ${booking.status === 'confirmed' ? '#10B981' : '#F59E0B'};">${booking.status === 'confirmed' ? 'Confirmed' : 'Pending Approval'}</td></tr>
            </table>
          </div>

          <!-- Conditional Notice -->
          ${booking.status === 'pending' ? `
            <div style="background-color: rgba(245, 158, 11, 0.1); border-left: 4px solid #F59E0B; padding: 16px; margin-bottom: 24px; border-radius: 4px;">
              <p style="color: #F59E0B; margin: 0; font-weight: 500;">Your booking is pending teacher approval. You will receive another email once approved.</p>
            </div>
          ` : `
            <div style="background-color: rgba(16, 185, 129, 0.1); border-left: 4px solid #10B981; padding: 16px; margin-bottom: 24px; border-radius: 4px;">
              <p style="color: #10B981; margin: 0; font-weight: 500;">Your slot is locked in. Please arrive 10 minutes early.</p>
            </div>
          `}

          <!-- Action Button -->
          <a href="${req.headers.get("origin") || 'https://audisync.app'}/" style="display: inline-block; background-color: #10B981; color: #0F172A; font-weight: 600; text-decoration: none; padding: 14px 28px; border-radius: 8px; margin-bottom: 40px;">
            View My Bookings
          </a>

          <!-- Footer -->
          <div style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 24px; color: #94A3B8; font-size: 13px;">
            <p style="margin-top: 0; margin-bottom: 6px;">Booked via AudiSync &middot; Campus Scheduling</p>
            <p style="margin-top: 0; margin-bottom: 6px;">Booking ID: <span style="font-family: monospace;">${booking.id}</span></p>
            <p style="margin-top: 20px; font-style: italic;">If you did not make this booking, please contact your campus admin.</p>
          </div>

        </div>
      </div>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "AudiSync <onboarding@resend.dev>", // Change to verified domain
        to: [user.email], // In dev sandbox, Resend only allows sending to verified email
        subject: `Booking Confirmed — ${auditorium.name} on ${booking.date} at ${booking.startSlot}`,
        html: htmlBody,
      }),
    });

    const data = await res.json();
    
    if (res.ok) {
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    } else {
      console.error("[Resend API Error]", data);
      return new Response(JSON.stringify({ success: false, error: data.message || "Failed to send email" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }
  } catch (error) {
    console.error("[Function Error]", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
