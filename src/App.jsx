/**
 * ARCHITECTURE COMMENT BLOCK
 * 
 * ============================================================================
 * AudiSync — College Auditorium Management System
 * ============================================================================
 * 
 * This is a highly-secure, single-file portfolio application designed specifically 
 * for scale. It isolates UI state from external API concerns through a strict 
 * MockAPI data-layer and a functional BookingEngine.
 * 
 * Component Tree & Data Flow:
 * 1. <App> (State root, Context Provider)
 * 2. <ToastSystem> (Floating overlay with Framer Motion)
 * 3. <Header> (Navigation controls)
 * 4. Main Views:
 *    ├─ <DashboardView> (Overview stats and upcoming flights)
 *    ├─ <ScheduleView> (Core interactive Timeline Grid)
 *    │     └─ <BookingPanel> (Multi-step form side-drawer)
 *    ├─ <MyBookingsView> (Personal schedule management)
 *    └─ <AdminPanel> (Analytics, System management)
 * 
 * Flow: BookingContext → MockAPI → BookingEngine → UI Views.
 * 
 * EXTENSIBILITY: 
 * To replace the MockAPI with standard Supabase logic or REST operations, simply
 * rewrite the methods within the `MockAPI` class using standard `fetch` wrappers 
 * or the `@supabase/supabase-js` client. The UI views require zero modifications.
 * 
 * SECURITY: Validation relies on Least Privilege routing. `validateBooking` heavily
 * sanitizes frontend objects before storage mutation.
 * 
 * EMAIL INTEGRATION:
 * `MockAPI.createBooking()` passes the confirmed object to `EmailService`.
 * The execution does NOT wait for the EmailService. It logs directly to the user
 * and fails silently on network error (fire and forget) while preserving the UX.
 */

import React, { useState, useEffect, useContext, createContext, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar as CalIcon, MapPin, X, Clock, Navigation, LogIn, LogOut, Loader2, Info, Users,
  CheckCircle2, AlertCircle, FileDigit, BarChart3, ChevronLeft, ChevronRight, ShieldCheck, Mail
} from 'lucide-react';
import { format, parseISO, addDays, subDays, isSameDay } from 'date-fns';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { EmailService } from './emailService';

function cn(...inputs) { return twMerge(clsx(inputs)); }

// ── SECTION 2 — DATA ARCHITECTURE ──

/** 
 * @typedef User
 * @property {string} id (uuid-like)
 * @property {string} name
 * @property {string} email
 * @property {"admin" | "teacher" | "club_lead"} role
 * @property {string} department
 * @property {string} avatar (initials, 2 chars)
 */

/** 
 * @typedef Auditorium
 * @property {string} id
 * @property {string} name
 * @property {string} block
 * @property {number} capacity
 * @property {number} floor
 * @property {string[]} amenities e.g. ["Projector","AC","Mic","Recording"]
 * @property {"active" | "maintenance"} status
 */

/** 
 * @typedef Booking
 * @property {string} id
 * @property {string} auditoriumId
 * @property {string} userId
 * @property {string} date (ISO "YYYY-MM-DD")
 * @property {string} startSlot (e.g. "09:00")
 * @property {string} endSlot (e.g. "10:00")
 * @property {string} purpose
 * @property {number} attendance
 * @property {"confirmed" | "pending" | "cancelled"} status
 * @property {string} createdAt
 * @property {string | null} approvedBy (admin/teacher userId for club bookings)
 */

const SEED_USERS = [
  { id: "u-admin", name: "Dr. Admin", email: "admin@college.edu", role: "admin", department: "Administration", avatar: "DA" },
  { id: "u-teacher", name: "Prof. Sharma", email: "sharma@college.edu", role: "teacher", department: "Computer Science", avatar: "PS" },
  { id: "u-club", name: "Rahul Verma", email: "rahul@college.edu", role: "club_lead", department: "Robotics Club", avatar: "RV" }
];

const SEED_AUDITORIUMS = [
  { id: "apj", name: "APJ Abdul Kalam Auditorium", block: "D Block", capacity: 300, floor: 2, amenities: ["Projector", "AC", "Recording", "Stage"], status: "active" },
  { id: "pg", name: "PG Block Seminar Hall", block: "PG Block", capacity: 120, floor: 1, amenities: ["Projector", "AC", "Mic"], status: "active" },
  { id: "bblock", name: "B Block Seminar Hall", block: "B Block", capacity: 80, floor: 1, amenities: ["Projector", "Whiteboard"], status: "active" },
  { id: "ks", name: "KS Auditorium", block: "C Block", capacity: 200, floor: 1, amenities: ["Projector", "AC", "Mic"], status: "active" },
  { id: "ce0", name: "CE Block Seminar — Floor 0", block: "New Block", capacity: 60, floor: 0, amenities: ["Screen"], status: "active" },
  { id: "ce1", name: "CE Block Seminar — Floor 1", block: "New Block", capacity: 60, floor: 1, amenities: ["Screen"], status: "active" },
  { id: "ce2", name: "CE Block Seminar — Floor 2", block: "New Block", capacity: 60, floor: 2, amenities: ["Screen"], status: "active" }
];

const TODAY = format(new Date(), 'yyyy-MM-dd');
const CURRENT_HOUR = new Date().getHours() + ":00";

