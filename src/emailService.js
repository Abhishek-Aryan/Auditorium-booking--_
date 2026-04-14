/**
 * EmailService — powered by @emailjs/browser
 *
 * Setup (free):
 * 1. Sign up at https://www.emailjs.com
 * 2. Connect a Gmail/Outlook service
 * 3. Create a template with these variables:
 *    {{to_email}}, {{to_name}}, {{roll_no}}, {{hall_name}}, {{hall_block}},
 *    {{date}}, {{slot_type}}, {{start_time}}, {{end_time}},
 *    {{purpose}}, {{attendance}}, {{booking_id}}
 * 4. Create a .env file:
 *    VITE_EMAILJS_SERVICE_ID=service_xxxxxxx
 *    VITE_EMAILJS_TEMPLATE_ID=template_xxxxxxx
 *    VITE_EMAILJS_PUBLIC_KEY=xxxxxxxxxxxxxxxxxxxx
 */

import emailjs from '@emailjs/browser';

const SERVICE_ID  = import.meta.env.VITE_EMAILJS_SERVICE_ID  ?? null;
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID ?? null;
const PUBLIC_KEY  = import.meta.env.VITE_EMAILJS_PUBLIC_KEY  ?? null;

const IS_CONFIGURED = !!(SERVICE_ID && TEMPLATE_ID && PUBLIC_KEY);

const HALF_SLOT_LABELS = {
  morning:   'Morning Slot (10:00 AM – 1:00 PM)',
  afternoon: 'Afternoon Slot (1:00 PM – 5:00 PM)',
};

export const EmailService = {
  async sendBookingConfirmation(booking, user, auditorium) {
    if (!IS_CONFIGURED) {
      console.info(
        '[EmailService] Not configured. Add VITE_EMAILJS_* keys to .env to enable real emails.\n' +
        'See .env.example for setup guide.'
      );
      return { success: false, error: 'Email not configured — see console for setup guide' };
    }

    try {
      const templateParams = {
        to_email:    user.email,
        to_name:     user.name,
        roll_no:     booking.roll_no || user.rollNo || 'N/A',
        hall_name:   auditorium.name,
        hall_block:  auditorium.block,
        date:        new Date(booking.date).toLocaleDateString('en-IN', {
                       weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                     }),
        slot_type:   HALF_SLOT_LABELS[booking.halfSlot] || `${booking.startSlot} – ${booking.endSlot}`,
        start_time:  booking.startSlot,
        end_time:    booking.endSlot,
        purpose:     booking.purpose,
        attendance:  booking.attendance,
        booking_id:  booking.id,
      };

      await emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams, PUBLIC_KEY);
      return { success: true, error: null };
    } catch (err) {
      console.warn('[EmailService] Send failed:', err);
      return { success: false, error: err?.text || err?.message || 'Unknown error' };
    }
  },
};
