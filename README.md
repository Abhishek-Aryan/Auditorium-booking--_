<div align="center">
  <br />
  <h1>🎙️ AudiSync</h1>
  <p><strong>A Production-Grade College Auditorium Management System</strong></p>
  <br />
  <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
  <img src="https://img.shields.io/badge/Vite-B73BFE?style=for-the-badge&logo=vite&logoColor=FFD62E" alt="Vite" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind" />
  <img src="https://img.shields.io/badge/Framer_Motion-black?style=for-the-badge&logo=framer&logoColor=blue" alt="Framer Motion" />
</div>

<br />

**AudiSync** is a modern, high-performance web application designed to streamline the scheduling and management of college auditoriums. Built with a stunning "Electric Emerald" glassmorphic UI, it provides a seamless, conflict-free booking experience for students, teachers, and administrators.

---

## ✨ Features

- **Dynamic Booking & Conflicts Matrix:** Intelligent scheduling engine that supports flexible multi-hour spanning blocks. Instantly detects overlaps and proactively suggests alternative halls or available time slots.
- **Real-Time Timelines:** A fully interactive, responsive 12-hour visual matrix grid for analyzing daily flight-paths and current utilization of multiple auditorium spaces simultaneously.
- **Automated Email Clearance:** Integrated directly with **EmailJS** for instant, client-side automated email confirmation dispatches.
- **Mission Control Dashboard:** A comprehensive centralized dashboard delivering key analytics (daily load telemetry, peak hours, most active zones).
- **Identity & Authorization:** Session persistence with auto-generated profiles linked to institutional emails. Secure your own bookings with an in-app "Abort Mission" cancellation flow.
- **Glassmorphic Aesthetics:** Built with a premium, hyper-modern dark-mode design language heavily utilizing smooth `framer-motion` animations, lucide icons, and deep translucent blurring.

## 🛠️ Technology Stack

- **Frontend Framework:** React 18
- **Build Tool:** Vite
- **Styling:** Vanilla CSS + Tailwind CSS v4 Utilities
- **Animations:** Framer Motion
- **Icons:** `lucide-react`
- **Date Manipulation:** `date-fns`
- **Email Delivery:** `@emailjs/browser`

---

## 🚀 Getting Started

Follow these instructions to get a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

You will need **Node.js** installed on your system.

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Abhishek-Aryan/Auditorium_Booking.git
   cd Auditorium_Booking
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

### Enabling Email Notifications (Optional)

AudiSync uses EmailJS to send real confirmation emails straight from the browser. Without this, the system will still function but will gracefully bypass actual email sending.

1. Sign up for a free account at [EmailJS](https://www.emailjs.com/).
2. Add a new Email Service (e.g., Gmail).
3. Create a template using the provided variables: `{{to_email}}`, `{{to_name}}`, `{{hall_name}}`, `{{hall_block}}`, `{{date}}`, `{{start_time}}`, `{{end_time}}`, `{{purpose}}`, `{{attendance}}`, `{{booking_id}}`.
4. Copy the `.env.example` file to create your own localized `.env`:
   ```bash
   cp .env.example .env
   ```
5. Fill in your details inside `.env`:
   ```env
   VITE_EMAILJS_SERVICE_ID=your_service_id
   VITE_EMAILJS_TEMPLATE_ID=your_template_id
   VITE_EMAILJS_PUBLIC_KEY=your_public_key
   ```

### Launching

Run the Vite development server:
```bash
npm run dev
```

Your system will lock onto `http://localhost:5173`. Ready for deployment!

---

## 📂 Architecture Overview

- **`App.jsx`**: The command center. Contains the `BookingContext`, UI Layouts (`DashboardView`, `ScheduleView`, `MyBookingsView`), and the sophisticated `MockAPI` persistence layer leveraging `localStorage`.
- **`BookingEngine`**: A powerful, localized static class mapping complex validation logic and time-slot tracking.
- **`emailService.js`**: Abstraction boundary securely integrating `@emailjs/browser` for safe client-side telemetry dispatches.

## 🤝 Contributing
Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/Abhishek-Aryan/Auditorium_Booking/issues).

---
<div align="center">
  <sub>Developed to push the boundaries of frontend architecture and premium UX design.</sub>
</div>