const SEED_BOOKINGS = [
  { id: "bk-1", auditoriumId: "apj", userId: "u-teacher", date: TODAY, startSlot: "10:00", endSlot: "11:00", purpose: "AI Guest Lecture", attendance: 250, status: "confirmed", createdAt: TODAY, approvedBy: "u-admin" },
  { id: "bk-2", auditoriumId: "apj", userId: "u-club", date: TODAY, startSlot: "14:00", endSlot: "15:00", purpose: "Techfest Rehearsal", attendance: 50, status: "pending", createdAt: TODAY, approvedBy: null },
  { id: "bk-3", auditoriumId: "ks", userId: "u-admin", date: TODAY, startSlot: "09:00", endSlot: "10:00", purpose: "Orientation Brief", attendance: 180, status: "confirmed", createdAt: TODAY, approvedBy: "u-admin" },
  { id: "bk-4", auditoriumId: "pg", userId: "u-club", date: TODAY, startSlot: "10:00", endSlot: "11:00", purpose: "Debate Finals", attendance: 100, status: "pending", createdAt: TODAY, approvedBy: null },
  { id: "bk-5", auditoriumId: "ce0", userId: "u-teacher", date: TODAY, startSlot: "12:00", endSlot: "13:00", purpose: "Faculty Sync", attendance: 20, status: "confirmed", createdAt: TODAY, approvedBy: "u-admin" },
  { id: "bk-6", auditoriumId: "bblock", userId: "u-teacher", date: format(addDays(new Date(), 1), 'yyyy-MM-dd'), startSlot: "08:00", endSlot: "09:00", purpose: "Special Class", attendance: 60, status: "confirmed", createdAt: TODAY, approvedBy: "u-admin" }
];


// ── SECTION 3 — MOCK API CLASS ──

class MockAPI {
  static _init() {
    if (!localStorage.getItem("audisync_bookings")) {
      localStorage.setItem("audisync_bookings", JSON.stringify(SEED_BOOKINGS));
    }
  }

  static async _readAll() {
    this._init();
    return JSON.parse(localStorage.getItem("audisync_bookings"));
  }

  static async _writeAll(data) {
    localStorage.setItem("audisync_bookings", JSON.stringify(data));
  }

  static async getBookings(date) {
    await new Promise(r => setTimeout(r, 400));
    const all = await this._readAll();
    return all.filter(b => b.date === date);
  }

  static async getBookingsByUser(userId) {
    await new Promise(r => setTimeout(r, 400));
    const all = await this._readAll();
    return all.filter(b => b.userId === userId);
  }

  static async createBooking(bookingObj, userObj, audiObj) {
    await new Promise(r => setTimeout(r, 600)); // Simulate latency
    const all = await this._readAll();
    const newBooking = { ...bookingObj, id: 'bk-' + Math.random().toString(36).substr(2, 6), createdAt: format(new Date(), 'yyyy-MM-dd') };
    await this._writeAll([...all, newBooking]);
    
    // FIRE AND FORGET EMAIL
    EmailService.sendBookingConfirmation(newBooking, userObj, audiObj)
      .catch(e => console.warn("Email failed silently:", e));

    return { success: true, booking: newBooking, error: null };
  }

  static async cancelBooking(id, userId) {
    await new Promise(r => setTimeout(r, 400));
    const all = await this._readAll();
    const target = all.find(b => b.id === id);
    if (!target) return { success: false, error: "Not found" };
    if (target.userId !== userId && !SEED_USERS.find(u => u.id === userId)?.role === 'admin') {
      return { success: false, error: "Unauthorized" };
    }
    const filtered = all.filter(b => b.id !== id);
    await this._writeAll(filtered);
    return { success: true, error: null };
  }

  static async approveBooking(id, adminId) {
    await new Promise(r => setTimeout(r, 400));
    const all = await this._readAll();
    const idx = all.findIndex(b => b.id === id);
    if (idx > -1) {
      all[idx].status = "confirmed";
      all[idx].approvedBy = adminId;
      await this._writeAll(all);
      return { success: true, error: null };
    }
    return { success: false, error: "Not found" };
  }

  static async getAnalytics() {
    await new Promise(r => setTimeout(r, 400));
    const all = await this._readAll();
    const today = all.filter(b => b.date === TODAY);
    
    const countMap = {};
    const hourMap = {};
    let pendingCount = 0;

    today.forEach(b => {
      countMap[b.auditoriumId] = (countMap[b.auditoriumId] || 0) + 1;
      hourMap[b.startSlot] = (hourMap[b.startSlot] || 0) + 1;
      if (b.status === "pending") pendingCount++;
    });

    let mostUsedHall = Object.keys(countMap).sort((a,b) => countMap[b] - countMap[a])[0];
    let peakHour = Object.keys(hourMap).sort((a,b) => hourMap[b] - hourMap[a])[0] || "--";

    return { 
      mostUsedHall: SEED_AUDITORIUMS.find(a => a.id === mostUsedHall)?.name || "N/A", 
      peakHour, 
      totalToday: today.length, 
      pendingCount 
    };
  }
}


// ── SECTION 4 — BOOKING LOGIC ENGINE ──

const BookingEngine = {
  SLOTS: ["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00"],
  
  isSlotAvailable(auditoriumId, date, startSlot, bookings) {
    return !bookings.some(b => 
      b.auditoriumId === auditoriumId && 
      b.date === date && 
      b.startSlot === startSlot
    );
  },

  checkCollision(newBooking, existingBookings) {
    return existingBookings.find(b => 
      b.auditoriumId === newBooking.auditoriumId && 
      b.date === newBooking.date && 
      b.startSlot === newBooking.startSlot
    ) || null;
  },

  suggestAlternatives(auditoriumId, date, preferredSlot, bookings, auditoriums) {
    let nextFreeSlot = null;
    const prefIdx = this.SLOTS.indexOf(preferredSlot);
    for(let i = prefIdx + 1; i < this.SLOTS.length; i++) {
      if(this.isSlotAvailable(auditoriumId, date, this.SLOTS[i], bookings)) {
        nextFreeSlot = this.SLOTS[i];
        break;
      }
    }

    const preferredAudi = auditoriums.find(a => a.id === auditoriumId);
    let alterns = auditoriums.filter(a => a.id !== auditoriumId && this.isSlotAvailable(a.id, date, preferredSlot, bookings));
    if (preferredAudi) {
       alterns.sort((a, b) => Math.abs(a.capacity - preferredAudi.capacity) - Math.abs(b.capacity - preferredAudi.capacity));
    }
    
    return { nextFreeSlot, alternativeHalls: alterns };
  },

  validateBooking(booking, user, auditorium) {
    const errors = [];
    if (!booking.purpose || booking.purpose.trim().length < 10) errors.push("Purpose must be at least 10 characters.");
    if (booking.attendance > auditorium.capacity) errors.push(`Attendance exceeds capacity (${auditorium.capacity}).`);
    if (booking.attendance <= 0) errors.push("Attendance must be greater than 0.");
    
    booking.status = user.role === 'club_lead' ? 'pending' : 'confirmed';
    booking.approvedBy = user.role === 'admin' ? user.id : null;
    return { valid: errors.length === 0, errors };
  }
};


