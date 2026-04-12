/**
 * EmailService — powered by @emailjs/browser
 * 
 * To enable real emails:
 * 1. Sign up free at https://www.emailjs.com
 * 2. Create a new Email Service (Gmail, Outlook, etc.)
 * 3. Create an Email Template with these variables:
 *      {{to_email}}, {{to_name}}, {{hall_name}}, {{hall_block}},
 *      {{date}}, {{start_time}}, {{end_time}}, {{purpose}},
 *      {{attendance}}, {{booking_id}}
 * 4. Copy your Service ID, Template ID, and Public Key
 * 5. Create a .env file in the project root with:
 *      VITE_EMAILJS_SERVICE_ID=service_xxxxxxx
 *      VITE_EMAILJS_TEMPLATE_ID=template_xxxxxxx
 *      VITE_EMAILJS_PUBLIC_KEY=xxxxxxxxxxxxxxxxxxxx
 */

import emailjs from '@emailjs/browser';

const SERVICE_ID  = import.meta.env.VITE_EMAILJS_SERVICE_ID  ?? null;
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID ?? null;
const PUBLIC_KEY  = import.meta.env.VITE_EMAILJS_PUBLIC_KEY  ?? null;

const IS_CONFIGURED = !!(SERVICE_ID && TEMPLATE_ID && PUBLIC_KEY);

export const EmailService = {
  async sendBookingConfirmation(booking, user, auditorium) {
    if (!IS_CONFIGURED) {
      console.info(
        '[EmailService] Not configured. To enable real emails, add:\n' +
        '  VITE_EMAILJS_SERVICE_ID\n' +
        '  VITE_EMAILJS_TEMPLATE_ID\n' +
        '  VITE_EMAILJS_PUBLIC_KEY\n' +
        'to a .env file. See .env.example for details.'
      );
      // Return a friendly soft-fail — booking still succeeds
      return { success: false, error: 'Email not configured — see console for setup guide' };
    }

    try {
      // Format slot helper
      const fmt12 = (slot) => {
        if (!slot) return '';
        const [h, m] = slot.split(':');
        const hr = parseInt(h, 10);
        return `${hr % 12 || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`;
      };

      const templateParams = {
        to_email:    user.email,
        to_name:     user.name,
        hall_name:   auditorium.name,
        hall_block:  auditorium.block,
        date:        new Date(booking.date).toLocaleDateString(undefined, {
                       weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                     }),
        start_time:  fmt12(booking.startSlot),
        end_time:    fmt12(booking.endSlot),
        purpose:     booking.purpose,
        attendance:  booking.attendance,
        booking_id:  booking.id,
      };

      await emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams, PUBLIC_KEY);
      return { success: true, error: null };
    } catch (err) {
      console.warn('[EmailService] Failed to send:', err);
      return { success: false, error: err?.text || err?.message || 'Unknown error' };
    }
  }
};
