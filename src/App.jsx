/**
 * AudiSync — VNR Vignana Jyothi Institute of Engineering & Technology
 * College Auditorium Management System
 * v4.0 — Full Feature Set: Half-Slot Grid, MiniCalendar, Receipt, Roll No, Slot Distribution
 */

import React, {
  useState, useEffect, useContext, createContext,
  useMemo, useCallback, useRef,
} from 'react';

import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar as CalIcon, MapPin, X, Clock, Sun, Moon,
  ChevronLeft, ChevronRight, LogOut, Loader2, Users,
  CheckCircle2, AlertCircle, FileDigit, BarChart3,
  ShieldCheck, Mail, Receipt, Info, Check, Building2,
  GraduationCap, BookOpen, Sparkles,
} from 'lucide-react';
import {
  format, parseISO, addDays, subDays, isSameDay,
  startOfMonth, endOfMonth, eachDayOfInterval, getDay,
  addMonths, subMonths, isSameMonth,
} from 'date-fns';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { EmailService } from './emailService';

function cn(...inputs) { return twMerge(clsx(inputs)); }

// ── FORMAT HELPERS ──
export function format12Hr(slot24) {
  if (!slot24) return '';
  const [hour, min] = slot24.split(':');
  const h = parseInt(hour, 10);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${min} ${suffix}`;
}

// ── SECTION 2 — DATA ARCHITECTURE ──
const SEED_USERS = [
  { id: 'u-admin',   name: 'Dr. Vikram Nair',  rollNo: 'ADM001',  email: 'vikram.nair@vnrvjiet.in',  role: 'admin',     department: 'Administration',   avatar: 'VN' },
  { id: 'u-teacher', name: 'Prof. Anita Rao',   rollNo: 'FAC042',  email: 'anita.rao@vnrvjiet.in',    role: 'teacher',   department: 'Computer Science', avatar: 'AR' },
  { id: 'u-club',    name: 'Arjun Mehta',       rollNo: '21CS047', email: 'arjun.mehta@vnrvjiet.in',  role: 'club_lead', department: 'Tech Fusion Club', avatar: 'AM' },
];

const SEED_AUDITORIUMS = [
  { id: 'apj',    name: 'APJ Abdul Kalam Auditorium', block: 'D Block',  capacity: 300, floor: 2, amenities: ['Projector', 'AC', 'Recording', 'Stage'], status: 'active' },
  { id: 'pg',     name: 'PG Block Seminar Hall',      block: 'PG Block', capacity: 120, floor: 1, amenities: ['Projector', 'AC', 'Mic'],               status: 'active' },
  { id: 'bblock', name: 'B Block Seminar Hall',        block: 'B Block',  capacity: 80,  floor: 1, amenities: ['Projector', 'Whiteboard'],              status: 'active' },
  { id: 'ks',     name: 'KS Auditorium',               block: 'C Block',  capacity: 200, floor: 1, amenities: ['Projector', 'AC', 'Mic'],               status: 'active' },
  { id: 'e0',     name: 'E Block Seminar — Floor 0',   block: 'E Block',  capacity: 60,  floor: 0, amenities: ['Screen'],                              status: 'active' },
  { id: 'e1',     name: 'E Block Seminar — Floor 1',   block: 'E Block',  capacity: 60,  floor: 1, amenities: ['Screen'],                              status: 'active' },
  { id: 'e2',     name: 'E Block Seminar — Floor 2',   block: 'E Block',  capacity: 60,  floor: 2, amenities: ['Screen'],                              status: 'active' },
  { id: 'e3',     name: 'E Block Seminar — Floor 3',   block: 'E Block',  capacity: 60,  floor: 3, amenities: ['Screen'],                              status: 'active' },
  { id: 'e4',     name: 'E Block Seminar — Floor 4',   block: 'E Block',  capacity: 60,  floor: 4, amenities: ['Screen'],                              status: 'active' },
  { id: 'e5',     name: 'E Block Seminar — Floor 5',   block: 'E Block',  capacity: 60,  floor: 5, amenities: ['Screen'],                              status: 'active' },
];

const TODAY = format(new Date(), 'yyyy-MM-dd');
const MAX_FUTURE_DAYS = 30;

// ── TIME-AWARE SLOT EXPIRY ──
// Returns true if a half-slot is already elapsed on the given date
function isSlotExpired(dateStr, halfSlotId) {
  const now = new Date();
  const todayStr = format(now, 'yyyy-MM-dd');
  // Only expire slots on today's date
  if (dateStr !== todayStr) return false;
  const currentHour = now.getHours();
  const currentMin  = now.getMinutes();
  const hs = HALF_SLOTS.find(h => h.id === halfSlotId);
  if (!hs) return false;
  // Parse end time of the slot
  const [endH, endM] = hs.end.split(':').map(Number);
  // If current time is past or equal to the slot's end time, it's expired
  return currentHour > endH || (currentHour === endH && currentMin >= endM);
}

// ── VALIDATION HELPERS ──
function isValidInstitutionalEmail(email) {
  return /^[a-zA-Z0-9._%+-]+@vnrvjiet\.in$/i.test(email);
}

function isValidPhoneNumber(phone) {
  return /^[6-9]\d{9}$/.test(phone);
}

// ── HALF SLOT DEFINITIONS ──
export const HALF_SLOTS = [
  { id: 'morning',   label: 'Morning Slot',   start: '10:00', end: '13:00', display: '10:00 AM – 1:00 PM',  slotType: 'Morning Slot (10:00 AM – 1:00 PM)',  duration: '~3 hrs',  icon: 'sun'  },
  { id: 'afternoon', label: 'Afternoon Slot', start: '13:00', end: '17:00', display: '1:00 PM – 5:00 PM',   slotType: 'Afternoon Slot (1:00 PM – 5:00 PM)', duration: '~4 hrs',  icon: 'moon' },
];

// Detect which half a raw slot belongs to
function getHalfSlot(slot24) {
  if (!slot24) return HALF_SLOTS[0];
  const h = parseInt(slot24.split(':')[0], 10);
  return h < 13 ? HALF_SLOTS[0] : HALF_SLOTS[1];
}

// ── SECTION 3 — MOCK API ──
import { supabase } from './supabaseClient';

class MockAPI {
  static _mapFromDB(b) {
    return {
      ...b,
      auditoriumId: b.auditoriumId || b.auditoriumid,
      startSlot: b.startSlot || b.startslot,
      endSlot: b.endSlot || b.endslot,
      halfSlot: b.halfSlot || b.halfslot,
      userId: b.userId || b.userid,
      approvedBy: b.approvedBy || b.approvedby,
      createdAt: b.createdAt || b.createdat,
    };
  }
  static async getBookings(date) {
    const { data, error } = await supabase.from('bookings').select('*').eq('date', date);
    if (error) { console.error('Error fetching bookings:', error); return []; }
    return (data || []).map(this._mapFromDB);
  }
  static async getAllBookings() {
    const { data, error } = await supabase.from('bookings').select('*');
    if (error) { console.error('Error fetching all bookings:', error); return []; }
    return (data || []).map(this._mapFromDB);
  }
  static async getBookingsByUser(userId) {
    // Try checking both cases in case of mixed setups
    const { data, error } = await supabase.from('bookings').select('*').eq('userid', userId);
    if (error) { console.error('Error fetching user bookings:', error); return []; }
    return (data || []).map(this._mapFromDB);
  }
  static async createBooking(bookingObj) {
    const newBooking = {
      id: 'bk-' + Math.random().toString(36).substr(2, 8).toUpperCase(),
      auditoriumid: bookingObj.auditoriumId,
      date: bookingObj.date,
      startslot: bookingObj.startSlot,
      endslot: bookingObj.endSlot,
      halfslot: bookingObj.halfSlot,
      userid: bookingObj.userId,
      purpose: bookingObj.purpose,
      attendance: bookingObj.attendance,
      status: bookingObj.status,
      approvedby: bookingObj.approvedBy,
      createdat: format(new Date(), 'yyyy-MM-dd'),
      requester_name: bookingObj.requester_name,
      roll_no: bookingObj.roll_no,
      phone: bookingObj.phone,
      email: bookingObj.email
    };
    const { data, error } = await supabase.from('bookings').insert([newBooking]).select();
    if (error) { console.error('Error creating booking:', error); return { success: false, error: error.message }; }
    const mappedBooking = this._mapFromDB(data[0]);
    return { success: true, booking: mappedBooking, error: null };
  }
  static async cancelBooking(id, userId) {
    // Check if user is admin or owns the booking
    const { data: rawData } = await supabase.from('bookings').select('*').eq('id', id).single();
    if (!rawData) return { success: false, error: 'Booking not found' };
    
    const target = this._mapFromDB(rawData);
    
    const isAdmin = SEED_USERS.find(u => u.id === userId)?.role === 'admin';
    if (target.userId !== userId && !isAdmin) return { success: false, error: 'Unauthorized' };
    
    const { error } = await supabase.from('bookings').delete().eq('id', id);
    if (error) { console.error('Error canceling booking:', error); return { success: false, error: error.message }; }
    return { success: true, error: null };
  }
  static async approveBooking(id, adminId) {
    const { error } = await supabase.from('bookings').update({ status: 'confirmed', approvedby: adminId }).eq('id', id);
    if (error) { console.error('Error approving booking:', error); return { success: false, error: error.message }; }
    return { success: true, error: null };
  }
  static async getAnalytics() {
    const { data: all, error } = await supabase.from('bookings').select('*');
    if (error || !all) return { mostUsedHall: 'N/A', totalToday: 0, pendingCount: 0, morningCount: 0, afternoonCount: 0 };
    
    const today = (all || []).map(this._mapFromDB).filter(b => b.date === TODAY && b.status !== 'cancelled');
    const countMap = {};
    let pendingCount = 0;
    let morningCount = 0;
    let afternoonCount = 0;
    today.forEach(b => {
      countMap[b.auditoriumId] = (countMap[b.auditoriumId] || 0) + 1;
      if (b.status === 'pending') pendingCount++;
      if (b.halfSlot === 'morning') morningCount++;
      else afternoonCount++;
    });
    const mostUsedHall = Object.keys(countMap).sort((a, b) => countMap[b] - countMap[a])[0];
    return {
      mostUsedHall: SEED_AUDITORIUMS.find(a => a.id === mostUsedHall)?.name || 'N/A',
      totalToday: today.length,
      pendingCount,
      morningCount,
      afternoonCount,
    };
  }
  static async migrateOldData() {
    // No-op for Supabase migration
  }
}

// ── SECTION 4 — BOOKING ENGINE ──
const BookingEngine = {
  // Range-overlap collision using lexicographic HH:MM comparison
  checkCollision(newBooking, existingBookings) {
    const nStart = newBooking.startSlot;
    const nEnd   = newBooking.endSlot;
    return existingBookings.find(b => {
      if (b.auditoriumId !== newBooking.auditoriumId || b.date !== newBooking.date) return false;
      if (b.status === 'cancelled') return false;
      // Overlaps when: existing.start < new.end AND existing.end > new.start
      return b.startSlot < nEnd && b.endSlot > nStart;
    }) || null;
  },

  isHalfSlotAvailable(auditoriumId, date, halfSlotId, bookings) {
    const hs = HALF_SLOTS.find(h => h.id === halfSlotId);
    if (!hs) return false;
    return !this.checkCollision({ auditoriumId, date, startSlot: hs.start, endSlot: hs.end }, bookings);
  },

  suggestAlternatives(auditoriumId, date, halfSlotId, bookings, auditoriums) {
    const otherHalfId = halfSlotId === 'morning' ? 'afternoon' : 'morning';
    const otherSlotFree = this.isHalfSlotAvailable(auditoriumId, date, otherHalfId, bookings);
    const hs = HALF_SLOTS.find(h => h.id === halfSlotId);
    const altHalls = auditoriums.filter(a =>
      a.id !== auditoriumId &&
      !this.checkCollision({ auditoriumId: a.id, date, startSlot: hs.start, endSlot: hs.end }, bookings)
    );
    return { otherSlotFree, otherHalfId, alternativeHalls: altHalls.slice(0, 2) };
  },

  validateBooking(booking, user, auditorium) {
    const errors = [];
    if (!booking.purpose || booking.purpose.trim().length < 10) errors.push('Purpose must be at least 10 characters.');
    if (!booking.attendance || booking.attendance <= 0) errors.push('Attendance must be greater than 0.');
    if (booking.attendance > auditorium.capacity) errors.push(`Attendance (${booking.attendance}) exceeds hall capacity (${auditorium.capacity}).`);
    // Admin and teacher bookings are auto-confirmed; club leads need approval
    if (user.role === 'admin' || user.role === 'teacher') {
      booking.status = 'confirmed';
      booking.approvedBy = user.id;
    } else {
      booking.status = 'confirmed'; // auto-confirm for demo clarity
    }
    return { valid: errors.length === 0, errors };
  },
};

// ── SECTION 5 — CONTEXT ──
const BookingContext = createContext();
export function useBooking() { return useContext(BookingContext); }

// ── SECTION 6 — APP ROOT ──
export default function App() {
  const [toasts, setToasts] = useState([]);
  const [activeView, setActiveView] = useState('Dashboard');
  const [selectedDate, setSelectedDate] = useState(TODAY);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [currentUser, setCurrentUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('audisync_session')) || null; } catch { return null; }
  });

  useEffect(() => { MockAPI.migrateOldData(); }, []);

  // Set up Supabase Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('public:bookings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, payload => {
        console.log('Realtime update:', payload);
        setRefreshTrigger(prev => prev + 1);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('audisync_session');
    setCurrentUser(null);
    setActiveView('Dashboard');
  };

  const addToast = useCallback((message, type = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  }, []);

  const ctxValue = useMemo(() => ({
    currentUser, setCurrentUser,
    activeView, setActiveView,
    selectedDate, setSelectedDate,
    refreshTrigger,
    addToast,
  }), [currentUser, activeView, selectedDate, refreshTrigger, addToast]);

  return (
    <BookingContext.Provider value={ctxValue}>
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-[#0a1628] to-[#0d1432] text-slate-400 font-sans selection:bg-emerald-500/30 overflow-x-hidden pb-20 md:pb-0">

        {/* Toast System */}
        <div className="fixed bottom-4 right-4 z-[999] flex flex-col gap-2 pointer-events-none">
          <AnimatePresence>
            {toasts.map(toast => (
              <motion.div key={toast.id}
                initial={{ x: 100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                className={cn(
                  'px-4 py-3 rounded-xl border flex items-center gap-3 min-w-[300px] shadow-2xl backdrop-blur-md pointer-events-auto',
                  toast.type === 'success' && 'bg-emerald-950/90 border-emerald-500/30 text-emerald-100',
                  toast.type === 'error'   && 'bg-rose-950/90 border-rose-500/30 text-rose-100',
                  toast.type === 'warning' && 'bg-amber-950/90 border-amber-500/30 text-amber-100',
                  toast.type === 'info'    && 'bg-indigo-950/90 border-indigo-500/30 text-indigo-100',
                )}>
                <Info className="w-4 h-4 shrink-0" />
                <p className="flex-1 text-sm font-medium">{toast.message}</p>
                <button onClick={() => setToasts(p => p.filter(t => t.id !== toast.id))} className="text-white/50 hover:text-white"><X className="w-4 h-4" /></button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {!currentUser ? (
          <LoginView onLogin={(u) => {
            localStorage.setItem('audisync_session', JSON.stringify(u));
            setCurrentUser(u);
          }} />
        ) : (
          <>
            {/* ── HEADER ── */}
            <header className="sticky top-0 z-[60] bg-[#060e1d]/80 backdrop-blur-xl border-b border-white/[0.07]">
              <div className="max-w-[1440px] mx-auto px-4 sm:px-6">
                <div className="h-16 flex items-center justify-between gap-4">

                  {/* Logo + Branding */}
                  <div className="flex items-center gap-3 shrink-0 select-none">
                    <div className="relative w-10 h-10 shrink-0">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#8B1A1A] via-[#c0392b] to-[#922B21] flex items-center justify-center shadow-[0_0_20px_rgba(180,30,30,0.45)] border border-red-700/40">
                        <span className="text-white font-black text-[11px] tracking-tight leading-none">VNR</span>
                      </div>
                      <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-[#060e1d] flex items-center justify-center">
                        <ShieldCheck className="w-2 h-2 text-white" />
                      </div>
                    </div>
                    <div>
                      <h1 className="text-sm font-black text-white leading-none tracking-tight">AudiSync</h1>
                      <p className="text-[9px] text-slate-500 font-bold tracking-widest mt-0.5 uppercase hidden sm:block">VNR VJIET · Auditorium Booking</p>
                    </div>
                  </div>

                  {/* Desktop Nav */}
                  <nav className="hidden md:flex bg-white/[0.05] border border-white/[0.08] p-1.5 rounded-full">
                    {['Dashboard', 'Schedule', 'My Bookings'].map(v => (
                      <button key={v} onClick={() => setActiveView(v)}
                        className={cn(
                          'px-4 py-1.5 rounded-full text-sm font-semibold transition-all duration-200',
                          activeView === v
                            ? 'bg-white/10 text-emerald-400 shadow-inner'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                        )}>{v}</button>
                    ))}
                    {currentUser.role === 'admin' && (
                      <button onClick={() => setActiveView('Admin')}
                        className={cn(
                          'px-4 py-1.5 rounded-full text-sm font-semibold transition-all duration-200',
                          activeView === 'Admin'
                            ? 'bg-amber-500/10 text-amber-400 shadow-inner'
                            : 'text-amber-400/60 hover:text-amber-400 hover:bg-white/5'
                        )}>Admin</button>
                    )}
                  </nav>

                  {/* Right: User info + logout */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className="text-sm font-bold text-white leading-none">{currentUser.name}</p>
                      <p className="text-[10px] text-slate-500 font-bold mt-0.5">{currentUser.rollNo || currentUser.department}</p>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-600 to-indigo-800 border border-indigo-500/30 flex items-center justify-center text-xs font-black text-white shadow">
                      {currentUser.avatar || currentUser.name?.substring(0, 2).toUpperCase()}
                    </div>
                    <button onClick={handleLogout} title="Log out"
                      className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:bg-rose-500/20 hover:text-rose-400 hover:border-rose-500/30 transition-all">
                      <LogOut className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Mobile nav */}
                <div className="md:hidden border-t border-white/5 flex overflow-x-auto">
                  {['Dashboard', 'Schedule', 'My Bookings', ...(currentUser.role === 'admin' ? ['Admin'] : [])].map(v => (
                    <button key={v} onClick={() => setActiveView(v)}
                      className={cn(
                        'flex-1 py-2.5 text-[11px] font-bold uppercase tracking-wider whitespace-nowrap transition-colors px-2',
                        activeView === v ? 'text-emerald-400 border-b-2 border-emerald-500' : 'text-slate-500'
                      )}>{v}</button>
                  ))}
                </div>
              </div>
            </header>

            {/* View Router */}
            <main className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6">
              <AnimatePresence mode="wait">
                <motion.div key={activeView}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}>
                  {activeView === 'Dashboard'   && <DashboardView />}
                  {activeView === 'Schedule'    && <ScheduleView />}
                  {activeView === 'My Bookings' && <MyBookingsView />}
                  {activeView === 'Admin'       && <AdminPanel />}
                </motion.div>
              </AnimatePresence>
            </main>
          </>
        )}
      </div>
    </BookingContext.Provider>
  );
}

// ── SHARED: GlassCard ──
const GlassCard = ({ children, className }) => (
  <div className={cn('bg-white/[0.04] backdrop-blur-sm border border-white/[0.08] rounded-2xl w-full', className)}>
    {children}
  </div>
);

// ── MINI CALENDAR ──
function MiniCalendar({ onClose }) {
  const { selectedDate, setSelectedDate } = useContext(BookingContext);
  const [viewMonth, setViewMonth] = useState(() => parseISO(selectedDate));
  const [bookedDates, setBookedDates] = useState(new Set());
  const ref = useRef(null);

  useEffect(() => {
    MockAPI.getAllBookings().then(bks => {
      setBookedDates(new Set(bks.filter(b => b.status !== 'cancelled').map(b => b.date)));
    });
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose?.();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const monthStart = startOfMonth(viewMonth);
  const monthEnd   = endOfMonth(viewMonth);
  const days       = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPad   = getDay(monthStart); // 0=Sun
  const weekdays   = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  return (
    <motion.div ref={ref}
      initial={{ opacity: 0, scale: 0.96, y: -6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, y: -6 }}
      transition={{ duration: 0.15 }}
      className="absolute top-full left-0 mt-2 z-[150] w-[272px] bg-[#0a1628] border border-white/10 rounded-2xl p-4 shadow-2xl shadow-black/70"
    >
      {/* Month Header */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setViewMonth(subMonths(viewMonth, 1))}
          className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
          <ChevronLeft className="w-4 h-4 text-slate-400" />
        </button>
        <span className="text-sm font-bold text-white">
          {format(viewMonth, 'MMMM yyyy')}
        </span>
        <button onClick={() => setViewMonth(addMonths(viewMonth, 1))}
          className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      {/* Weekday Headers */}
      <div className="grid grid-cols-7 mb-1">
        {weekdays.map(wd => (
          <div key={wd} className="text-center text-[10px] text-slate-600 uppercase font-bold py-1">{wd}</div>
        ))}
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {Array.from({ length: startPad }).map((_, i) => <div key={`pad-${i}`} />)}
        {days.map(day => {
          const dayStr     = format(day, 'yyyy-MM-dd');
          const isToday    = isSameDay(day, new Date());
          const isSelected = dayStr === selectedDate;
          const hasBooking = bookedDates.has(dayStr);
          const isCurrentMonth = isSameMonth(day, viewMonth);
          // Block past dates and dates beyond MAX_FUTURE_DAYS
          const todayDate  = new Date(); todayDate.setHours(0,0,0,0);
          const maxDate    = addDays(todayDate, MAX_FUTURE_DAYS);
          const dayNorm    = new Date(day); dayNorm.setHours(0,0,0,0);
          const isPast     = dayNorm < todayDate;
          const isTooFar   = dayNorm > maxDate;
          const isDisabled = !isCurrentMonth || isPast || isTooFar;

          return (
            <button key={dayStr}
              onClick={() => { if (!isDisabled) { setSelectedDate(dayStr); onClose?.(); } }}
              disabled={isDisabled}
              className={cn(
                'flex flex-col items-center justify-center h-9 w-full rounded-lg transition-all text-sm font-semibold',
                !isCurrentMonth   ? 'opacity-0 pointer-events-none' :
                (isPast || isTooFar) ? 'opacity-25 cursor-not-allowed text-slate-600' :
                isSelected        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' :
                isToday           ? 'ring-1 ring-emerald-500 text-emerald-400 hover:bg-white/10' :
                                    'hover:bg-white/8 text-slate-300',
              )}>
              <span>{format(day, 'd')}</span>
              {hasBooking && !isSelected && (
                <span className="w-1 h-1 rounded-full bg-emerald-400 mt-0.5" />
              )}
            </button>
          );
        })}
      </div>

      {/* Today shortcut */}
      <button
        onClick={() => { setSelectedDate(TODAY); setViewMonth(new Date()); onClose?.(); }}
        className="w-full mt-3 py-1.5 text-xs font-bold text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors border border-emerald-500/20">
        Jump to Today
      </button>
    </motion.div>
  );
}

// ── DASHBOARD ──
function DashboardView() {
  const { setActiveView, currentUser, selectedDate, refreshTrigger } = useContext(BookingContext);
  const [loading, setLoading] = useState(true);
  const [stats, setStats]     = useState({ totalToday: 0, pendingCount: 0, mostUsedHall: '-', morningCount: 0, afternoonCount: 0 });
  const [recent, setRecent]   = useState([]);
  const [showCal, setShowCal] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([MockAPI.getAnalytics(), MockAPI.getBookings(TODAY)]).then(([a, bks]) => {
      if (!active) return;
      setStats(a);
      setRecent(bks.slice(0, 5));
      setLoading(false);
    });
    return () => { active = false; };
  }, [selectedDate, refreshTrigger]);

  const totalSlots = SEED_AUDITORIUMS.length * 2;
  const statCards = [
    { label: 'Bookings Today',    value: stats.totalToday,                 color: 'emerald', sub: 'events active',   Icon: CalIcon },
    { label: 'Available Slots',   value: totalSlots - stats.totalToday,    color: 'indigo',  sub: 'free slots',       Icon: Building2 },
    { label: 'Pending Approvals', value: stats.pendingCount,               color: 'amber',   sub: 'need sign-off',    Icon: AlertCircle },
  ];

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight">Dashboard</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Welcome back, <span className="text-emerald-400 font-bold">{currentUser.name.split(' ')[0]}</span>.
            {' '}Here's your campus overview.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <button onClick={() => setShowCal(v => !v)}
              className="flex items-center gap-2 px-4 py-2.5 bg-white/[0.05] hover:bg-white/10 border border-white/10 text-sm font-bold text-white rounded-xl transition-colors">
              <CalIcon className="w-4 h-4 text-indigo-400" />
              {isSameDay(parseISO(selectedDate), new Date()) ? 'Today' : format(parseISO(selectedDate), 'MMM d')}
            </button>
            <AnimatePresence>{showCal && <MiniCalendar onClose={() => setShowCal(false)} />}</AnimatePresence>
          </div>
          <button onClick={() => setActiveView('Schedule')}
            className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.25)] active:scale-95 flex items-center gap-2 text-sm">
            <CalIcon className="w-4 h-4" /> New Booking
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(card => (
          <GlassCard key={card.label} className="p-5 relative overflow-hidden group cursor-default">
            <div className={cn('absolute -right-4 -top-4 w-20 h-20 rounded-full blur-3xl transition-all',
              card.color === 'emerald' ? 'bg-emerald-500/8 group-hover:bg-emerald-500/15' :
              card.color === 'indigo'  ? 'bg-indigo-500/8 group-hover:bg-indigo-500/15' :
                                         'bg-amber-500/8 group-hover:bg-amber-500/15'
            )} />
            <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mb-3',
              card.color === 'emerald' ? 'bg-emerald-500/10' :
              card.color === 'indigo'  ? 'bg-indigo-500/10' : 'bg-amber-500/10'
            )}>
              <card.Icon className={cn('w-4 h-4',
                card.color === 'emerald' ? 'text-emerald-400' :
                card.color === 'indigo'  ? 'text-indigo-400' : 'text-amber-400'
              )} />
            </div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{card.label}</p>
            <div className="mt-2 flex items-end gap-2">
              <p className="text-3xl font-black text-white">{loading ? '—' : card.value}</p>
              <p className={cn('text-xs font-bold mb-0.5',
                card.color === 'emerald' ? 'text-emerald-400' :
                card.color === 'indigo'  ? 'text-indigo-400' : 'text-amber-400'
              )}>{card.sub}</p>
            </div>
          </GlassCard>
        ))}
        <GlassCard className="p-5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3 bg-rose-500/10">
            <BarChart3 className="w-4 h-4 text-rose-400" />
          </div>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Most Booked Hall</p>
          <p className="mt-2 text-sm font-bold text-white leading-snug">{loading ? '—' : stats.mostUsedHall}</p>
        </GlassCard>
      </div>

      {/* Main Content Row */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <GlassCard className="lg:col-span-2 p-6">
          <div className="flex justify-between items-center mb-5">
            <h3 className="font-bold text-white">Recent Activity</h3>
            <button onClick={() => setActiveView('Schedule')} className="text-xs font-bold bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg transition-colors">View Schedule →</button>
          </div>
          {loading ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-14 bg-white/5 rounded-xl animate-pulse" />)}</div>
          ) : recent.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-600">
              <CalIcon className="w-8 h-8 opacity-30" />
              <p className="font-medium text-sm">No bookings yet today.</p>
              <button onClick={() => setActiveView('Schedule')} className="text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors">Book a slot →</button>
            </div>
          ) : (
            <div className="space-y-2">
              {recent.map(b => {
                const audi  = SEED_AUDITORIUMS.find(a => a.id === b.auditoriumId);
                const hSlot = HALF_SLOTS.find(h => h.id === b.halfSlot) || HALF_SLOTS[0];
                return (
                  <div key={b.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors group">
                    <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
                      hSlot.id === 'morning' ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-indigo-500/10 border border-indigo-500/20'
                    )}>
                      {hSlot.id === 'morning'
                        ? <Sun className="w-4 h-4 text-amber-400" />
                        : <Moon className="w-4 h-4 text-indigo-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate">{audi?.name}</p>
                      <p className="text-xs text-slate-500">
                        {format(parseISO(b.date), 'EEEE, MMM do')} • {hSlot.display}
                      </p>
                    </div>
                    <span className={cn('text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border shrink-0',
                      b.status === 'confirmed'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    )}>{b.status}</span>
                  </div>
                );
              })}
            </div>
          )}
        </GlassCard>

        {/* Right Column */}
        <div className="space-y-4">
          {/* Slot Distribution */}
          <GlassCard className="p-5">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <BarChart3 className="w-3.5 h-3.5" />
              Slot Distribution Today
            </h3>
            {[
              { id: 'morning',   label: 'Morning',   count: stats.morningCount,   color: 'amber',  Icon: Sun  },
              { id: 'afternoon', label: 'Afternoon',  count: stats.afternoonCount, color: 'indigo', Icon: Moon },
            ].map(({ id, label, count, color, Icon }) => {
              const max = Math.max(stats.morningCount + stats.afternoonCount, 1);
              const pct = Math.round((count / max) * 100);
              return (
                <div key={id} className="mb-3 last:mb-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
                      <Icon className={cn('w-3.5 h-3.5', color === 'amber' ? 'text-amber-400' : 'text-indigo-400')} />
                      {label}
                    </span>
                    <span className="text-xs font-bold text-white">{count} booking{count !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                      className={cn('h-full rounded-full', color === 'amber' ? 'bg-amber-400' : 'bg-indigo-400')}
                    />
                  </div>
                </div>
              );
            })}
          </GlassCard>

          {/* Quick Actions */}
          <GlassCard className="p-5 bg-gradient-to-br from-indigo-600/10 to-indigo-800/5 border-indigo-500/20">
            <h3 className="font-bold text-indigo-100 mb-1 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              Quick Actions
            </h3>
            <p className="text-xs text-indigo-200/50 mb-4 leading-relaxed">Navigate to key features quickly.</p>
            <div className="space-y-2">
              <button onClick={() => setActiveView('Schedule')}
                className="w-full flex items-center justify-between px-3 py-2.5 bg-white/5 hover:bg-white/10 text-white text-sm font-bold rounded-xl transition-all active:scale-95">
                <span className="flex items-center gap-2"><CalIcon className="w-4 h-4 text-emerald-400" />Book a Slot</span>
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </button>
              <button onClick={() => setActiveView('My Bookings')}
                className="w-full flex items-center justify-between px-3 py-2.5 bg-white/5 hover:bg-white/10 text-white text-sm font-bold rounded-xl transition-all active:scale-95">
                <span className="flex items-center gap-2"><Receipt className="w-4 h-4 text-indigo-400" />My Bookings</span>
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </button>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

// ── SCHEDULE VIEW — 2-Row Half-Slot Grid ──
function ScheduleView() {
  const { selectedDate, setSelectedDate, currentUser, addToast, refreshTrigger } = useContext(BookingContext);
  const [bookings, setBookings]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [panelData, setPanelData] = useState(null);
  const [showCal, setShowCal]     = useState(false);

  const fetchGrid = useCallback(() => {
    setLoading(true);
    MockAPI.getBookings(selectedDate).then(d => { setBookings(d); setLoading(false); });
  }, [selectedDate, refreshTrigger]);

  useEffect(() => { fetchGrid(); }, [fetchGrid]);

  const handleCellClick = (audiId, halfSlotId) => {
    if (!currentUser) { addToast('Please log in to book.', 'error'); return; }
    if (!BookingEngine.isHalfSlotAvailable(audiId, selectedDate, halfSlotId, bookings)) return;
    if (isSlotExpired(selectedDate, halfSlotId)) { addToast('This slot has already elapsed.', 'error'); return; }
    setPanelData({ audiId, halfSlotId });
  };

  const prevDate = () => {
    const prev = subDays(parseISO(selectedDate), 1);
    const todayDate = new Date(); todayDate.setHours(0,0,0,0);
    if (prev >= todayDate) setSelectedDate(format(prev, 'yyyy-MM-dd'));
  };
  const nextDate = () => {
    const next = addDays(parseISO(selectedDate), 1);
    const todayDate = new Date(); todayDate.setHours(0,0,0,0);
    const maxDate = addDays(todayDate, MAX_FUTURE_DAYS);
    if (next <= maxDate) setSelectedDate(format(next, 'yyyy-MM-dd'));
  };

  // Determine if prev/next buttons should be disabled
  const todayDateForNav = new Date(); todayDateForNav.setHours(0,0,0,0);
  const canGoPrev = subDays(parseISO(selectedDate), 1) >= todayDateForNav;
  const canGoNext = addDays(parseISO(selectedDate), 1) <= addDays(todayDateForNav, MAX_FUTURE_DAYS);

  return (
    <div className="space-y-5">
      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/[0.04] p-4 rounded-2xl border border-white/[0.08]">
        <div className="flex items-center gap-2">
          <button onClick={prevDate} disabled={!canGoPrev}
            className={cn('p-2 rounded-full transition-colors', canGoPrev ? 'hover:bg-white/10 text-slate-300' : 'opacity-30 cursor-not-allowed text-slate-600')}>
            <ChevronLeft className="w-5 h-5" />
          </button>

          {/* Clickable Date → MiniCalendar */}
          <div className="relative">
            <button onClick={() => setShowCal(v => !v)}
              className="px-4 py-2 bg-slate-900/80 border border-slate-700/50 rounded-full text-sm font-bold text-white flex items-center gap-2 min-w-[170px] justify-center hover:bg-slate-800/80 transition-colors">
              <CalIcon className="w-4 h-4 text-indigo-400" />
              {isSameDay(parseISO(selectedDate), new Date())
                ? 'Today'
                : format(parseISO(selectedDate), 'MMM do, yyyy')}
            </button>
            <AnimatePresence>{showCal && <MiniCalendar onClose={() => setShowCal(false)} />}</AnimatePresence>
          </div>

          <button onClick={nextDate} disabled={!canGoNext}
            className={cn('p-2 rounded-full transition-colors', canGoNext ? 'hover:bg-white/10 text-slate-300' : 'opacity-30 cursor-not-allowed text-slate-600')}>
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-[11px] font-bold uppercase tracking-wider pr-2">
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded border-2 border-dashed border-emerald-500/40 bg-transparent" /> Available</div>
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-indigo-500/60" /> Confirmed</div>
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-amber-500/60" /> Pending</div>
        </div>
      </div>

      {/* Half-Slot Grid */}
      <GlassCard className="overflow-hidden border-white/[0.06] shadow-2xl">
        <div className="overflow-x-auto">
          <div className="min-w-[720px]">

            {/* Column Header Row */}
            <div className="flex border-b border-white/[0.08] bg-slate-950/60 sticky top-0 z-20">
              <div className="w-52 shrink-0 px-5 py-4 border-r border-white/[0.06] bg-slate-950/80 sticky left-0 z-30 flex items-center">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                  <Building2 className="w-3 h-3" /> Hall / Slot
                </span>
              </div>
              <div className="flex flex-1">
                {HALF_SLOTS.map(hs => (
                  <div key={hs.id} className="flex-1 px-4 py-4 flex items-center gap-2.5 border-r last:border-r-0 border-white/[0.05]">
                    {hs.id === 'morning'
                      ? <Sun className="w-4 h-4 text-amber-400 shrink-0" />
                      : <Moon className="w-4 h-4 text-indigo-400 shrink-0" />}
                    <div>
                      <p className="text-xs font-bold text-white">{hs.label}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{hs.display}</p>
                    </div>
                    <span className="ml-auto text-[9px] text-slate-600 font-bold">{hs.duration}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Auditorium Rows */}
            <div className="divide-y divide-white/[0.04]">
              {SEED_AUDITORIUMS.map(audi => (
                <div key={audi.id} className="flex group hover:bg-white/[0.015] transition-colors">
                  {/* Hall Label */}
                  <div className="w-52 shrink-0 px-4 py-4 border-r border-white/[0.06] sticky left-0 bg-[#080e1d] group-hover:bg-[#0a1225] z-10 flex flex-col justify-center transition-colors">
                    <h3 className="text-sm font-bold text-white leading-snug line-clamp-2">{audi.name}</h3>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <span className="px-1.5 py-0.5 rounded bg-white/5 text-[9px] font-bold uppercase tracking-wider text-slate-400 border border-white/5">{audi.block}</span>
                      <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-[9px] font-bold text-indigo-400 border border-indigo-500/20">{audi.capacity} Pax</span>
                    </div>
                  </div>

                  {/* Half-Slot Cells */}
                  <div className="flex flex-1">
                    {HALF_SLOTS.map(hs => {
                      const bk = bookings.find(b =>
                        b.auditoriumId === audi.id && (
                          b.halfSlot === hs.id ||
                          (b.startSlot >= hs.start && b.startSlot < hs.end) ||
                          (b.startSlot === hs.start)
                        )
                      );
                      const isAvailable = BookingEngine.isHalfSlotAvailable(audi.id, selectedDate, hs.id, bookings);
                      const expired = isSlotExpired(selectedDate, hs.id);

                      return (
                        <div key={hs.id} className="flex-1 border-r last:border-r-0 border-white/[0.04] p-2 min-h-[80px]">
                          {loading ? (
                            <div className="w-full h-full min-h-[64px] bg-white/5 animate-pulse rounded-xl" />
                          ) : bk ? (
                            /* Booked Cell */
                            <div className="group/bk relative w-full h-full min-h-[64px]">
                              <div className={cn(
                                'w-full h-full min-h-[64px] rounded-xl flex flex-col justify-center px-3 py-2 border cursor-default',
                                bk.status === 'confirmed'
                                  ? 'bg-indigo-500/15 border-indigo-500/30'
                                  : 'bg-amber-500/15 border-amber-500/30'
                              )}>
                                <div className="flex items-center gap-1.5 mb-1">
                                  <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[9px] font-bold text-white shrink-0">
                                    {(bk.requester_name || '?').substring(0, 2).toUpperCase()}
                                  </div>
                                  <p className={cn('text-xs font-bold truncate', bk.status === 'confirmed' ? 'text-indigo-200' : 'text-amber-200')}>
                                    {bk.requester_name || 'Reserved'}
                                  </p>
                                </div>
                                <p className="text-[10px] text-slate-400 truncate leading-tight">{bk.purpose}</p>
                                <span className={cn('text-[9px] uppercase font-black tracking-widest mt-1.5',
                                  bk.status === 'confirmed' ? 'text-indigo-400' : 'text-amber-400'
                                )}>{bk.status}</span>
                              </div>
                              {/* Hover Tooltip */}
                              <div className="absolute hidden group-hover/bk:block z-[200] left-1/2 -translate-x-1/2 bottom-[108%] w-[240px] pointer-events-none pb-2">
                                <div className="bg-[#0c1520] border border-white/10 rounded-xl shadow-2xl p-4">
                                  <p className="font-bold text-white text-sm mb-1">{bk.requester_name || 'Requester'}</p>
                                  {bk.roll_no && <p className="text-[10px] text-slate-500 mb-1">Roll: {bk.roll_no}</p>}
                                  {bk.phone && <p className="text-[10px] text-slate-500 mb-2">📞 {bk.phone}</p>}
                                  <p className="text-xs text-slate-300 mb-3 line-clamp-2">{bk.purpose}</p>
                                  <div className="flex justify-between text-xs">
                                    <span className="text-slate-500 flex items-center gap-1"><Users className="w-3 h-3" /> {bk.attendance}</span>
                                    <span className={cn('font-bold', bk.status === 'confirmed' ? 'text-emerald-400' : 'text-amber-400')}>
                                      {bk.status.toUpperCase()}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : expired ? (
                            /* Expired Cell */
                            <div className="w-full h-full min-h-[64px] rounded-xl border-2 border-dashed border-white/[0.04] flex items-center justify-center bg-white/[0.02] cursor-not-allowed">
                              <span className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">
                                Elapsed
                              </span>
                            </div>
                          ) : (
                            /* Available Cell */
                            <button
                              onClick={() => handleCellClick(audi.id, hs.id)}
                              aria-label={`Book ${audi.name} — ${hs.label}`}
                              className="w-full h-full min-h-[64px] rounded-xl border-2 border-dashed border-white/[0.08] hover:border-emerald-500/40 transition-all duration-200 group/cell flex items-center justify-center cursor-pointer bg-transparent hover:bg-emerald-500/[0.04]">
                              <span className="text-[10px] text-emerald-400 font-bold opacity-0 group-hover/cell:opacity-100 uppercase tracking-widest transition-opacity">
                                Click to book
                              </span>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Booking Panel */}
      <AnimatePresence>
        {panelData && (
          <BookingPanel
            date={selectedDate}
            audiId={panelData.audiId}
            initialHalfSlotId={panelData.halfSlotId}
            existingBookings={bookings}
            onClose={() => { setPanelData(null); fetchGrid(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── BOOKING PANEL ──
function BookingPanel({ date, audiId, initialHalfSlotId, existingBookings, onClose }) {
  const { currentUser, addToast, setActiveView } = useContext(BookingContext);
  const audi = SEED_AUDITORIUMS.find(a => a.id === audiId);

  const [step, setStep]                         = useState(1);
  const [loading, setLoading]                   = useState(false);
  const [confirmedBooking, setConfirmedBooking] = useState(null);
  const [emailResult, setEmailResult]           = useState(null);
  const [halfSlotId, setHalfSlotId]             = useState(initialHalfSlotId || 'morning');
  const selectedHalfSlot                        = HALF_SLOTS.find(h => h.id === halfSlotId);

  const [form, setForm] = useState({
    name:       '',
    rollNo:     currentUser?.name  || '',
    email:      currentUser?.email || '',
    phone:      currentUser?.phone || '',
    purpose:    '',
    attendance: '',
  });

  const isConflict = !BookingEngine.isHalfSlotAvailable(audi.id, date, halfSlotId, existingBookings);
  const alterns = useMemo(() =>
    isConflict ? BookingEngine.suggestAlternatives(audi.id, date, halfSlotId, existingBookings, SEED_AUDITORIUMS) : null,
    [isConflict, audi.id, date, halfSlotId, existingBookings]
  );

  const canProceedStep1 = !isConflict;
  const emailValid = isValidInstitutionalEmail(form.email.trim());
  const phoneValid = isValidPhoneNumber(form.phone.trim());

  const canProceedStep2 = (
    form.name.trim().length > 0 &&
    form.rollNo.trim().length > 0 &&
    emailValid &&
    phoneValid &&
    form.purpose.trim().length >= 10 &&
    form.attendance !== '' &&
    parseInt(form.attendance) > 0
  );

  const onSubmit = async () => {
    const hs = HALF_SLOTS.find(h => h.id === halfSlotId);
    const bk = {
      auditoriumId:   audi.id,
      userId:         currentUser.id,
      date,
      halfSlot:       halfSlotId,
      startSlot:      hs.start,
      endSlot:        hs.end,
      purpose:        form.purpose.trim(),
      attendance:     parseInt(form.attendance) || 1,
      requester_name: form.name.trim(),
      roll_no:        form.rollNo.trim(),
      phone:          form.phone.trim(),
      email:          form.email.trim(),
      department:     currentUser.department,
    };
    const { valid, errors } = BookingEngine.validateBooking(bk, currentUser, audi);
    if (!valid) { addToast(errors[0], 'error'); return; }

    setLoading(true);
    const { success, booking: newBooking, error } = await MockAPI.createBooking(bk);
    if (!success) { setLoading(false); addToast(error || 'Booking failed', 'error'); return; }

    // Send email
    const emailResult = await EmailService.sendBookingConfirmation(newBooking, currentUser, audi);
    setLoading(false);
    setConfirmedBooking(newBooking);
    setEmailResult(emailResult);
    addToast('Booking confirmed! 🎉', 'success');
    setStep(4);
  };

  // Confetti pieces (memoised for stable animation)
  const confettiPieces = useMemo(() => Array.from({ length: 8 }).map((_, i) => ({
    id: i,
    x: (Math.random() - 0.5) * 280,
    y: -(Math.random() * 180 + 60),
    rotate: Math.random() * 360,
    color: ['#10b981', '#6366f1', '#f59e0b', '#ec4899', '#06b6d4', '#a78bfa'][i % 6],
    size: Math.random() * 8 + 6,
  })), []);

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[90]" />

      <motion.div
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
        className="fixed inset-y-0 right-0 w-full sm:w-[500px] bg-[#06101e] border-l border-white/[0.08] z-[100] flex flex-col shadow-2xl">

        {/* Panel Header */}
        <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between shrink-0 bg-[#06101e]">
          <div>
            <h3 className="text-lg font-black text-white">
              {step === 4 ? 'Booking Receipt' : 'New Booking'}
            </h3>
            {step < 4 && (
              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                <Building2 className="w-3 h-3" /> {audi.name}
              </p>
            )}
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Step Indicator */}
        {step < 4 && (
          <div className="px-6 py-3 border-b border-white/[0.05] flex items-center gap-2 bg-[#06101e]">
            {['Slot Details', 'Event Info', 'Confirm'].map((label, idx) => {
              const s = idx + 1;
              return (
                <React.Fragment key={label}>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border transition-all',
                      step > s  ? 'bg-emerald-500 border-emerald-400 text-white' :
                      step === s ? 'bg-white border-white text-slate-900' :
                                   'bg-white/5 border-white/10 text-slate-600'
                    )}>
                      {step > s ? <Check className="w-3 h-3" /> : s}
                    </span>
                    <span className={cn('text-xs font-bold hidden sm:block', step === s ? 'text-white' : 'text-slate-600')}>{label}</span>
                  </div>
                  {idx < 2 && (
                    <div className={cn('flex-1 h-px transition-all', step > s ? 'bg-emerald-500/60' : 'bg-white/8')} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        )}

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <AnimatePresence mode="wait">

            {/* ── STEP 1: Slot Selection ── */}
            {step === 1 && (
              <motion.div key="step1"
                initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }}
                className="space-y-5">

                {/* Hall Info */}
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Selected Hall</p>
                  <div className="bg-white/[0.04] rounded-xl p-4 border border-white/[0.07]">
                    <p className="font-bold text-white">{audi.name}</p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <span className="px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-bold rounded uppercase">{audi.capacity} Capacity</span>
                    </div>
                  </div>
                </div>

                {/* Date */}
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Date</p>
                  <div className="bg-white/[0.04] rounded-xl p-4 border border-white/[0.07] flex items-center gap-3">
                    <CalIcon className="w-5 h-5 text-indigo-400 shrink-0" />
                    <p className="font-bold text-white">{format(parseISO(date), 'EEEE, MMMM do yyyy')}</p>
                  </div>
                </div>

                {/* Slot Selection */}
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Choose Slot</p>
                  <div className="grid grid-cols-2 gap-3">
                    {HALF_SLOTS.map(hs => {
                      const available = BookingEngine.isHalfSlotAvailable(audi.id, date, hs.id, existingBookings);
                      const expired   = isSlotExpired(date, hs.id);
                      const canSelect = available && !expired;
                      const selected  = halfSlotId === hs.id;
                      return (
                        <button key={hs.id}
                          onClick={() => canSelect && setHalfSlotId(hs.id)}
                          disabled={!canSelect}
                          className={cn(
                            'relative p-4 rounded-2xl border-2 flex flex-col items-center gap-2.5 transition-all text-center',
                            selected && canSelect ? 'border-emerald-500 bg-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.1)]' :
                            canSelect             ? 'border-white/10 hover:border-white/25 bg-white/[0.03]' :
                                                    'border-white/5 bg-white/[0.02] opacity-40 cursor-not-allowed'
                          )}>
                          {selected && canSelect && (
                            <span className="absolute top-2 right-2 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center">
                              <Check className="w-2.5 h-2.5 text-white" />
                            </span>
                          )}
                          {hs.id === 'morning'
                            ? <Sun className={cn('w-7 h-7', selected ? 'text-emerald-400' : 'text-amber-400')} />
                            : <Moon className={cn('w-7 h-7', selected ? 'text-emerald-400' : 'text-indigo-400')} />}
                          <div>
                            <p className={cn('text-sm font-bold', selected ? 'text-white' : 'text-slate-300')}>{hs.label}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">{hs.display}</p>
                            <p className="text-[10px] text-slate-600 mt-0.5">{hs.duration}</p>
                          </div>
                          {expired && (
                            <span className="text-[9px] text-slate-500 font-bold uppercase bg-white/5 px-2 py-0.5 rounded-full border border-white/10">Elapsed</span>
                          )}
                          {!available && !expired && (
                            <span className="text-[9px] text-rose-400 font-bold uppercase bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">Booked</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Availability Status */}
                {isConflict ? (
                  <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl space-y-2">
                    <p className="text-sm font-bold text-rose-400 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" /> Slot Unavailable
                    </p>
                    {alterns?.otherSlotFree && (
                      <button onClick={() => setHalfSlotId(alterns.otherHalfId)}
                        className="text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors">
                        → Switch to {alterns.otherHalfId} slot
                      </button>
                    )}
                    {alterns?.alternativeHalls?.length > 0 && (
                      <p className="text-[10px] text-slate-400 mt-1">
                        Alternative halls available: {alterns.alternativeHalls.map(h => h.name).join(', ')}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                    <p className="text-sm font-bold text-emerald-400">Slot available — ready to book!</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* ── STEP 2: Event Info Form ── */}
            {step === 2 && (
              <motion.div key="step2"
                initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }}
                className="space-y-4">

                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/[0.06] pb-3">
                  Applicant Details
                </p>

                {/* Name */}
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">
                    Full Name <span className="text-rose-400">*</span>
                  </label>
                  <input type="text" value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/10 focus:border-emerald-500/50 rounded-xl text-white text-sm outline-none transition-colors placeholder:text-slate-600"
                    placeholder="Your full name" />
                </div>

                {/* Roll No */}
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">
                    Roll No. / Faculty ID <span className="text-rose-400">*</span>
                  </label>
                  <input type="text" value={form.rollNo}
                    onChange={e => setForm({ ...form, rollNo: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/10 focus:border-emerald-500/50 rounded-xl text-white text-sm outline-none transition-colors placeholder:text-slate-600"
                    placeholder="e.g. 21CS001" />
                </div>

                {/* Email */}
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">
                    Email ID <span className="text-rose-400">*</span>
                  </label>
                  <input type="email" value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                    className={cn('w-full px-4 py-2.5 bg-white/[0.04] border rounded-xl text-white text-sm outline-none transition-colors placeholder:text-slate-600',
                      form.email.trim().length > 0 && !emailValid ? 'border-rose-500/50' : 'border-white/10 focus:border-emerald-500/50'
                    )}
                    placeholder="you@vnrvjiet.in" />
                  {form.email.trim().length > 0 && !emailValid && (
                    <p className="text-[10px] text-rose-400 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> Only @vnrvjiet.in emails are allowed
                    </p>
                  )}
                </div>

                {/* Phone */}
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">
                    Phone Number <span className="text-rose-400">*</span>
                  </label>
                  <input type="tel" value={form.phone}
                    onChange={e => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setForm({ ...form, phone: val });
                    }}
                    maxLength={10}
                    className={cn('w-full px-4 py-2.5 bg-white/[0.04] border rounded-xl text-white text-sm outline-none transition-colors placeholder:text-slate-600',
                      form.phone.trim().length > 0 && !phoneValid ? 'border-rose-500/50' : 'border-white/10 focus:border-emerald-500/50'
                    )}
                    placeholder="e.g. 9876543210" />
                  {form.phone.trim().length > 0 && !phoneValid && (
                    <p className="text-[10px] text-rose-400 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> Enter a valid 10-digit Indian phone number
                    </p>
                  )}
                </div>

                {/* Purpose */}
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">
                    Purpose of Booking <span className="text-rose-400">*</span>
                  </label>
                  <textarea rows={3} value={form.purpose}
                    onChange={e => setForm({ ...form, purpose: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/10 focus:border-emerald-500/50 rounded-xl text-white text-sm outline-none transition-colors resize-none placeholder:text-slate-600"
                    placeholder="Describe your event... (min 10 characters)" />
                  {form.purpose.length > 0 && form.purpose.length < 10 && (
                    <p className="text-[10px] text-rose-400 mt-1">{10 - form.purpose.length} more character(s) required</p>
                  )}
                </div>

                {/* Participants */}
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">
                    <span className="flex items-center justify-between">
                      <span>No. of Participants <span className="text-rose-400">*</span></span>
                      <span className="text-amber-400 normal-case">Max: {audi.capacity}</span>
                    </span>
                  </label>
                  <input type="number" min="1" max={audi.capacity} value={form.attendance}
                    onChange={e => setForm({ ...form, attendance: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/10 focus:border-emerald-500/50 rounded-xl text-white text-sm outline-none transition-colors placeholder:text-slate-600"
                    placeholder="Expected number of attendees" />
                  {parseInt(form.attendance) > audi.capacity * 0.8 && parseInt(form.attendance) <= audi.capacity && (
                    <p className="text-[10px] text-amber-500 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> Approaching hall capacity (80% threshold)
                    </p>
                  )}
                  {parseInt(form.attendance) > audi.capacity && (
                    <p className="text-[10px] text-rose-400 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> Exceeds hall capacity of {audi.capacity}
                    </p>
                  )}
                </div>

                {/* Slot Confirmation (radio cards) */}
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 border-b border-white/[0.06] pb-2">
                    Confirm Your Slot
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {HALF_SLOTS.map(hs => {
                      const available = BookingEngine.isHalfSlotAvailable(audi.id, date, hs.id, existingBookings);
                      const expired2  = isSlotExpired(date, hs.id);
                      const canSel2   = available && !expired2;
                      const selected  = halfSlotId === hs.id;
                      return (
                        <button key={hs.id}
                          onClick={() => canSel2 && setHalfSlotId(hs.id)}
                          disabled={!canSel2}
                          className={cn(
                            'p-3 rounded-xl border-2 flex items-center gap-2.5 transition-all text-left',
                            selected && available ? 'border-emerald-500 bg-emerald-500/10' :
                            available             ? 'border-white/10 hover:border-white/20 bg-white/[0.03]' :
                                                    'border-white/5 opacity-40 cursor-not-allowed'
                          )}>
                          {hs.id === 'morning'
                            ? <Sun className="w-4 h-4 text-amber-400 shrink-0" />
                            : <Moon className="w-4 h-4 text-indigo-400 shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <p className={cn('text-xs font-bold', selected ? 'text-white' : 'text-slate-400')}>{hs.label}</p>
                            <p className="text-[10px] text-slate-600 truncate">{hs.display}</p>
                          </div>
                          {selected && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── STEP 3: Review & Confirm ── */}
            {step === 3 && (
              <motion.div key="step3"
                initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }}
                className="space-y-5">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/[0.06] pb-3">Review Booking</p>
                <div className="bg-white/[0.04] rounded-2xl border border-white/[0.08] p-5 space-y-3">
                  {[
                    { label: 'Hall',         value: audi.name },
                    { label: 'Date',         value: format(parseISO(date), 'EEE, MMM do yyyy') },
                    { label: 'Slot',         value: `${selectedHalfSlot?.label} · ${selectedHalfSlot?.display}` },
                    { label: 'Requester',    value: `${form.name} (${form.rollNo || 'N/A'})` },
                    { label: 'Department',   value: currentUser.department },
                    { label: 'Participants', value: `${form.attendance} people` },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between items-start gap-4">
                      <span className="text-xs text-slate-500 font-bold shrink-0">{label}</span>
                      <span className="text-xs text-white font-bold text-right">{value}</span>
                    </div>
                  ))}
                  <div className="border-t border-white/[0.06] pt-3">
                    <p className="text-xs text-slate-500 font-bold mb-1">Purpose</p>
                    <p className="text-xs text-slate-300 leading-relaxed">{form.purpose}</p>
                  </div>
                </div>
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  <p className="text-xs font-bold text-emerald-400">All clear. Booking will be confirmed immediately.</p>
                </div>
                <p className="text-[10px] text-slate-600 text-center">
                  A confirmation email will be sent to <span className="text-slate-400">{form.email}</span>
                </p>
              </motion.div>
            )}

            {/* ── STEP 4: Booking Receipt ── */}
            {step === 4 && confirmedBooking && (
              <motion.div key="step4"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-5 relative">

                {/* Confetti */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden flex items-center justify-center" style={{ zIndex: 0 }}>
                  {confettiPieces.map(p => (
                    <motion.div key={p.id}
                      initial={{ x: 0, y: 0, opacity: 1, scale: 1, rotate: 0 }}
                      animate={{ x: p.x, y: p.y, opacity: 0, scale: 0.4, rotate: p.rotate }}
                      transition={{ duration: 0.9, ease: 'easeOut', delay: p.id * 0.04 }}
                      style={{ position: 'absolute', width: p.size, height: p.size, backgroundColor: p.color, borderRadius: 3 }}
                    />
                  ))}
                </div>

                {/* Receipt Card */}
                <div className={cn('rounded-2xl border p-6 relative overflow-hidden', { zIndex: 1 },
                  confirmedBooking.status === 'confirmed'
                    ? 'bg-emerald-500/8 border-emerald-500/25'
                    : 'bg-amber-500/8 border-amber-500/25'
                )} style={{ position: 'relative', zIndex: 1 }}>

                  {/* Status */}
                  <div className="flex items-center gap-2 mb-5">
                    {confirmedBooking.status === 'confirmed'
                      ? <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                      : <Clock className="w-6 h-6 text-amber-400" />}
                    <span className={cn('text-lg font-black',
                      confirmedBooking.status === 'confirmed' ? 'text-emerald-400' : 'text-amber-400'
                    )}>
                      {confirmedBooking.status === 'confirmed' ? 'Booking Confirmed!' : 'Pending Approval'}
                    </span>
                  </div>

                  <h3 className="text-xl font-black text-white mb-0.5">{audi.name}</h3>
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-xs text-slate-400 font-bold">{audi.block}</span>
                    <span className="text-slate-600">·</span>
                    <span className="text-xs text-slate-400 font-bold">{format(parseISO(date), 'MMM d, yyyy')}</span>
                  </div>

                  {/* Slot Highlight */}
                  <div className="bg-white/8 rounded-xl p-3 flex items-center gap-3 mb-5 border border-white/[0.06]">
                    {selectedHalfSlot?.id === 'morning'
                      ? <Sun className="w-5 h-5 text-amber-400 shrink-0" />
                      : <Moon className="w-5 h-5 text-indigo-400 shrink-0" />}
                    <div>
                      <p className="text-sm font-bold text-white">{selectedHalfSlot?.label}</p>
                      <p className="text-xs text-slate-400">{selectedHalfSlot?.display}</p>
                    </div>
                    <span className="ml-auto text-xs text-slate-500 font-bold">{selectedHalfSlot?.duration}</span>
                  </div>

                  {/* Details */}
                  <div className="space-y-2.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Booked by</span>
                      <span className="text-white font-bold">{form.name} <span className="text-slate-500 font-normal">({form.rollNo || 'N/A'})</span></span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Department</span>
                      <span className="text-white font-bold">{currentUser.department}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Participants</span>
                      <span className="text-white font-bold">{form.attendance} people</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 shrink-0">Purpose</span>
                      <span className="text-white font-bold text-right max-w-[55%] line-clamp-2">{form.purpose}</span>
                    </div>
                    <div className="border-t border-white/[0.07] pt-2.5 flex justify-between">
                      <span className="text-slate-400">Booking ID</span>
                      <span className="text-indigo-400 font-mono font-bold text-xs">#{confirmedBooking.id}</span>
                    </div>
                  </div>

                  {/* Email Status */}
                  <div className="mt-4 pt-3 border-t border-white/[0.07] flex items-center gap-2">
                    <Mail className="w-4 h-4 text-slate-500 shrink-0" />
                    <p className="text-xs text-slate-400">
                      {emailResult?.success === true
                        ? `Confirmation sent to ${form.email}`
                        : emailResult?.error 
                            ? `Email Delivery Failed: ${emailResult.error}` 
                            : `Email not configured — booking saved successfully`}
                      {emailResult?.success !== true && !emailResult?.error && <span className="text-slate-600"> (simulated)</span>}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer Buttons */}
        <div className="px-6 py-4 border-t border-white/[0.05] bg-[#06101e] shrink-0 flex gap-3">
          {step === 4 ? (
            <>
              <button onClick={onClose}
                className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-slate-300 font-bold rounded-xl transition-colors text-sm">
                Done
              </button>
              <button onClick={() => { onClose(); setActiveView('My Bookings'); }}
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-colors text-sm flex items-center justify-center gap-2">
                <Receipt className="w-4 h-4" /> View My Bookings
              </button>
            </>
          ) : (
            <>
              {step > 1
                ? <button onClick={() => setStep(p => p - 1)} className="px-5 py-3 font-bold text-slate-400 bg-white/5 hover:bg-white/10 rounded-xl transition-colors text-sm">Back</button>
                : <button onClick={onClose} className="px-5 py-3 font-bold text-slate-500 hover:text-slate-300 transition-colors text-sm">Cancel</button>}

              {step < 3 ? (
                <button
                  disabled={step === 1 ? !canProceedStep1 : !canProceedStep2}
                  onClick={() => setStep(p => p + 1)}
                  className="flex-1 bg-white text-[#06101e] font-extrabold rounded-xl py-3 hover:bg-slate-100 transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed text-sm">
                  Continue
                </button>
              ) : (
                <button onClick={onSubmit} disabled={loading}
                  className="flex-1 bg-emerald-500 text-[#06101e] font-extrabold rounded-xl py-3 hover:bg-emerald-400 transition-all active:scale-95 shadow-[0_0_20px_rgba(16,185,129,0.3)] disabled:opacity-50 flex justify-center items-center gap-2 text-sm">
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</> : 'Confirm Booking'}
                </button>
              )}
            </>
          )}
        </div>
      </motion.div>
    </>
  );
}

// ── MY BOOKINGS VIEW ──
function MyBookingsView() {
  const { currentUser, addToast, setActiveView, refreshTrigger } = useContext(BookingContext);
  const [bks, setBks]           = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState('Upcoming');
  const [confirmId, setConfirmId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const fetchBks = useCallback(() => {
    setLoading(true);
    MockAPI.getBookingsByUser(currentUser.id).then(d => { setBks(d); setLoading(false); });
  }, [currentUser, refreshTrigger]);
  useEffect(() => { fetchBks(); }, [fetchBks]);

  const doCancel = async () => {
    if (!confirmId) return;
    const id = confirmId;
    setConfirmId(null);
    const { success, error } = await MockAPI.cancelBooking(id, currentUser.id);
    if (success) { addToast('Booking cancelled.', 'success'); fetchBks(); }
    else addToast('Cancel failed: ' + error, 'error');
  };

  const filtered = bks.filter(b => {
    if (filter === 'Past')     return new Date(b.date) < new Date(TODAY);
    if (filter === 'Pending')  return b.status === 'pending';
    return new Date(b.date) >= new Date(TODAY);
  });

  return (
    <>
      {/* Cancel Confirm Modal */}
      <AnimatePresence>
        {confirmId && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[200]"
              onClick={() => setConfirmId(null)} />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              className="fixed inset-0 z-[201] flex items-center justify-center p-4">
              <div className="bg-[#0a1325] border border-white/10 rounded-2xl p-8 w-full max-w-sm shadow-2xl">
                <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-6 h-6 text-rose-400" />
                </div>
                <h3 className="text-xl font-bold text-white text-center mb-2">Cancel Booking?</h3>
                <p className="text-sm text-slate-400 text-center mb-6">This will permanently cancel your booking. This cannot be undone.</p>
                <div className="flex gap-3">
                  <button onClick={() => setConfirmId(null)} className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-sm">Keep It</button>
                  <button onClick={doCancel} className="flex-1 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-bold text-sm">Cancel Booking</button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-white">My Bookings</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {currentUser.name}
              {currentUser.rollNo && <> · <span className="text-indigo-400 font-bold">{currentUser.rollNo}</span></>}
              {' · '}{currentUser.department}
            </p>
          </div>
          <button onClick={() => setActiveView('Schedule')}
            className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl transition-all active:scale-95 flex items-center gap-2 text-sm self-start sm:self-auto">
            <CalIcon className="w-4 h-4" /> New Booking
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 border-b border-white/[0.06] pb-4">
          {['Upcoming', 'Past', 'Pending'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn(
                'px-4 py-2 font-bold text-xs uppercase tracking-wider rounded-lg transition-colors border',
                filter === f
                  ? 'bg-white/10 text-emerald-400 border-white/10'
                  : 'bg-transparent text-slate-500 border-transparent hover:bg-white/5'
              )}>{f}</button>
          ))}
        </div>

        {loading ? (
          <div className="grid md:grid-cols-2 gap-4">{[1, 2].map(i => <div key={i} className="h-56 bg-white/5 rounded-2xl animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center space-y-3">
            <Receipt className="w-10 h-10 text-slate-700 mx-auto" />
            <p className="text-slate-600 font-bold">No bookings in this category.</p>
            <button onClick={() => setActiveView('Schedule')} className="text-sm font-bold text-emerald-400 hover:text-emerald-300 transition-colors">
              Book a slot →
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map(b => {
              const audi  = SEED_AUDITORIUMS.find(a => a.id === b.auditoriumId);
              const hSlot = HALF_SLOTS.find(h => h.id === b.halfSlot) || HALF_SLOTS[0];
              const isExp = expandedId === b.id;

              return (
                <GlassCard key={b.id} className="p-5 flex flex-col gap-3">
                  {/* Card Header */}
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold text-white text-sm leading-snug">{audi?.name}</p>
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mt-0.5">{audi?.block}</p>
                    </div>
                    <span className={cn('text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border shrink-0',
                      b.status === 'confirmed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                      b.status === 'pending'   ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                      'bg-white/5 text-slate-500 border-white/10'
                    )}>{b.status}</span>
                  </div>

                  {/* Date */}
                  <p className="text-xs text-indigo-300 font-bold">{format(parseISO(b.date), 'EEE, MMM do yyyy')}</p>

                  {/* Slot Type Pill */}
                  <div className={cn('flex items-center gap-2 px-3 py-2 rounded-lg border',
                    hSlot.id === 'morning' ? 'bg-amber-500/8 border-amber-500/20' : 'bg-indigo-500/8 border-indigo-500/20'
                  )}>
                    {hSlot.id === 'morning'
                      ? <Sun className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      : <Moon className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
                    <span className={cn('text-xs font-bold', hSlot.id === 'morning' ? 'text-amber-300' : 'text-indigo-300')}>
                      {hSlot.label}
                    </span>
                    <span className="text-[10px] text-slate-500 ml-auto">{hSlot.display}</span>
                  </div>

                  {/* Purpose snippet */}
                  <p className="text-xs text-slate-400 line-clamp-2 flex-1">{b.purpose}</p>

                  {/* User info: avatar + name + roll */}
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-indigo-600/30 border border-indigo-500/20 flex items-center justify-center text-[10px] font-bold text-indigo-300">
                      {(b.requester_name || currentUser.name).substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">{b.requester_name || currentUser.name}</p>
                      {b.roll_no && <p className="text-[10px] text-slate-500">{b.roll_no}</p>}
                    </div>
                  </div>

                  {/* Expandable Receipt */}
                  <button onClick={() => setExpandedId(isExp ? null : b.id)}
                    className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors w-fit">
                    <Receipt className="w-3 h-3" /> {isExp ? 'Hide' : 'Show'} Receipt
                  </button>

                  <AnimatePresence>
                    {isExp && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden">
                        <div className="bg-white/[0.03] rounded-xl p-3 text-xs space-y-2 border border-white/[0.06]">
                          <div className="flex justify-between">
                            <span className="text-slate-500">Booking ID</span>
                            <span className="text-indigo-400 font-mono"># {b.id}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Participants</span>
                            <span className="text-white font-bold">{b.attendance} people</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Department</span>
                            <span className="text-white font-bold">{b.department || currentUser.department}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Booked on</span>
                            <span className="text-white font-bold">{b.createdAt}</span>
                          </div>
                          {b.roll_no && (
                            <div className="flex justify-between">
                              <span className="text-slate-500">Roll No.</span>
                              <span className="text-white font-bold">{b.roll_no}</span>
                            </div>
                          )}
                          <div className="flex justify-between border-t border-white/[0.06] pt-2">
                            <span className="text-slate-500">Hall</span>
                            <span className="text-white font-bold">{audi?.name}</span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Cancel Button */}
                  {(filter === 'Upcoming' || filter === 'Pending') && (
                    <button onClick={() => setConfirmId(b.id)}
                      className="w-full py-2.5 rounded-xl border border-rose-500/25 text-rose-400 hover:bg-rose-500/10 text-xs font-bold uppercase tracking-widest transition-colors mt-auto">
                      Cancel Booking
                    </button>
                  )}
                </GlassCard>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

// ── ADMIN PANEL ──
function AdminPanel() {
  const { currentUser, setCurrentUser, addToast, refreshTrigger } = useContext(BookingContext);
  const [bks, setBks]         = useState([]);
  const [loading, setLoading] = useState(true);


  const fetchGrid = useCallback(() => {
    setLoading(true);
    Promise.all([MockAPI.getBookings(TODAY), MockAPI.getAllBookings()]).then(([today, all]) => {
      setBks(today);
      setLoading(false);
    });
  }, [refreshTrigger]);
  useEffect(() => { fetchGrid(); }, [fetchGrid]);

  const handleApprove = async (id) => {
    const { success } = await MockAPI.approveBooking(id, currentUser.id);
    if (success) { addToast('Booking approved!', 'success'); fetchGrid(); }
  };

  const pends = bks.filter(b => b.status === 'pending');

  // Count by auditorium
  const auditCounts = SEED_AUDITORIUMS.map(a => ({
    ...a,
    count: bks.filter(b => b.auditoriumId === a.id).length,
  }));
  const maxCount = Math.max(...auditCounts.map(a => a.count), 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div>
          <h2 className="text-2xl font-black text-white">Admin Panel</h2>
          <p className="text-sm text-slate-500 mt-0.5 uppercase tracking-widest font-bold">Global Analytics & Authorization Queue</p>
        </div>
        <div className="p-4 bg-white/[0.04] rounded-2xl border border-white/[0.08] w-full sm:w-auto">
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-3">Demo: Switch User</p>
          <div className="flex flex-wrap gap-2">
            {SEED_USERS.map(u => (
              <button key={u.id}
                onClick={() => { setCurrentUser(u); localStorage.setItem('audisync_session', JSON.stringify(u)); }}
                className={cn(
                  'px-3 py-1.5 rounded-lg bg-slate-900 border text-xs font-bold uppercase tracking-wider transition-all',
                  currentUser.id === u.id ? 'border-emerald-500 text-emerald-400' : 'border-white/10 text-slate-500 hover:text-white'
                )}>
                {u.role}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Hall Usage Chart */}
        <GlassCard className="lg:col-span-2 p-6 flex flex-col" style={{ minHeight: 340 }}>
          <h3 className="font-bold text-white text-xs uppercase tracking-widest border-b border-white/[0.06] pb-4 mb-5">Daily Auditorium Load</h3>
          <div className="flex-1 flex items-end gap-1.5 overflow-x-auto pb-2">
            {loading ? <div className="w-full h-full bg-white/5 animate-pulse rounded-xl" /> :
              auditCounts.map(a => {
                const h = Math.max((a.count / maxCount) * 100, 4);
                return (
                  <div key={a.id} className="flex-1 flex flex-col justify-end items-center group relative min-w-[28px]">
                    <div className="absolute -top-1 opacity-0 group-hover:opacity-100 -translate-y-full bg-slate-800 text-white text-[10px] font-bold px-2 py-1 rounded whitespace-nowrap z-10 transition-opacity border border-white/10">
                      {a.count} booking{a.count !== 1 ? 's' : ''}
                    </div>
                    <div
                      style={{ height: `${h}%` }}
                      className="w-full bg-indigo-500/25 hover:bg-indigo-500/50 border-t-2 border-indigo-500 rounded-t transition-all duration-500 cursor-default"
                    />
                    <p className="text-[8px] font-bold text-slate-600 truncate w-full text-center mt-2 uppercase">{a.id}</p>
                  </div>
                );
              })
            }
          </div>
        </GlassCard>

        {/* Pending Queue */}
        <GlassCard className="p-6 flex flex-col" style={{ minHeight: 340 }}>
          <h3 className="font-bold text-amber-400 text-xs uppercase tracking-widest border-b border-white/[0.06] pb-4 mb-5 flex items-center justify-between">
            Pending Queue
            <span className="text-white bg-amber-500/20 px-2 py-0.5 rounded font-bold">{pends.length}</span>
          </h3>
          <div className="flex-1 overflow-y-auto space-y-3">
            {loading ? (
              <div className="space-y-3">{[1, 2].map(i => <div key={i} className="h-20 bg-white/5 rounded-xl animate-pulse" />)}</div>
            ) : pends.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-600">
                <CheckCircle2 className="w-8 h-8 opacity-30" />
                <p className="font-bold text-sm">Queue empty</p>
              </div>
            ) : (
              pends.map(p => (
                <div key={p.id} className="p-4 bg-white/[0.04] border border-white/[0.06] rounded-xl space-y-3">
                  <div>
                    <p className="text-xs font-bold text-white truncate">{p.purpose}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{SEED_AUDITORIUMS.find(a => a.id === p.auditoriumId)?.name}</p>
                    {p.roll_no && <p className="text-[10px] text-slate-500">Roll: {p.roll_no}</p>}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => MockAPI.cancelBooking(p.id, currentUser.id).then(fetchGrid)}
                      className="flex-1 py-1.5 border border-rose-500/20 text-rose-400 hover:bg-rose-500/10 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors">
                      Deny
                    </button>
                    <button onClick={() => handleApprove(p.id)}
                      className="flex-1 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors">
                      Approve
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

// ── LOGIN VIEW ──
function LoginView({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [form, setForm]       = useState({ name: '', rollNo: '', email: '', department: '' });
  const [loading, setLoading] = useState(false);

  const loginEmailValid = isValidInstitutionalEmail(form.email.trim());

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email) return;
    if (!loginEmailValid) return;
    setLoading(true);

    // Simulate a tiny delay
    await new Promise(r => setTimeout(r, 400));

    const stableId = 'u-' + btoa(form.email.toLowerCase()).replace(/[^a-z0-9]/gi, '').substring(0, 12);

    let userObj;
    if (isLogin) {
      const seedUser = SEED_USERS.find(u => u.email.toLowerCase() === form.email.toLowerCase());
      if (seedUser) {
        userObj = seedUser;
      } else {
        const saved = (() => {
          try { return JSON.parse(localStorage.getItem('audisync_profile_' + stableId)); } catch { return null; }
        })();
        userObj = saved || {
          id: stableId,
          name: form.email.split('@')[0],
          email: form.email,
          rollNo: '',
          role: 'club_lead',
          department: 'General',
          avatar: form.email.substring(0, 2).toUpperCase(),
        };
      }
    } else {
      userObj = {
        id: stableId,
        name: form.name || form.email.split('@')[0],
        email: form.email,
        rollNo: form.rollNo || '',
        role: 'club_lead',
        department: form.department || 'General',
        avatar: (form.name || form.email).substring(0, 2).toUpperCase(),
      };
      localStorage.setItem('audisync_profile_' + stableId, JSON.stringify(userObj));
    }
    setLoading(false);
    onLogin(userObj);
  };

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-slate-950 via-[#0a1628] to-[#0d1432]">
      {/* Left side — branding panel (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 bg-gradient-to-br from-[#060e1d] to-[#0a1a2e] border-r border-white/[0.05]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#8B1A1A] to-[#c0392b] flex items-center justify-center shadow-[0_0_20px_rgba(180,30,30,0.35)]">
            <span className="text-white font-black text-xs">VNR</span>
          </div>
          <div>
            <p className="text-sm font-black text-white">AudiSync</p>
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">VNR VJIET</p>
          </div>
        </div>

        <div>
          <div className="mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-600/20 to-emerald-800/10 border border-emerald-500/20 flex items-center justify-center mb-6">
              <Building2 className="w-8 h-8 text-emerald-400" />
            </div>
            <h1 className="text-4xl font-black text-white leading-tight mb-4">
              Campus Auditorium<br />
              <span className="text-emerald-400">Booking System</span>
            </h1>
            <p className="text-slate-400 leading-relaxed">
              Streamline venue bookings across all halls and seminar rooms at VNR Vignana Jyothi Institute of Engineering & Technology.
            </p>
          </div>

          <div className="space-y-3">
            {[
              { icon: CalIcon,       text: 'Book morning or afternoon slots instantly' },
              { icon: CheckCircle2,  text: 'Real-time availability with conflict detection' },
              { icon: Mail,          text: 'Automated email confirmations' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                  <Icon className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <p className="text-sm text-slate-400">{text}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-slate-700">
          © {new Date().getFullYear()} VNR Vignana Jyothi Institute of Engineering & Technology
        </p>
      </div>

      {/* Right side — auth form */}
      <div className="flex-1 flex items-center justify-center py-12 px-6">
        <div className="w-full max-w-md">
          {/* Mobile header */}
          <div className="lg:hidden text-center mb-8">
            <div className="w-16 h-16 mx-auto bg-gradient-to-br from-[#8B1A1A] to-[#c0392b] rounded-2xl flex flex-col items-center justify-center shadow-[0_0_30px_rgba(180,30,30,0.35)] mb-4">
              <span className="text-white font-black text-xl leading-none">VNR</span>
              <span className="text-red-200/60 font-bold text-[8px] tracking-widest">VJIET</span>
            </div>
            <h1 className="text-2xl font-black text-white">AudiSync</h1>
            <p className="text-xs text-slate-500 mt-1">VNR Vignana Jyothi Institute of Engineering & Technology</p>
          </div>

          <div className="bg-white/[0.04] backdrop-blur-md border border-white/[0.09] rounded-2xl p-8 relative overflow-hidden">
            <div className="absolute -right-12 -top-12 w-40 h-40 bg-emerald-500/5 blur-3xl rounded-full pointer-events-none" />
            <div className="absolute -left-12 -bottom-12 w-40 h-40 bg-indigo-500/5 blur-3xl rounded-full pointer-events-none" />

            <div className="relative z-10">
              <h2 className="text-xl font-black text-white mb-1">{isLogin ? 'Sign In' : 'Create Account'}</h2>
              <p className="text-sm text-slate-500 mb-6">
                {isLogin
                  ? 'Use your institutional email to access AudiSync'
                  : 'Register with your institutional details'}
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                {!isLogin && (
                  <>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Full Name</label>
                      <input required type="text" value={form.name}
                        onChange={e => setForm({ ...form, name: e.target.value })}
                        placeholder="Your full name"
                        className="w-full px-4 py-2.5 bg-slate-900/60 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-emerald-500/50 transition-colors placeholder:text-slate-600" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Roll No. / Faculty ID</label>
                      <input type="text" value={form.rollNo}
                        onChange={e => setForm({ ...form, rollNo: e.target.value })}
                        placeholder="e.g. 21CS001"
                        className="w-full px-4 py-2.5 bg-slate-900/60 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-emerald-500/50 transition-colors placeholder:text-slate-600" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Department / Club</label>
                      <input required type="text" value={form.department}
                        onChange={e => setForm({ ...form, department: e.target.value })}
                        placeholder="e.g. Computer Science"
                        className="w-full px-4 py-2.5 bg-slate-900/60 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-emerald-500/50 transition-colors placeholder:text-slate-600" />
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Institutional Email</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input required type="email" value={form.email}
                      onChange={e => setForm({ ...form, email: e.target.value })}
                      placeholder="you@vnrvjiet.in"
                      className={cn('w-full pl-10 pr-4 py-2.5 bg-slate-900/60 border rounded-xl text-white text-sm outline-none transition-colors placeholder:text-slate-600',
                        form.email.trim().length > 0 && !loginEmailValid ? 'border-rose-500/50' : 'border-white/10 focus:border-emerald-500/50'
                      )} />
                    {form.email.trim().length > 0 && !loginEmailValid && (
                      <p className="text-[10px] text-rose-400 mt-1.5 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Only @vnrvjiet.in email addresses are allowed
                      </p>
                    )}
                  </div>
                </div>

                <button type="submit" disabled={loading || !loginEmailValid}
                  className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-[#060e1d] font-extrabold rounded-xl transition-all active:scale-95 shadow-[0_0_20px_rgba(16,185,129,0.25)] flex items-center justify-center gap-2">
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</> : (isLogin ? 'Sign In' : 'Create Account')}
                </button>
              </form>




              <button type="button" onClick={() => { setIsLogin(!isLogin); setForm({ name: '', rollNo: '', email: '', department: '' }); }}
                className="w-full mt-4 text-xs font-bold text-slate-400 hover:text-white transition-colors">
                {isLogin ? "Don't have an account? Register" : 'Already have an account? Sign In'}
              </button>
            </div>
          </div>

          <p className="text-center text-[10px] text-slate-700 mt-4">
            © {new Date().getFullYear()} VNR Vignana Jyothi Institute of Engineering & Technology
          </p>
        </div>
      </div>
    </div>
  );
}