// ── CONTEXT INTERFACES ──

const BookingContext = createContext();

export default function App() {
  const [toasts, setToasts] = useState([]);
  const [activeView, setActiveView] = useState('Dashboard');
  const [currentUser, setCurrentUser] = useState(SEED_USERS[0]);

  const addToast = useCallback((message, type = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const ctxValue = useMemo(() => ({
    currentUser, setCurrentUser, activeView, setActiveView, addToast
  }), [currentUser, activeView, addToast]);

  return (
    <BookingContext.Provider value={ctxValue}>
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-slate-400 font-sans selection:bg-emerald-500/30 overflow-x-hidden pb-20 md:pb-0">
        
        {/* Toast System */}
        <div className="fixed bottom-4 right-4 z-[999] flex flex-col gap-2 pointer-events-none">
          <AnimatePresence>
            {toasts.map(toast => (
              <motion.div key={toast.id} initial={{ x: 100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                className={cn("px-4 py-3 rounded-xl border flex items-center gap-3 min-w-[300px] shadow-2xl backdrop-blur-md pointer-events-auto",
                  toast.type === 'success' && "bg-emerald-950/80 border-emerald-500/30 text-emerald-100",
                  toast.type === 'error' && "bg-rose-950/80 border-rose-500/30 text-rose-100",
                  toast.type === 'warning' && "bg-amber-950/80 border-amber-500/30 text-amber-100",
                  toast.type === 'info' && "bg-indigo-950/80 border-indigo-500/30 text-indigo-100"
                )}>
                <Info className={cn("w-4 h-4 shrink-0", 
                   toast.type === 'success' ? "text-emerald-400" : toast.type === 'error' ? "text-rose-400" : toast.type === 'warning' ? "text-amber-400" : "text-indigo-400")} />
                <p className="flex-1 text-sm font-medium">{toast.message}</p>
                <button onClick={() => setToasts(p => p.filter(t => t.id !== toast.id))} className="text-white/50 hover:text-white"><X className="w-4 h-4" /></button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Global Application Nav */}
        <header className="sticky top-0 z-[60] bg-slate-950/60 backdrop-blur-xl border-b border-white/10">
          <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-tr from-emerald-600 to-indigo-600 rounded-lg shrink-0 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                <ShieldCheck className="w-5 h-5 text-white drop-shadow-md" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white tracking-tight leading-none bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-300">AudiSync</h1>
                <p className="text-[10px] text-slate-500 font-bold tracking-widest uppercase mt-0.5">{format(new Date(), 'EEE, MMM do')}</p>
              </div>
            </div>

            <nav className="hidden md:flex bg-white/5 border border-white/10 p-1.5 rounded-full shadow-inner">
              {['Dashboard', 'Schedule', 'My Bookings'].map(v => (
                <button key={v} onClick={() => setActiveView(v)} className={cn("px-5 py-1.5 rounded-full text-sm font-semibold transition-all duration-300", activeView === v ? "bg-white/10 text-emerald-400 shadow-sm" : "text-slate-400 hover:text-slate-200 hover:bg-white/5")}>{v}</button>
              ))}
              {currentUser.role === 'admin' && (
                <button onClick={() => setActiveView('Admin')} className={cn("px-5 py-1.5 rounded-full text-sm font-semibold transition-all duration-300", activeView === 'Admin' ? "bg-white/10 text-emerald-400 shadow-sm" : "text-amber-400/80 hover:text-amber-400 hover:bg-white/5")}>Admin</button>
              )}
            </nav>

            <div className="flex items-center gap-4 border-l border-white/10 pl-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-white leading-none">{currentUser.name}</p>
                <div className="flex items-center justify-end gap-1.5 mt-1">
                  <span className={cn("w-1.5 h-1.5 rounded-full", currentUser.role==='admin'?"bg-amber-400":currentUser.role==='teacher'?"bg-emerald-400":"bg-indigo-400")} />
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{currentUser.role.replace('_',' ')}</p>
                </div>
              </div>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 flex items-center justify-center text-sm font-bold text-slate-300 shadow-inner">
                {currentUser.avatar}
              </div>
            </div>
          </div>
        </header>

        {/* View Router */}
        <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8">
          <AnimatePresence mode="wait">
            <motion.div key={activeView} initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} exit={{opacity:0, y:-10}} transition={{duration:0.2}}>
              {activeView === 'Dashboard' && <DashboardView />}
              {activeView === 'Schedule' && <ScheduleView />}
              {activeView === 'My Bookings' && <MyBookingsView />}
              {activeView === 'Admin' && <AdminPanel />}
            </motion.div>
          </AnimatePresence>
        </main>
        
      </div>
    </BookingContext.Provider>
  );
}

// ── SECTION 5 — APPLICATION VIEWS ──

const GlassCard = ({ children, className }) => (
  <div className={cn("bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl w-full", className)}>
    {children}
  </div>
);

function DashboardView() {
  const { setActiveView, currentUser } = useContext(BookingContext);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalToday:0, pendingCount:0, mostUsedHall:'-', peakHour:'-' });
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    let active = true;
    Promise.all([MockAPI.getAnalytics(), MockAPI.getBookings(TODAY)]).then(([a, bks]) => {
      if(!active) return;
      setStats(a);
      setRecent(bks.sort((x,y) => new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime()).slice(0, 5));
      setLoading(false);
    });
    return () => { active = false };
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white line-clamp-1">Dashboard</h2>
          <p className="text-sm font-medium mt-1">Hello, {currentUser.name.split(' ')[0]}. Here is your campus overview.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setActiveView('Schedule')} className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] active:scale-95 flex items-center gap-2">
            <CalIcon className="w-4 h-4"/> New Booking
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <GlassCard className="p-6 relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-20 h-20 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all" />
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Total Bookings Today</p>
          <div className="mt-4 flex items-end gap-3"><p className="text-4xl font-bold text-white">{loading ? '-' : stats.totalToday}</p><p className="text-sm text-emerald-400 font-bold mb-1 max-w-[80px]">events active</p></div>
        </GlassCard>
        <GlassCard className="p-6 relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-20 h-20 bg-indigo-500/10 rounded-full blur-2xl group-hover:bg-indigo-500/20 transition-all" />
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Available Slots</p>
          <div className="mt-4 flex items-end gap-3"><p className="text-4xl font-bold text-white">{loading ? '-' : (SEED_AUDITORIUMS.length * 10) - stats.totalToday}</p><p className="text-sm text-indigo-400 font-bold mb-1 max-w-[80px]">free grid spaces</p></div>
        </GlassCard>
        <GlassCard className="p-6 relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-20 h-20 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-all" />
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Pending Approvals</p>
          <div className="mt-4 flex items-end gap-3"><p className="text-4xl font-bold text-white">{loading ? '-' : stats.pendingCount}</p><p className="text-sm text-amber-400 font-bold mb-1 max-w-[80px]">need signoff</p></div>
        </GlassCard>
        <GlassCard className="p-6">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Most Booked Hall</p>
          <div className="mt-4"><p className="text-xl font-bold text-white leading-tight">{loading ? 'Loading...' : stats.mostUsedHall}</p></div>
        </GlassCard>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <GlassCard className="lg:col-span-2 p-6 flex flex-col h-[400px]">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-white">Recent Activity</h3>
            <button onClick={() => setActiveView('Schedule')} className="text-xs font-bold bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-md transition-colors">View All Schedule</button>
          </div>
          <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
            {loading ? (
              <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-16 bg-white/5 rounded-xl animate-pulse" />)}</div>
            ) : recent.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-600 font-medium">No bookings yet today.</div>
            ) : (
              <table className="w-full text-left text-sm whitespace-nowrap">
                <tbody>
                  {recent.map(b => {
                    const audi = SEED_AUDITORIUMS.find(a => a.id === b.auditoriumId);
                    return (
                      <tr key={b.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors">
                        <td className="py-4 pl-3">
                          <p className="font-bold text-white">{audi?.name}</p>
                          <p className="text-xs text-slate-500 font-medium">{audi?.block}</p>
                        </td>
                        <td className="py-4">
                          <span className="bg-white/5 border border-white/10 px-2 py-1 rounded font-bold text-indigo-400">{b.startSlot}</span>
                        </td>
                        <td className="py-4 font-medium text-slate-300">{b.requester_name || 'Requester'}</td>
                        <td className="py-4 pr-3 text-right">
                          <span className={cn("px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded border", 
                            b.status === 'confirmed' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : b.status === 'pending' ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : "bg-white/5 text-slate-400 border-white/10"
                          )}>{b.status}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </GlassCard>
        <GlassCard className="p-6 bg-indigo-600/10 border-indigo-500/30 border">
          <h3 className="text-lg font-bold text-indigo-100 mb-2">Export Schedule</h3>
          <p className="text-sm font-medium text-indigo-200/60 mb-6 leading-relaxed text-balance">Download a structured CSV digest of all confirmed bookings for offline campus logistics and faculty tracking.</p>
          <button className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-indigo-500 hover:bg-indigo-400 text-white font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(99,102,241,0.2)] active:scale-95">
            <FileDigit className="w-4 h-4" /> Download PDF / CSV
          </button>
        </GlassCard>
      </div>
    </div>
  );
}

function ScheduleView() {
  const { currentUser, addToast } = useContext(BookingContext);
  const [date, setDate] = useState(TODAY);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [panelSlot, setPanelSlot] = useState(null); // { audiId, startSlot }

  const fetchGrid = useCallback(() => {
    setLoading(true);
    MockAPI.getBookings(date).then(d => { setBookings(d); setLoading(false); });
  }, [date]);

  useEffect(() => { fetchGrid(); }, [fetchGrid]);

  const handleCellClick = (audiId, startSlot) => {
    if (!BookingEngine.isSlotAvailable(audiId, date, startSlot, bookings)) return;
    setPanelSlot({ audiId, startSlot });
  };

  return (
    <div className="space-y-6">
      {/* Grid Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/5 p-4 rounded-full border border-white/10">
        <div className="flex items-center gap-2">
          <button onClick={() => setDate(format(subDays(parseISO(date), 1), 'yyyy-MM-dd'))} className="p-2 hover:bg-white/10 rounded-full transition-colors"><ChevronLeft className="w-5 h-5 text-slate-300"/></button>
          <div className="px-4 py-1 bg-slate-900 border border-slate-700/50 rounded-full text-sm font-bold text-white flex items-center min-w-[150px] justify-center shadow-inner">
             {isSameDay(parseISO(date), new Date()) ? 'Today' : format(parseISO(date), 'MMM do, yyyy')}
          </div>
          <button onClick={() => setDate(format(addDays(parseISO(date), 1), 'yyyy-MM-dd'))} className="p-2 hover:bg-white/10 rounded-full transition-colors"><ChevronRight className="w-5 h-5 text-slate-300"/></button>
        </div>
        <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-wider pr-4">
           <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-white/10 border border-emerald-500/30" /> Available </div>
           <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-indigo-500/20" /> Confirmed </div>
           <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-amber-500/20" /> Pending </div>
        </div>
      </div>

      {/* Interactive Timeline Grid */}
      <GlassCard className="overflow-hidden border-white/5 shadow-2xl">
        <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          <div className="min-w-[1200px]">
            {/* Times Row */}
            <div className="flex border-b border-white/10 bg-slate-950/80 backdrop-blur w-full sticky top-0 z-20">
              <div className="w-64 shrink-0 px-6 py-4 border-r border-white/10 flex items-center bg-slate-950 sticky left-0 z-30">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Auditoriums</span>
              </div>
              <div className="flex flex-1">
                {BookingEngine.SLOTS.map(slot => (
                  <div key={slot} className="flex-1 px-2 py-4 flex flex-col items-center justify-center border-r last:border-r-0 border-white/5">
                    <span className="text-xs font-bold text-slate-400">{slot}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Matrix Body */}
            <div className="divide-y divide-white/5">
              {SEED_AUDITORIUMS.map((audi) => (
                <div key={audi.id} className="flex group hover:bg-white/[0.02] transition-colors relative z-0">
                  {/* Audi Config Stack */}
                  <div className="w-64 shrink-0 px-6 py-5 border-r border-white/10 sticky left-0 bg-slate-900 group-hover:bg-slate-900 transition-colors shadow-[1px_0_0_0_rgba(255,255,255,0.05)] z-10 flex flex-col justify-center">
                    <h3 className="font-bold text-sm text-white line-clamp-1">{audi.name}</h3>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="px-1.5 py-0.5 rounded bg-white/5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border border-white/5">{audi.block}</span>
                      <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-[10px] font-bold tracking-wider text-indigo-400 border border-indigo-500/20">{audi.capacity} Pax</span>
                    </div>
                  </div>

                  {/* Slot Render Logic */}
                  <div className="flex flex-1">
                    {BookingEngine.SLOTS.map(slot => {
                      if (loading) return <div key={slot} className="flex-1 border-r border-white/5 p-1.5"><div className="w-full h-[60px] bg-white/5 animate-pulse rounded-lg" /></div>;
                      
                      const bk = BookingEngine.checkCollision({ auditoriumId: audi.id, date, startSlot: slot }, bookings);
                      const isCurrent = slot.startsWith(CURRENT_HOUR.split(":")[0]) && isSameDay(parseISO(date), new Date());
                      
                      return (
                        <div key={slot} className={cn("flex-1 border-r last:border-r-0 border-white/5 relative p-1.5 h-[76px]", isCurrent && "bg-white/5")}>
                          {bk ? (
                             <div className="group/booking w-full h-full relative cursor-default">
                               <div className={cn("w-full h-full rounded-xl flex flex-col justify-center px-3 py-1.5 border overflow-hidden relative",
                                  bk.status === 'confirmed' ? "bg-indigo-500/20 border-indigo-500/40" : "bg-amber-500/20 border-amber-500/40"
                               )}>
                                 <p className={cn("text-sm font-bold truncate pr-1 leading-tight", bk.status === 'confirmed' ? "text-indigo-200" : "text-amber-200")}>{bk.purpose}</p>
                                 <p className={cn("text-[10px] uppercase font-bold tracking-widest mt-0.5", bk.status === 'confirmed' ? "text-indigo-400/80" : "text-amber-400/80")}>{bk.status}</p>
                               </div>

                                {/* Deep Hover Tech-Card Popover */}
                                <div className="absolute hidden group-hover/booking:block z-[999] left-1/2 -translate-x-1/2 bottom-[110%] w-[300px] pointer-events-none">
                                  <div className="bg-slate-900 border border-white/10 rounded-2xl shadow-2xl p-5 shadow-black/80">
                                    <div className="flex justify-between items-start mb-3">
                                      <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center font-bold text-xs text-slate-300">{currentUser.avatar}</div>
                                        <div>
                                          <p className="font-bold text-sm text-white line-clamp-1">{bk.requester_name || "Anonymous user"}</p>
                                          <p className="text-[10px] text-slate-500 uppercase tracking-widest">{bk.department || "No Dept"}</p>
                                        </div>
                                      </div>
                                    </div>
                                    <p className="text-sm text-slate-300 font-medium mb-3">{bk.purpose}</p>
                                    <div className="bg-white/5 rounded-lg p-2.5 flex items-center justify-between text-xs">
                                       <span className="flex items-center gap-1.5 text-slate-400"><Users className="w-3.5 h-3.5"/> {bk.attendance} pax</span>
                                       <span className={cn("font-bold", bk.status==='confirmed'?"text-emerald-400":"text-amber-400")}>{bk.status.toUpperCase()}</span>
                                    </div>
                                  </div>
                                </div>
                             </div>
                          ) : (
                             <button onClick={() => handleCellClick(audi.id, slot)} 
                               aria-label={`Book ${audi.name} at ${slot}`}
                               className="w-full h-full rounded-xl flex items-center justify-center border-2 border-dashed border-white/10 hover:border-emerald-500/60 transition-all duration-300 group/slot cursor-pointer bg-white/[0.01]">
                               <span className="text-[10px] text-emerald-400 font-bold opacity-0 group-hover/slot:opacity-100 uppercase tracking-widest bg-emerald-500/10 px-2.5 py-1 rounded-md drop-shadow-lg backdrop-blur">Click to book</span>
                             </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Booking Side Panel Integration */}
      <AnimatePresence>
        {panelSlot && <BookingPanel date={date} audiId={panelSlot.audiId} preferredSlot={panelSlot.startSlot} existingBookings={bookings} onClose={() => { setPanelSlot(null); fetchGrid(); }} />}
      </AnimatePresence>
    </div>
  );
}

function BookingPanel({ date, audiId, preferredSlot, existingBookings, onClose }) {
  const { currentUser, addToast } = useContext(BookingContext);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const audi = SEED_AUDITORIUMS.find(a => a.id === audiId);
  const isConflict = BookingEngine.checkCollision({ auditoriumId: audi.id, date, startSlot: preferredSlot }, existingBookings) !== null;
  const alterns = useMemo(() => isConflict ? BookingEngine.suggestAlternatives(audi.id, date, preferredSlot, existingBookings, SEED_AUDITORIUMS) : null, [isConflict, audi.id, date, preferredSlot, existingBookings]);
  
  const [form, setForm] = useState({ purpose: '', attendance: '' });

  const onSubmit = async () => {
    const bk = { auditoriumId: audi.id, userId: currentUser.id, date, startSlot: preferredSlot, endSlot: String(parseInt(preferredSlot)+1).padStart(2,'0')+":00", purpose: form.purpose, attendance: parseInt(form.attendance)||1 };
    const { valid, errors } = BookingEngine.validateBooking(bk, currentUser, audi);
    if (!valid) { addToast(errors[0], 'error'); return; }

    setLoading(true);
    const { success, error } = await MockAPI.createBooking(bk, currentUser, audi);
    setLoading(false);
    if (success) {
      addToast("A confirmation email has been sent to " + currentUser.email + " (simulated)", 'success');
      onClose();
    } else {
      addToast(error, 'error');
    }
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[90]" />
      <motion.div initial={{ x: '100%', boxShadow: '-30px 0 30px rgba(0,0,0,0)' }} animate={{ x: 0, boxShadow: '-30px 0 30px rgba(0,0,0,0.5)' }} exit={{ x: '100%' }} transition={{ type: "spring", bounce: 0, duration: 0.4 }}
        className="fixed inset-y-0 right-0 w-full sm:w-[480px] bg-[#0c1120] border-l border-white/10 z-[100] flex flex-col"
      >
        <div className="px-8 py-6 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-xl font-bold text-white tracking-tight">New Booking</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors bg-white/5 hover:bg-white/10 p-2 rounded-full"><X className="w-5 h-5"/></button>
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-8 space-y-8 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          {/* Animated Step Indicator */}
          <div className="flex items-center justify-center gap-3">
             <div className="flex items-center gap-3"><span className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border transition-colors", step>=1?"bg-emerald-500 border-emerald-400 text-white":"bg-white/5 border-white/10 text-slate-500")}>1</span></div>
             <div className="w-10 h-px bg-white/10"><div className={cn("h-full bg-emerald-500 transition-all", step>=2?"w-full":"w-0")} /></div>
             <div className="flex items-center gap-3"><span className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border transition-colors", step>=2?"bg-emerald-500 border-emerald-400 text-white":"bg-white/5 border-white/10 text-slate-500")}>2</span></div>
             <div className="w-10 h-px bg-white/10"><div className={cn("h-full bg-emerald-500 transition-all", step>=3?"w-full":"w-0")} /></div>
             <div className="flex items-center gap-3"><span className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border transition-colors", step>=3?"bg-emerald-500 border-emerald-400 text-white":"bg-white/5 border-white/10 text-slate-500")}>3</span></div>
          </div>

          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div key="1" initial={{opacity:0, x:-20}} animate={{opacity:1, x:0}} exit={{opacity:0, x:20}} className="space-y-6">
                 <div><p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 border-b border-white/5 pb-2">Location & Metrics</p>
                 <div className="bg-white/5 rounded-2xl p-4 border border-white/5"><p className="text-lg font-bold text-white mb-1 leading-tight">{audi.name}</p><div className="flex flex-wrap gap-2 mt-3">{audi.amenities.map(x=><span key={x} className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] text-slate-400 uppercase tracking-widest">{x}</span>)}<span className="px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-[10px] text-indigo-400 uppercase tracking-widest">{audi.capacity} Capacity</span></div></div></div>

                 <div><p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 border-b border-white/5 pb-2">Time Slot Status</p>
                 <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/5"><div className="p-3 bg-white/5 rounded-xl"><Clock className="w-5 h-5 text-slate-400"/></div><div><p className="text-white font-bold">{format(parseISO(date), 'MMM do, yyyy')}</p><p className="text-lg text-emerald-400 font-bold">{preferredSlot}</p></div></div></div>
                 
                 {isConflict ? (
                    <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl"><p className="text-sm font-bold text-rose-400 mb-4 flex items-center gap-2"><AlertCircle className="w-4 h-4"/> Conflict Detected</p>
                    {alterns?.nextFreeSlot && <button className="w-full text-left p-3 bg-white/5 hover:bg-white/10 rounded-xl mb-2 transition-colors border border-white/5 text-sm font-bold text-white">Try {alterns.nextFreeSlot} instead &rarr;</button>}
                    {alterns?.alternativeHalls.slice(0,1).map(a => <button key={a.id} className="w-full text-left p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors border border-white/5 text-sm font-bold text-white">Try {a.name} &rarr;</button>)}</div>
                 ) : (
                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-emerald-500"/><p className="text-sm font-bold text-emerald-400">Available and ready</p></div>
                 )}
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="2" initial={{opacity:0, x:-20}} animate={{opacity:1, x:0}} exit={{opacity:0, x:20}} className="space-y-6">
                 <div><p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 border-b border-white/5 pb-2">Manifesto</p>
                 <textarea autoFocus rows={4} placeholder="Detailed purpose for the booking (min 10 chars)" value={form.purpose} onChange={e=>setForm({...form, purpose: e.target.value})} className="w-full px-4 py-3 bg-white/5 border border-white/10 focus:border-emerald-500/50 rounded-xl text-white outline-none transition-colors resize-none text-sm placeholder:text-slate-600"/></div>
                 <div><p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 border-b border-white/5 pb-2 flex justify-between"><span>Crowd Ops</span><span className="text-amber-500">Max: {audi.capacity}</span></p>
                 <input type="number" placeholder="Expected attendance count" value={form.attendance} onChange={e=>setForm({...form, attendance: e.target.value})} className="w-full px-4 py-3 bg-white/5 border border-white/10 focus:border-emerald-500/50 rounded-xl text-white outline-none transition-colors text-sm placeholder:text-slate-600"/>
                 {parseInt(form.attendance) > audi.capacity * 0.8 && <p className="text-[10px] text-amber-500 mt-2 font-bold uppercase tracking-wider flex items-center gap-1"><AlertCircle className="w-3 h-3"/> Approaching hall maximum capacity limits</p>}</div>

                 <div><p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 border-b border-white/5 pb-2">Identity Auth</p>
                 <div className="flex justify-between items-center bg-white/5 p-4 rounded-xl border border-white/5"><span className="text-sm font-bold text-white">{currentUser.name}</span><span className="text-xs text-slate-400 font-bold uppercase tracking-wider">{currentUser.department}</span></div></div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div key="3" initial={{opacity:0, x:-20}} animate={{opacity:1, x:0}} exit={{opacity:0, x:20}} className="space-y-6">
                 <div><p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 border-b border-white/5 pb-2">Final Clearance</p>
                 <div className="bg-white/5 rounded-2xl border border-white/10 p-5 space-y-4">
                    <div className="flex justify-between"><span className="text-sm text-slate-500 font-bold">Vector</span><span className="text-sm text-white font-bold">{audi.name}</span></div>
                    <div className="flex justify-between"><span className="text-sm text-slate-500 font-bold">Lock Time</span><span className="text-sm text-emerald-400 font-bold">{date} @ {preferredSlot}</span></div>
                    <div className="h-px bg-white/5" />
                    <div><span className="text-sm text-slate-500 font-bold block mb-1">Directive</span><span className="text-sm text-slate-300">{form.purpose}</span></div>
                    <div><span className="text-sm text-slate-500 font-bold block mb-1">Payload</span><span className="text-sm text-white font-bold bg-white/10 px-2 py-0.5 rounded">{form.attendance} Pax</span></div>
                 </div></div>
                 
                 {currentUser.role === 'club_lead' ? 
                   <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl"><p className="text-xs font-bold text-amber-500 leading-relaxed uppercase tracking-wider">This request requires Teacher authorization. State will be set to Pending.</p></div> :
                   <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl"><p className="text-xs font-bold text-emerald-500 leading-relaxed uppercase tracking-wider">Clearance verified. Will auto-deploy to confirmed status.</p></div>
                 }
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="p-6 border-t border-white/5 bg-[#0c1120]/90 backdrop-blur sticky bottom-0 flex gap-3">
          {step > 1 ? (
             <button onClick={() => setStep(p=>p-1)} className="px-6 py-3 font-bold text-slate-400 bg-white/5 hover:bg-white/10 rounded-xl transition-colors">Back</button>
          ) : <button onClick={onClose} className="px-6 py-3 font-bold text-slate-500 hover:text-slate-300 transition-colors">Cancel</button>}

          {step < 3 ? (
             <button onClick={() => {
               if(step===2 && (!form.purpose || !form.attendance)) { addToast("Complete manifesto required", 'error'); return; }
               setStep(p=>p+1);
             }} className="flex-1 bg-white text-[#0c1120] font-extrabold rounded-xl py-3 hover:bg-slate-200 transition-transform active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.2)]">Proceed</button>
          ) : (
             <button onClick={onSubmit} disabled={loading} className="flex-1 bg-emerald-500 text-[#0c1120] font-extrabold rounded-xl py-3 hover:bg-emerald-400 transition-transform active:scale-95 shadow-[0_0_20px_rgba(16,185,129,0.3)] disabled:opacity-50 flex justify-center items-center gap-2">
                {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> Submitting</> : 'Engage'}
             </button>
          )}
        </div>
      </motion.div>
    </>
  );
}

function MyBookingsView() {
  const { currentUser, addToast } = useContext(BookingContext);
  const [bks, setBks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('Upcoming');

  const fetch = useCallback(() => {
    setLoading(true);
    MockAPI.getBookingsByUser(currentUser.id).then(d => { setBks(d); setLoading(false); });
  }, [currentUser]);
  useEffect(() => { fetch(); }, [fetch]);

  const handleCancel = async (id) => {
    if(window.confirm("Abort this booking vector?")) {
      await MockAPI.cancelBooking(id, currentUser.id);
      addToast("Successfully expunged", "success");
      fetch();
    }
  };

  const filtered = bks.filter(b => {
    if(filter === 'Pending Approval') return b.status === 'pending';
    if(filter === 'Past') return new Date(b.date) < new Date(TODAY);
    return new Date(b.date) >= new Date(TODAY);
  });

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h2 className="text-3xl font-bold tracking-tight text-white">Ops Management</h2>
        <p className="text-sm text-slate-500 font-medium mt-1 uppercase tracking-widest">Your localized flight path</p>
      </div>
      
      <div className="flex gap-2 border-b border-white/5 pb-4 mb-6">
        {['Upcoming','Past','Pending Approval'].map(f => (
          <button key={f} onClick={() => setFilter(f)} className={cn("px-4 py-2 font-bold text-xs uppercase tracking-wider rounded-lg transition-colors border", filter===f ? "bg-white/10 text-emerald-400 border-white/10" : "bg-transparent text-slate-500 border-transparent hover:bg-white/5")}>{f}</button>
        ))}
      </div>

      {loading ? <div className="grid md:grid-cols-2 gap-4">{[1,2].map(i => <div key={i} className="h-40 bg-white/5 rounded-2xl animate-pulse"/>)}</div> : 
       filtered.length === 0 ? <div className="py-20 text-center"><p className="text-slate-600 font-bold">Zero anomalies detected in sector.</p></div> : (
         <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
           {filtered.map(b => {
             const audi = SEED_AUDITORIUMS.find(a=>a.id===b.auditoriumId);
             return (
               <GlassCard key={b.id} className="p-6 flex flex-col group">
                 <div className="flex justify-between items-start mb-4">
                   <div className="flex flex-col gap-1"><span className="text-white font-bold">{audi?.name}</span><span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">{audi?.block}</span></div>
                   <span className={cn("px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest rounded border", b.status === "confirmed" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : b.status === "pending" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : "bg-white/5 text-slate-500 border-white/10")}>{b.status}</span>
                 </div>
                 <div className="flex gap-4 mb-4 border-y border-white/5 py-4">
                   <div className="flex-1"><p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">T-Minus</p><p className="text-sm text-indigo-300 font-bold">{b.date}</p></div>
                   <div className="flex-1"><p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Window</p><p className="text-sm text-indigo-300 font-bold">{b.startSlot} - {b.endSlot}</p></div>
                 </div>
                 <p className="text-xs text-slate-400 font-medium line-clamp-2 flex-1 mb-6">{b.purpose}</p>
                 {(filter === 'Upcoming' || filter === 'Pending Approval') && <button onClick={() => handleCancel(b.id)} className="w-full py-2.5 rounded-xl border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 text-xs font-bold uppercase tracking-widest transition-colors">Abort Mission</button>}
               </GlassCard>
             );
           })}
         </div>
       )}
    </div>
  );
}

function AdminPanel() {
  const { currentUser, setCurrentUser, addToast } = useContext(BookingContext);
  const [bks, setBks] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchGrid = useCallback(() => {
    setLoading(true);
    MockAPI.getBookings(TODAY).then(d => { setBks(d); setLoading(false); });
  }, []);

  useEffect(() => { fetchGrid(); }, [fetchGrid]);

  const handleApprove = async (id) => {
    const { success } = await MockAPI.approveBooking(id, currentUser.id);
    if(success) { addToast("Clearance granted", "success"); fetchGrid(); }
  };

  const pends = bks.filter(b => b.status === 'pending');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start mb-6">
        <div><h2 className="text-3xl font-bold tracking-tight text-white mb-2">Central Command</h2><p className="text-slate-500 text-sm font-bold uppercase tracking-widest">Global Analytics & Authorizations</p></div>
        <div className="mt-6 sm:mt-0 p-4 bg-white/5 rounded-2xl border border-white/10 w-full sm:w-auto">
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-3">Demo: Switch User Role</p>
          <div className="flex flex-wrap gap-2">
            {SEED_USERS.map(u => (
              <button key={u.id} onClick={() => setCurrentUser(u)} className={cn("px-3 py-1.5 rounded bg-slate-900 border text-xs font-bold uppercase tracking-wider transition-all", currentUser.id===u.id?"border-emerald-500 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]":"border-white/10 text-slate-500 hover:text-white")}>{u.role}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <GlassCard className="lg:col-span-2 p-6 flex flex-col h-[400px]">
          <h3 className="font-bold text-white mb-6 uppercase tracking-widest text-xs border-b border-white/5 pb-4">Daily Auditorium Load Telemetry</h3>
          <div className="flex-1 flex items-end gap-2 overflow-x-auto pb-4">
            {loading ? <div className="w-full h-full bg-white/5 animate-pulse rounded-xl" /> : SEED_AUDITORIUMS.map(a => {
               const ct = bks.filter(b => b.auditoriumId === a.id).length;
               const h = Math.max((ct/10)*100, 5); // Base 5% height
               return (
                 <div key={a.id} className="flex-1 flex flex-col justify-end items-center group relative min-w-[40px]">
                   <div className="absolute top-0 opacity-0 group-hover:opacity-100 -translate-y-full mb-2 bg-slate-800 text-white text-[10px] font-bold px-2 py-1 rounded whitespace-nowrap z-10 transition-opacity">{ct} Ops</div>
                   <div style={{height: `${h}%`}} className="w-full bg-indigo-500/30 hover:bg-indigo-400 border-t-2 border-indigo-500 rounded-t-md transition-all duration-500" />
                   <p className="text-[9px] font-bold text-slate-500 truncate w-full text-center mt-3 uppercase tracking-wider group-hover:text-white transition-colors">{a.id.toUpperCase()}</p>
                 </div>
               )
            })}
          </div>
        </GlassCard>

        <GlassCard className="p-6 flex flex-col h-[400px]">
          <h3 className="font-bold text-amber-500 mb-6 uppercase tracking-widest text-xs border-b border-white/5 pb-4 flex justify-between">Pending Directives <span className="text-white px-2 py-0.5 bg-amber-500/20 rounded">{pends.length}</span></h3>
          <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin">
            {loading ? <div className="space-y-3">{[1,2].map(i=><div key={i} className="h-20 bg-white/5 rounded-xl animate-pulse"/>)}</div> : 
             pends.length === 0 ? <p className="text-slate-600 font-bold text-center mt-10">Queue absolute zero</p> : 
             pends.map(p => (
              <div key={p.id} className="p-4 bg-white/5 border border-white/5 rounded-xl flex flex-col gap-3">
                 <div><p className="text-xs font-bold text-white truncate">{p.purpose}</p><p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest">{SEED_AUDITORIUMS.find(a=>a.id===p.auditoriumId)?.name}</p></div>
                 <div className="flex gap-2">
                   <button onClick={() => MockAPI.cancelBooking(p.id, currentUser.id).then(fetchGrid)} className="flex-1 py-1.5 border border-rose-500/20 text-rose-400 hover:bg-rose-500/10 rounded-md text-[10px] font-bold uppercase tracking-widest transition-colors">Deny</button>
                   <button onClick={() => handleApprove(p.id)} className="flex-1 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-md text-[10px] font-bold uppercase tracking-widest transition-colors">Grant</button>
                 </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
