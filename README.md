# 🎙️ AudiSync — College Auditorium Management System

<div align="center">

![AudiSync Banner](https://img.shields.io/badge/AudiSync-v4.0-emerald?style=for-the-badge&logo=react&logoColor=white)
![Built With](https://img.shields.io/badge/Built%20With-React%2019%20%2B%20Vite%208-indigo?style=for-the-badge&logo=vite&logoColor=white)
![Database](https://img.shields.io/badge/Database-Supabase-green?style=for-the-badge&logo=supabase&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)

**A production-grade, real-time auditorium booking platform for VNR Vignana Jyothi Institute of Engineering & Technology.**

[Live Demo](#) · [Report Bug](https://github.com/Abhishek-Aryan/Auditorium-booking--_/issues) · [Request Feature](https://github.com/Abhishek-Aryan/Auditorium-booking--_/issues)

</div>

---

## ✨ Features

- 🔄 **Real-Time Sync** — Powered by Supabase Realtime WebSockets. Every booking instantly appears for all users simultaneously. Zero double-bookings, ever.
- 🗓️ **Half-Slot Grid** — Book Morning (10 AM – 1 PM) or Afternoon (1 PM – 5 PM) slots across 10 halls on a shared visual grid.
- 📅 **Mini Calendar** — Navigate dates up to 30 days ahead with a responsive inline date picker.
- 📧 **Email Confirmations** — Automated booking confirmation emails via EmailJS, complete with all booking details.
- 🛡️ **Role-Based Access** — Three distinct roles: `Admin`, `Faculty`, and `Club Lead`, each with appropriate permissions.
- 🧾 **Booking Receipts** — Expandable receipt cards in "My Bookings" with full event details.
- ⚡ **Slot Expiry** — Past time slots are automatically marked as expired and cannot be booked.
- 🎨 **Premium Dark UI** — Glassmorphism design with smooth Framer Motion animations, built with TailwindCSS v4.
- 📱 **Fully Responsive** — Works beautifully on mobile, tablet, and desktop.

---

## 🏛️ Auditoriums

| Hall | Block |
|------|-------|
| APJ Abdul Kalam Auditorium | D Block |
| PG Block Seminar Hall | PG Block |
| B Block Seminar Hall | B Block |
| KS Auditorium | C Block |
| E Block Seminars (Floor 0–5) | E Block |

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, Vite 8 |
| **Styling** | TailwindCSS v4, Framer Motion |
| **Database** | Supabase (PostgreSQL) |
| **Real-Time** | Supabase Realtime (WebSockets) |
| **Email** | EmailJS (`@emailjs/browser`) |
| **Icons** | Lucide React |
| **Date Utils** | date-fns |

---

## 🚀 Getting Started

### Prerequisites

- Node.js `v18+`
- A [Supabase](https://supabase.com) project (free tier works)
- An [EmailJS](https://emailjs.com) account (free tier works)

### 1. Clone the Repository

```bash
git clone https://github.com/Abhishek-Aryan/Auditorium-booking--_.git
cd Auditorium-booking--_
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Supabase Database

In your Supabase project, go to **SQL Editor** and run the following:

```sql
-- Create the shared bookings table
CREATE TABLE public.bookings (
  id text PRIMARY KEY,
  auditoriumid text NOT NULL,
  date text NOT NULL,
  startslot text NOT NULL,
  endslot text NOT NULL,
  halfslot text NOT NULL,
  userid text NOT NULL,
  purpose text NOT NULL,
  attendance integer NOT NULL,
  status text NOT NULL,
  approvedby text,
  createdat text NOT NULL,
  requester_name text,
  roll_no text,
  phone text,
  email text
);

-- Enable Realtime WebSocket sync
ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;

-- Disable Row Level Security for MVP
ALTER TABLE public.bookings DISABLE ROW LEVEL SECURITY;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
```

### 4. Configure Environment Variables

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

```env
# EmailJS — https://emailjs.com/dashboard
VITE_EMAILJS_SERVICE_ID=service_xxxxxxx
VITE_EMAILJS_TEMPLATE_ID=template_xxxxxxx
VITE_EMAILJS_PUBLIC_KEY=xxxxxxxxxxxxxxxxxxxx

# Supabase — https://supabase.com/dashboard/project/_/settings/api
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 5. Set Up EmailJS Template

In your EmailJS dashboard, create a template with these variables:

| Variable | Description |
|---|---|
| `{{to_email}}` | Recipient's email (**set this in the "To Email" field**) |
| `{{to_name}}` | Recipient's full name |
| `{{hall_name}}` | Auditorium name |
| `{{hall_block}}` | Block location |
| `{{date}}` | Booking date |
| `{{slot_type}}` | Morning / Afternoon slot |
| `{{purpose}}` | Event purpose |
| `{{attendance}}` | Expected attendees |
| `{{booking_id}}` | Unique booking ID |

### 6. Run the Development Server

```bash
npm run dev
```

App is now running at **http://localhost:5173** 🎉

---

## 📁 Project Structure

```
auditorium-booking/
├── src/
│   ├── App.jsx            # Main application (all views and components)
│   ├── supabaseClient.js  # Supabase connection instance
│   ├── emailService.js    # EmailJS email sender
│   ├── index.css          # Global styles
│   └── main.jsx           # React entry point
├── public/                # Static assets
├── .env.example           # Environment variable template
├── vite.config.js         # Vite configuration
├── eslint.config.js       # ESLint rules
└── package.json           # Dependencies
```

---

## 🔐 Role System

| Role | Access |
|------|--------|
| `admin` | Full access: view all bookings, approve/cancel any booking, analytics |
| `teacher` | Book slots (auto-confirmed), view own bookings |
| `club_lead` | Book slots (auto-confirmed), view own bookings |

> Seed users with `@vnrvjiet.in` emails are automatically matched to pre-configured roles. All other `@vnrvjiet.in` emails register as new users.

---

## 🔄 Real-Time Architecture

```
User A books a slot
       │
       ▼
Supabase Database (INSERT)
       │
       ▼
Supabase Realtime broadcasts event
       │
  ┌────┴────┐
  ▼         ▼
User B    User C
(instant  (instant
 update)   update)
```

All connected clients subscribe to `postgres_changes` on the `bookings` table. Any `INSERT`, `UPDATE`, or `DELETE` triggers an immediate UI refresh, preventing double-bookings at the source.

---

## 📜 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

<div align="center">

**Built with ❤️ for VNR VJIET**

© 2025 VNR Vignana Jyothi Institute of Engineering & Technology

</div>
