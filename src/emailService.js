/**
 * Email Service
 * Responsibilites: Securely transmit JSON payloads to Edge Function for Resend API tracking.
 * Security Spec: Fallback simulated mode executed if Edge Function unconfigured.
 */

export const EmailService = {
  async sendBookingConfirmation(booking, user, auditorium) {
    const EDGE_FN_URL = import.meta.env.VITE_EMAIL_FUNCTION_URL ?? null;

    if (!EDGE_FN_URL) {
      console.log("[EmailService] Simulated email to:", user.email, "for booking", booking.id);
      return { success: true, error: null };
    }

    try {
      const response = await fetch(EDGE_FN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking, user, auditorium })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      return { success: true, ...data };
    } catch (error) {
      console.warn("[EmailService] Error transmitting payload:", error.message);
      return { success: false, error: error.message };
    }
  }
};
