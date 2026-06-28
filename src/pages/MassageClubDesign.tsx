import React, { useState, useEffect } from "react";
import { 
  Sparkles, 
  Search, 
  MapPin, 
  Star, 
  ChevronRight, 
  ArrowLeft, 
  Share2, 
  Heart, 
  Clock, 
  Calendar, 
  Check, 
  CheckCircle2, 
  Plus, 
  SlidersHorizontal, 
  ChevronDown, 
  User, 
  Phone, 
  Mail, 
  FileText, 
  ShieldCheck, 
  Bell, 
  MessageSquare, 
  PhoneCall, 
  Compass, 
  BookOpen, 
  PlusCircle,
  HelpCircle,
  ExternalLink,
  Info
} from "lucide-react";

// Types
interface Studio {
  id: string;
  name: string;
  district: string;
  rating: number;
  reviewsCount: number;
  image: string;
  description: string;
  locationAddress: string;
  tags: string[];
  services: {
    name: string;
    duration: number;
    price: number;
    description: string;
  }[];
}

interface Booking {
  id: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  studioName: string;
  studioId: string;
  serviceName: string;
  duration: number;
  price: number;
  date: string;
  time: string;
  status: "pending" | "confirmed" | "declined";
  reference: string;
  pressure: string;
  focusAreas: string[];
  enhancements: string[];
  notes: string;
}

const STUDIOS_DATA: Studio[] = [
  {
    id: "oasis-therapy",
    name: "Oasis Therapy",
    district: "Salamanca District",
    rating: 4.9,
    reviewsCount: 128,
    image: "https://images.unsplash.com/photo-1600334089648-b0d9d3028eb2?auto=format&fit=crop&q=80&w=800",
    description: "A sanctuary in the heart of the city offering bespoke therapeutic massages. Our holistic approach combines traditional techniques with modern anatomical knowledge to release deep-seated tension and restore balance.",
    locationAddress: "Calle de Velázquez, 45, 28001 Madrid, Spain",
    tags: ["Deep Tissue", "Sports", "Anti-stress", "Reflexology"],
    services: [
      {
        name: "Signature Deep Tissue",
        duration: 60,
        price: 85,
        description: "Intensive pressure to relieve chronic tension and melt away stubborn knots."
      },
      {
        name: "Sports Recovery",
        duration: 90,
        price: 110,
        description: "Targeted therapy optimized for athletic performance, flexibility and faster recovery."
      },
      {
        name: "Anti-Stress Calm",
        duration: 60,
        price: 75,
        description: "A gentle rhythmic touch utilizing lavender essential oils to quiet the mind."
      }
    ]
  },
  {
    id: "the-fix-room",
    name: "The Fix Room",
    district: "Chamberí, Madrid",
    rating: 4.9,
    reviewsCount: 94,
    image: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&q=80&w=800",
    description: "Highly focused therapeutic sessions in Chamberí designed to 'fix' chronic muscle pain and posture alignment issues. Our experienced therapists tailor each movement precisely to your anatomy.",
    locationAddress: "Calle de Almagro, 12, 28010 Madrid, Spain",
    tags: ["Therapeutic", "Deep Tissue", "Trigger Point"],
    services: [
      {
        name: "Deep Tissue & Release",
        duration: 60,
        price: 50,
        description: "Intense structural work focusing on lower back, neck, and shoulder alignment."
      },
      {
        name: "Myofascial Trigger Point",
        duration: 75,
        price: 65,
        description: "Focused release of hypersensitive bands in the muscle tissue to alleviate referred pain."
      }
    ]
  },
  {
    id: "golden-touch",
    name: "Golden Touch",
    district: "Salamanca, Madrid",
    rating: 4.8,
    reviewsCount: 112,
    image: "https://images.unsplash.com/photo-1519699047748-de8e457a634e?auto=format&fit=crop&q=80&w=800",
    description: "Indulge in absolute luxury and premium recovery. Golden Touch blends classic Swedish relaxation with advanced therapy in an incredibly calm, candle-lit setting.",
    locationAddress: "Calle de Serrano, 88, 28006 Madrid, Spain",
    tags: ["Swedish", "Hot Stone", "Aromatherapy"],
    services: [
      {
        name: "Premium Swedish Massage",
        duration: 90,
        price: 75,
        description: "Long gliding strokes combined with organic warm almond oil for systemic relaxation."
      },
      {
        name: "Aromatic Golden Bliss",
        duration: 60,
        price: 65,
        description: "An elegant, sensory journey utilizing warm stones and custom herbal infusions."
      }
    ]
  },
  {
    id: "casa-wellness",
    name: "Casa Wellness",
    district: "Malasaña, Madrid",
    rating: 4.7,
    reviewsCount: 76,
    image: "https://images.unsplash.com/photo-1512290923902-8a9f81dc236c?auto=format&fit=crop&q=80&w=800",
    description: "A bright, airy, modern space in bohemian Malasaña. Minimalist decor with earthy terracotta accents provides a casual yet highly professional atmosphere for wellness recovery.",
    locationAddress: "Calle del Pez, 21, 28004 Madrid, Spain",
    tags: ["Sports Recovery", "Calm", "Express Therapy"],
    services: [
      {
        name: "Boho Express Recovery",
        duration: 45,
        price: 40,
        description: "An efficient, high-impact session focusing strictly on your primary area of tension."
      },
      {
        name: "Full Body Reset",
        duration: 75,
        price: 60,
        description: "Re-energise your entire system with our signature fluid-motion muscle reset."
      }
    ]
  }
];

const INITIAL_BOOKINGS: Booking[] = [
  {
    id: "b1",
    clientName: "Sarah Jenkins",
    clientEmail: "sarah.j@example.com",
    clientPhone: "+34 612 987 654",
    studioName: "Oasis Studio",
    studioId: "oasis-therapy",
    serviceName: "Deep Tissue Massage",
    duration: 60,
    price: 85,
    date: "Thursday, Oct 29",
    time: "2:00 PM",
    status: "pending",
    reference: "Ref: MR-2026-0039",
    pressure: "Firm",
    focusAreas: ["Shoulders", "Neck"],
    enhancements: ["Aromatherapy"],
    notes: "Tension in neck due to long computer hours."
  },
  {
    id: "b2",
    clientName: "Michael Chen",
    clientEmail: "m.chen@example.com",
    clientPhone: "+34 699 112 233",
    studioName: "Oasis Studio",
    studioId: "oasis-therapy",
    serviceName: "Swedish Relaxation",
    duration: 90,
    price: 90,
    date: "Friday, Oct 30",
    time: "10:00 AM",
    status: "pending",
    reference: "Ref: MR-2026-0040",
    pressure: "Medium",
    focusAreas: ["Lower Back"],
    enhancements: [],
    notes: "No hard pressure please."
  },
  {
    id: "b3",
    clientName: "Elena Rodriguez",
    clientEmail: "elena.rod@example.com",
    clientPhone: "+34 600 555 777",
    studioName: "Oasis Studio",
    studioId: "oasis-therapy",
    serviceName: "Sports Massage",
    duration: 60,
    price: 80,
    date: "Today",
    time: "10:00 AM",
    status: "confirmed",
    reference: "Ref: MR-2026-0036",
    pressure: "Deep",
    focusAreas: ["Legs", "Lower Back"],
    enhancements: ["Hot Stones"],
    notes: "Prefers very strong pressure."
  },
  {
    id: "b4",
    clientName: "David Kim",
    clientEmail: "david.kim@example.com",
    clientPhone: "+34 655 443 221",
    studioName: "Oasis Studio",
    studioId: "oasis-therapy",
    serviceName: "Aromatherapy",
    duration: 90,
    price: 95,
    date: "Today",
    time: "1:00 PM",
    status: "confirmed",
    reference: "Ref: MR-2026-0037",
    pressure: "Light",
    focusAreas: ["Feet", "Shoulders"],
    enhancements: ["Aromatherapy"],
    notes: "Relaxation-focused treatment."
  },
  {
    id: "b5",
    clientName: "Jessica Taylor",
    clientEmail: "jess.t@example.com",
    clientPhone: "+34 688 776 655",
    studioName: "Oasis Studio",
    studioId: "oasis-therapy",
    serviceName: "Pregnancy Massage",
    duration: 60,
    price: 85,
    date: "Today",
    time: "4:00 PM",
    status: "confirmed",
    reference: "Ref: MR-2026-0038",
    pressure: "Light",
    focusAreas: ["Lower Back", "Feet"],
    enhancements: [],
    notes: "Currently 24 weeks pregnant, looking for relief in lower back."
  }
];

export default function App() {
  // Navigation & Core States
  const [currentScreen, setCurrentScreen] = useState<string>("landing");
  const [selectedStudio, setSelectedStudio] = useState<Studio>(STUDIOS_DATA[0]);
  const [favorites, setFavorites] = useState<string[]>(["oasis-therapy"]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"massages" | "discovery" | "bookings" | "profile">("massages");
  const [userRole, setUserRole] = useState<"customer" | "studio_owner">("customer");

  // Booking Flow Setup
  const [bookingService, setBookingService] = useState<{ name: string; price: number; duration: number } | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("Wed 16");
  const [selectedTime, setSelectedTime] = useState<string>("09:30");
  const [pressure, setPressure] = useState<string>("Medium");
  const [focusAreas, setFocusAreas] = useState<string[]>(["Shoulders", "Upper Back"]);
  const [enhancements, setEnhancements] = useState<string[]>([]);
  const [notes, setNotes] = useState<string>("");
  const [clientName, setClientName] = useState<string>("Elena Garcia");
  const [clientEmail, setClientEmail] = useState<string>("elena.g@example.com");
  const [clientPhone, setClientPhone] = useState<string>("+34 600 123 456");
  
  // Persistence state
  const [bookings, setBookings] = useState<Booking[]>(() => {
    const saved = localStorage.getItem("massage_club_bookings");
    return saved ? JSON.parse(saved) : INITIAL_BOOKINGS;
  });

  const [lastSubmittedBooking, setLastSubmittedBooking] = useState<Booking | null>(null);

  useEffect(() => {
    localStorage.setItem("massage_club_bookings", JSON.stringify(bookings));
  }, [bookings]);

  // Toggle Favorite Studio
  const toggleFavorite = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (favorites.includes(id)) {
      setFavorites(favorites.filter(favId => favId !== id));
    } else {
      setFavorites([...favorites, id]);
    }
  };

  // Switch Role Utility
  const handleRoleToggle = () => {
    if (userRole === "customer") {
      setUserRole("studio_owner");
      setCurrentScreen("owner_dashboard");
    } else {
      setUserRole("customer");
      setCurrentScreen("landing");
    }
  };

  // Start Booking Flow
  const startBooking = (studio: Studio, service: { name: string; price: number; duration: number }) => {
    setSelectedStudio(studio);
    setBookingService(service);
    // Preset details for nice demonstration
    setPressure("Medium");
    setFocusAreas(["Shoulders", "Upper Back"]);
    setEnhancements([]);
    setNotes("");
    setCurrentScreen("select_time");
  };

  // Handle Booking Request submission
  const submitBookingRequest = () => {
    if (!bookingService) return;
    
    // Calculate total price based on service + enhancements (+10 for Aromatherapy, +20 for Hot Stones)
    let totalPrice = bookingService.price;
    if (enhancements.includes("Aromatherapy")) totalPrice += 10;
    if (enhancements.includes("Hot Stones")) totalPrice += 20;

    const refNum = Math.floor(1000 + Math.random() * 9000);
    const newBooking: Booking = {
      id: "b_" + Date.now(),
      clientName,
      clientEmail,
      clientPhone,
      studioName: selectedStudio.name,
      studioId: selectedStudio.id,
      serviceName: bookingService.name,
      duration: bookingService.duration,
      price: totalPrice,
      date: `Thursday, Oct 24`, // Match review UI
      time: selectedTime,
      status: "pending",
      reference: `Ref: MR-2026-0${refNum}`,
      pressure,
      focusAreas,
      enhancements,
      notes
    };

    setBookings([newBooking, ...bookings]);
    setLastSubmittedBooking(newBooking);
    setCurrentScreen("success");
  };

  // Partner dashboard actions
  const updateBookingStatus = (id: string, newStatus: "confirmed" | "declined") => {
    setBookings(bookings.map(b => b.id === id ? { ...b, status: newStatus } : b));
  };

  // Quick navigation helpers
  const navigateToTab = (tab: "massages" | "discovery" | "bookings" | "profile") => {
    setActiveTab(tab);
    if (tab === "massages") {
      setCurrentScreen("studios_list");
    } else if (tab === "bookings") {
      setCurrentScreen("bookings_list");
    } else if (tab === "profile") {
      setCurrentScreen("profile_view");
    } else if (tab === "discovery") {
      setCurrentScreen("studios_list"); // Discovery also shows map and filters
    }
  };

  // Search filter
  const filteredStudios = STUDIOS_DATA.filter(studio => {
    const term = searchQuery.toLowerCase();
    return (
      studio.name.toLowerCase().includes(term) ||
      studio.district.toLowerCase().includes(term) ||
      studio.tags.some(tag => tag.toLowerCase().includes(term))
    );
  });

  return (
    <div className="min-h-screen bg-[#F7F4F0] text-[#211C1A] font-sans antialiased flex flex-col items-center py-4 px-2 sm:px-4">
      {/* Top utility switcher to switch roles & test full features easily */}
      <div className="w-full max-w-md bg-[#FFFFFF] border border-[rgba(33,28,26,0.08)] rounded-2xl p-3 mb-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#C4622D] animate-pulse"></span>
          <span className="text-xs font-semibold uppercase tracking-wider text-[#7A7068]">
            Preview Sandbox
          </span>
        </div>
        <button 
          onClick={handleRoleToggle}
          className="text-xs font-medium text-[#C4622D] bg-[#C4622D]/10 hover:bg-[#C4622D]/20 px-3.5 py-1.5 rounded-full transition-all flex items-center gap-1.5 cursor-pointer"
        >
          {userRole === "customer" ? "Switch to Partner Dashboard ➔" : "➔ Switch to Customer App"}
        </button>
      </div>

      {/* Main Container - Beautiful Mobile Mockup on Desktop */}
      <div className="w-full max-w-md bg-[#FFFFFF] rounded-[40px] shadow-[0_12px_40px_rgba(158,77,34,0.08)] border border-[rgba(33,28,26,0.06)] min-h-[812px] flex flex-col overflow-hidden relative">
        
        {/* ======================================= */}
        {/* 1. LANDING SCREEN                       */}
        {/* ======================================= */}
        {currentScreen === "landing" && (
          <div className="flex-1 flex flex-col bg-[#F7F4F0] overflow-y-auto pb-8 no-scrollbar">
            <header className="flex justify-between items-center w-full px-6 py-5 z-10 relative">
              <div className="flex items-center gap-2 text-[#C4622D]">
                <span className="material-symbols-outlined font-semibold text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>spa</span>
                <span className="font-serif text-2xl font-semibold tracking-tight text-[#211C1A]">Massage Club</span>
              </div>
            </header>

            <main className="flex-1 flex flex-col px-6 pt-4">
              <div className="flex flex-col gap-4 mb-8">
                <h1 className="font-serif text-[38px] leading-[44px] text-[#211C1A] font-bold">
                  Madrid's best massages, booked in seconds.
                </h1>
                <p className="text-base text-[#7A7068] leading-relaxed">
                  Browse top-rated studios near you. No account needed to look around — you pay at the studio.
                </p>

                {/* Trust Row */}
                <div className="flex items-center gap-3 mt-1.5">
                  <div className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[#E0A458] text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                    <span className="font-semibold text-sm text-[#211C1A]">4.8</span>
                  </div>
                  <div className="w-1 h-1 rounded-full bg-[#7A7068]/30"></div>
                  <div className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[#7A7068] text-[18px]">location_on</span>
                    <span className="text-sm text-[#7A7068]">12+ studios · Madrid</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-3 w-full mb-8">
                <button 
                  onClick={() => {
                    setCurrentScreen("studios_list");
                    setActiveTab("massages");
                  }}
                  className="w-full h-13 bg-[#C4622D] text-white rounded-full font-semibold text-[15px] flex items-center justify-center transition-all duration-200 active:scale-98 shadow-[0_4px_14px_rgba(196,98,45,0.25)] hover:bg-[#9E4D22] cursor-pointer"
                >
                  Browse studios — no account needed
                </button>
                <button 
                  onClick={() => {
                    setCurrentScreen("studios_list");
                    setActiveTab("massages");
                  }}
                  className="w-full h-13 border border-[rgba(33,28,26,0.18)] text-[#211C1A] rounded-full font-semibold text-[15px] flex items-center justify-center gap-2.5 transition-all duration-200 active:scale-98 bg-[#FFFFFF]/60 backdrop-blur-sm hover:bg-[#FFFFFF] cursor-pointer"
                >
                  {/* SVG Google Icon */}
                  <svg fill="none" height="18" viewBox="0 0 18 18" width="18" xmlns="http://www.w3.org/2000/svg">
                    <path d="M17.64 9.20455C17.64 8.56636 17.5827 7.95273 17.4764 7.36364H9V10.845H13.8436C13.635 11.97 13.0009 12.9232 12.0477 13.5614V15.8195H14.9564C16.6582 14.2527 17.64 11.9455 17.64 9.20455Z" fill="#4285F4"></path>
                    <path d="M9 18C11.43 18 13.4673 17.1941 14.9564 15.8195L12.0477 13.5614C11.2418 14.1014 10.2109 14.4205 9 14.4205C6.65591 14.4205 4.67182 12.8373 3.96409 10.71H0.957275V13.0418C2.43818 15.9832 5.48182 18 9 18Z" fill="#34A853"></path>
                    <path d="M3.96409 10.71C3.78409 10.17 3.68182 9.59318 3.68182 9C3.68182 8.40682 3.78409 7.83 3.96409 7.29H0.957275V4.95818C0.347727 6.17318 0 7.54773 0 9C0 10.4523 0.347727 11.8268 0.957275 13.0418L3.96409 10.71Z" fill="#FBBC05"></path>
                    <path d="M9 3.57955C10.3214 3.57955 11.5077 4.03364 12.4405 4.92545L15.0218 2.34409C13.4632 0.891818 11.4259 0 9 0C5.48182 0 2.43818 2.01682 0.957275 4.95818L3.96409 7.29C4.67182 5.16273 6.65591 3.57955 9 3.57955Z" fill="#EA4335"></path>
                  </svg>
                  Continue with Google
                </button>
              </div>

              {/* Atmospheric Image with Organic styling */}
              <div className="w-full h-48 mb-8 relative rounded-[32px] overflow-hidden shadow-[0_8px_24px_rgba(158,77,34,0.12)]">
                <img 
                  className="w-full h-full object-cover" 
                  alt="A serene, light-filled minimalist massage studio interior in Madrid" 
                  src="https://images.unsplash.com/photo-1600334188185-1146614d94c8?auto=format&fit=crop&q=80&w=800"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
              </div>

              {/* How it works */}
              <div className="flex flex-col gap-6 mb-8 bg-[#FFFFFF] p-6 rounded-3xl border border-[rgba(33,28,26,0.06)] shadow-sm">
                <h2 className="font-serif text-xl font-bold text-[#211C1A]">How it works</h2>
                
                <div className="flex gap-4 items-start">
                  <div className="w-10 h-10 rounded-full bg-[#C4622D]/10 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[#C4622D] text-[20px]">search</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-semibold text-sm text-[#211C1A]">Find your studio</span>
                    <span className="text-xs text-[#7A7068] mt-0.5">Browse curated, top-rated massage studios nearby.</span>
                  </div>
                </div>

                <div className="flex gap-4 items-start">
                  <div className="w-10 h-10 rounded-full bg-[#C4622D]/10 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[#C4622D] text-[20px]">calendar_month</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-semibold text-sm text-[#211C1A]">Book instantly</span>
                    <span className="text-xs text-[#7A7068] mt-0.5">Choose a time and confirm your spot in seconds.</span>
                  </div>
                </div>

                <div className="flex gap-4 items-start">
                  <div className="w-10 h-10 rounded-full bg-[#C4622D]/10 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[#C4622D] text-[20px]">payments</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-semibold text-sm text-[#211C1A]">Pay at the studio</span>
                    <span className="text-xs text-[#7A7068] mt-0.5">No upfront costs. Settle up securely after your massage.</span>
                  </div>
                </div>
              </div>

              {/* Studio Onboarding Section */}
              <div className="flex flex-col items-center justify-center gap-4 py-8 border-t border-[rgba(33,28,26,0.08)]">
                <button 
                  onClick={() => {
                    setUserRole("studio_owner");
                    setCurrentScreen("owner_dashboard");
                  }}
                  className="text-sm font-semibold text-[#C4622D] underline underline-offset-4 decoration-[#C4622D]/30 hover:decoration-[#C4622D] cursor-pointer"
                >
                  Run a massage studio? List yours free
                </button>
                <button 
                  onClick={() => {
                    setUserRole("studio_owner");
                    setCurrentScreen("owner_dashboard");
                  }}
                  className="text-xs text-[#7A7068] hover:text-[#211C1A]"
                >
                  Studio owner login
                </button>
              </div>
            </main>
          </div>
        )}

        {/* ======================================= */}
        {/* 2. STUDIOS LIST (DISCOVERY) SCREEN      */}
        {/* ======================================= */}
        {currentScreen === "studios_list" && (
          <div className="flex-1 flex flex-col bg-[#F7F4F0] overflow-hidden">
            {/* Top Bar for Map Mode Search */}
            <div className="px-5 pt-5 pb-3 bg-[#F7F4F0] z-20 flex flex-col gap-3 shrink-0">
              <div className="bg-[#FFFFFF] rounded-full shadow-[0_4px_12px_rgba(122,112,104,0.05)] flex items-center px-4 py-2.5 border border-[rgba(33,28,26,0.06)] focus-within:border-[#C4622D] transition-colors">
                <span className="material-symbols-outlined text-[#7A7068] mr-2.5 text-[22px]">search</span>
                <input 
                  type="text" 
                  placeholder="Search studios or area..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent border-none focus:ring-0 w-full p-0 text-sm text-[#211C1A] placeholder-[#7A7068] outline-none"
                />
                <button className="ml-2 p-1 rounded-full bg-[#F7F4F0] text-[#7A7068] hover:text-[#C4622D] transition-colors flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px]">tune</span>
                </button>
              </div>
            </div>

            {/* Map Area */}
            <div className="relative h-[220px] w-full bg-[#EFE7DD] shrink-0 overflow-hidden border-b border-[rgba(33,28,26,0.06)]">
              {/* Simulated Map Background */}
              <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&q=80&w=800')" }}></div>
              <div className="absolute inset-0 bg-[#F7F4F0]/65 mix-blend-color"></div>
              
              {/* Overlay styling */}
              <div className="absolute bottom-0 w-full h-16 bg-gradient-to-t from-[#F7F4F0] to-transparent"></div>

              {/* Terracotta Map Pins (Simulated) */}
              <div className="absolute top-12 left-[15%]">
                <div className="bg-[#C4622D] text-white rounded-full p-2 shadow-lg flex items-center justify-center relative cursor-pointer active:scale-90 transition-transform">
                  <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>spa</span>
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-[#C4622D] rotate-45"></div>
                </div>
              </div>
              <div className="absolute top-[60%] left-[55%]">
                <div className="bg-[#C4622D] text-white rounded-full p-2 shadow-lg flex items-center justify-center relative cursor-pointer active:scale-90 transition-transform">
                  <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>spa</span>
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-[#C4622D] rotate-45"></div>
                </div>
              </div>
              <div className="absolute top-8 right-[25%]">
                <div className="bg-[#FFFFFF] text-[#C4622D] border border-[#C4622D]/20 rounded-full p-2 shadow-lg flex items-center justify-center relative cursor-pointer active:scale-90 transition-transform">
                  <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>spa</span>
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-[#FFFFFF] rotate-45 border-r border-b border-[#C4622D]/10"></div>
                </div>
              </div>

              {/* Madrid Floating Badge */}
              <div className="absolute top-3 left-4 bg-[#FFFFFF]/90 backdrop-blur-sm px-3 py-1 rounded-full text-[11px] font-semibold tracking-wider text-[#7A7068] flex items-center gap-1 shadow-sm border border-[rgba(33,28,26,0.06)]">
                <span className="material-symbols-outlined text-[13px] text-[#C4622D]">explore</span>
                MADRID MAP VIEW
              </div>
            </div>

            {/* List Header */}
            <div className="px-5 pt-3 pb-2 flex justify-between items-end bg-[#F7F4F0] shrink-0">
              <h2 className="font-serif text-[22px] leading-tight font-bold text-[#211C1A]">Studios near you</h2>
              <span className="text-[11px] uppercase tracking-widest text-[#C4622D] font-bold">{filteredStudios.length} Found</span>
            </div>

            {/* Scrollable list of Studios */}
            <div className="flex-1 overflow-y-auto px-5 pb-24 space-y-4 no-scrollbar">
              {filteredStudios.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-3xl p-6 border border-[rgba(33,28,26,0.06)]">
                  <span className="material-symbols-outlined text-[#7A7068] text-4xl mb-2">sentiment_dissatisfied</span>
                  <p className="text-[#7A7068] text-sm">No studios match your search query.</p>
                  <button onClick={() => setSearchQuery("")} className="mt-3 text-xs text-[#C4622D] font-bold">Clear filters</button>
                </div>
              ) : (
                filteredStudios.map(studio => (
                  <div 
                    key={studio.id}
                    onClick={() => {
                      setSelectedStudio(studio);
                      setCurrentScreen("studio_detail");
                    }}
                    className="bg-[#FFFFFF] rounded-3xl p-4 shadow-[0_4px_20px_rgba(158,77,34,0.04)] flex gap-4 active:scale-[0.99] transition-all cursor-pointer border border-[rgba(33,28,26,0.04)] hover:shadow-md"
                  >
                    <div className="w-24 h-24 rounded-2xl overflow-hidden shrink-0 bg-[#EFE7DD] relative">
                      <img className="w-full h-full object-cover" src={studio.image} alt={studio.name} />
                      <button 
                        onClick={(e) => toggleFavorite(studio.id, e)}
                        className="absolute top-1.5 right-1.5 p-1.5 rounded-full bg-white/90 backdrop-blur-sm text-[#7A7068] hover:text-[#C4622D] transition-colors shadow-sm flex items-center justify-center"
                      >
                        <span 
                          className="material-symbols-outlined text-[15px]"
                          style={{ fontVariationSettings: favorites.includes(studio.id) ? "'FILL' 1" : "'FILL' 0" }}
                        >
                          favorite
                        </span>
                      </button>
                    </div>

                    <div className="flex flex-col justify-between flex-1 py-0.5">
                      <div>
                        <div className="flex justify-between items-start">
                          <h3 className="font-serif text-[17px] font-bold text-[#211C1A] leading-tight">{studio.name}</h3>
                          <div className="flex items-center gap-0.5 text-[#E0A458]">
                            <span className="material-symbols-outlined text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                            <span className="text-xs font-bold text-[#211C1A]">{studio.rating}</span>
                          </div>
                        </div>
                        <p className="text-xs text-[#7A7068] mt-1 flex items-center gap-0.5">
                          <span className="material-symbols-outlined text-[13px]">location_on</span>
                          {studio.district}
                        </p>
                      </div>

                      <div className="mt-2 pt-1 border-t border-[rgba(33,28,26,0.04)]">
                        <p className="text-[11px] font-medium text-[#7A7068]">
                          {studio.services[0]?.name} • {studio.services[0]?.duration} min • <span className="font-semibold text-[#C4622D]">€{studio.services[0]?.price}</span>
                        </p>
                        <div className="flex gap-1.5 mt-2">
                          <span className="px-2 py-0.5 bg-[#F7F4F0] rounded-full text-[9px] font-semibold text-[#7A7068] uppercase tracking-wider">Pay at studio</span>
                          <span className="px-2 py-0.5 bg-[#C4622D]/10 rounded-full text-[9px] font-bold text-[#C4622D] uppercase tracking-wider">Available Today</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ======================================= */}
        {/* 3. STUDIO DETAIL SCREEN                 */}
        {/* ======================================= */}
        {currentScreen === "studio_detail" && (
          <div className="flex-1 flex flex-col bg-[#F7F4F0] overflow-y-auto pb-24 no-scrollbar">
            {/* Header cluster overlay on hero image */}
            <div className="absolute top-5 left-5 right-5 z-20 flex justify-between items-center">
              <button 
                onClick={() => setCurrentScreen("studios_list")}
                className="w-10 h-10 rounded-full bg-white/95 backdrop-blur-sm flex items-center justify-center shadow-md active:scale-95 transition-all cursor-pointer text-[#C4622D]"
              >
                <span className="material-symbols-outlined">arrow_back</span>
              </button>
              <div className="flex gap-2">
                <button className="w-10 h-10 rounded-full bg-white/95 backdrop-blur-sm flex items-center justify-center shadow-md active:scale-95 transition-all text-[#C4622D]">
                  <span className="material-symbols-outlined text-[20px]">ios_share</span>
                </button>
                <button 
                  onClick={(e) => toggleFavorite(selectedStudio.id, e)}
                  className="w-10 h-10 rounded-full bg-white/95 backdrop-blur-sm flex items-center justify-center shadow-md active:scale-95 transition-all text-[#C4622D]"
                >
                  <span 
                    className="material-symbols-outlined text-[20px]"
                    style={{ fontVariationSettings: favorites.includes(selectedStudio.id) ? "'FILL' 1" : "'FILL' 0" }}
                  >
                    favorite
                  </span>
                </button>
              </div>
            </div>

            {/* Hero Section */}
            <div className="relative w-full h-[280px] shrink-0">
              <img className="absolute inset-0 w-full h-full object-cover" src={selectedStudio.image} alt={selectedStudio.name} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent pointer-events-none"></div>
            </div>

            {/* Content Body Container */}
            <div className="px-6 pt-7 pb-6 flex flex-col gap-8 relative z-10 -mt-6 bg-[#F7F4F0] rounded-t-[32px]">
              {/* Studio Header Info */}
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <p className="text-[11px] font-bold text-[#7A7068] uppercase tracking-widest mb-1">{selectedStudio.district}</p>
                    <h1 className="font-serif text-[28px] font-bold text-[#211C1A] leading-tight">{selectedStudio.name}</h1>
                  </div>
                  <div className="flex flex-col items-end shrink-0">
                    <div className="flex items-center gap-1 bg-[#FFFFFF] py-1 px-3 rounded-full border border-[rgba(33,28,26,0.06)] shadow-sm">
                      <span className="material-symbols-outlined text-[#E0A458] text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                      <span className="text-xs font-bold text-[#211C1A]">{selectedStudio.rating}</span>
                    </div>
                    <span className="text-[10px] text-[#7A7068] mt-1 underline underline-offset-2 decoration-[#7A7068]/35 cursor-pointer">({selectedStudio.reviewsCount} reviews)</span>
                  </div>
                </div>

                {/* Service Tags (Horizontal Scroll) */}
                <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1 pt-1 -mx-6 px-6">
                  {selectedStudio.tags.map((tag, idx) => (
                    <span key={idx} className="shrink-0 bg-[#EFE7DD] text-[#211C1A] text-[11px] font-semibold py-1.5 px-3.5 rounded-full">
                      {tag}
                    </span>
                  ))}
                </div>

                <p className="text-[14px] text-[#7A7068] leading-relaxed mt-2.5">
                  {selectedStudio.description}
                </p>
              </div>

              {/* Services List / Treatments */}
              <div className="flex flex-col gap-4">
                <h2 className="font-serif text-lg font-bold text-[#211C1A] flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[#C4622D] text-[20px]" style={{ fontVariationSettings: "'FILL' 0" }}>spa</span>
                  Treatments
                </h2>
                
                <div className="flex flex-col gap-3.5">
                  {selectedStudio.services.map((service, idx) => (
                    <div 
                      key={idx}
                      className="bg-[#FFFFFF] rounded-2xl p-4.5 shadow-[0_4px_16px_rgba(158,77,34,0.03)] border border-[rgba(33,28,26,0.05)] flex flex-col gap-3.5"
                    >
                      <div className="flex justify-between items-start gap-4">
                        <div>
                          <h3 className="font-serif text-[16px] font-bold text-[#211C1A] leading-tight">{service.name}</h3>
                          <p className="text-xs text-[#7A7068] mt-1 leading-snug">{service.description}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-serif text-[18px] font-bold text-[#211C1A] block">€{service.price}</span>
                          <span className="text-[9px] text-[#7A7068] bg-[#F7F4F0] px-1.5 py-0.5 rounded text-[9px] font-semibold tracking-wider mt-1 inline-block uppercase">Pay at studio</span>
                        </div>
                      </div>

                      <div className="flex justify-between items-center border-t border-[rgba(33,28,26,0.04)] pt-3.5 mt-0.5">
                        <div className="flex items-center gap-1 text-[#7A7068] bg-[#F7F4F0] px-3 py-1 rounded-full text-xs">
                          <span className="material-symbols-outlined text-[15px]" style={{ fontVariationSettings: "'FILL' 0" }}>schedule</span>
                          <span className="font-semibold text-[#211C1A]">{service.duration} min</span>
                        </div>
                        <button 
                          onClick={() => startBooking(selectedStudio, service)}
                          className="bg-[#C4622D] text-white font-semibold text-xs py-2 px-5 rounded-full hover:bg-[#9E4D22] active:scale-95 transition-all shadow-sm cursor-pointer"
                        >
                          Book
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Location & Contact */}
              <div className="flex flex-col gap-4">
                <h2 className="font-serif text-lg font-bold text-[#211C1A] flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[#C4622D] text-[20px]" style={{ fontVariationSettings: "'FILL' 0" }}>location_on</span>
                  Location
                </h2>

                <div className="bg-[#FFFFFF] rounded-2xl p-2.5 border border-[rgba(33,28,26,0.05)] shadow-sm">
                  {/* Simulated Location Map Box */}
                  <div className="w-full h-32 rounded-xl bg-[#EFE7DD] relative overflow-hidden flex items-center justify-center">
                    <div className="absolute inset-0 opacity-40 bg-[radial-gradient(#211c1a_1px,transparent_1px)] [background-size:16px_16px]"></div>
                    <div className="w-9 h-9 bg-white rounded-full flex items-center justify-center shadow-md animate-bounce relative z-10">
                      <span className="material-symbols-outlined text-[#C4622D] text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>location_on</span>
                    </div>
                  </div>

                  <div className="p-3 mt-1.5 flex flex-col gap-3.5">
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <p className="text-xs font-bold text-[#211C1A]">{selectedStudio.locationAddress.split(",")[0]}</p>
                        <p className="text-[11px] text-[#7A7068] mt-0.5">{selectedStudio.locationAddress.split(",").slice(1).join(",").trim()}</p>
                      </div>
                      <button className="w-9 h-9 rounded-full border border-[rgba(33,28,26,0.08)] flex items-center justify-center text-[#C4622D] hover:bg-[#F7F4F0]">
                        <span className="material-symbols-outlined text-[18px]">directions</span>
                      </button>
                    </div>

                    <div className="flex gap-3 pt-3.5 border-t border-[rgba(33,28,26,0.05)]">
                      <button className="flex-1 py-2 bg-[#F7F4F0] rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold text-[#211C1A] hover:bg-[#EFE7DD] transition-all">
                        <span className="material-symbols-outlined text-[16px]">call</span>
                        Call
                      </button>
                      <button className="flex-1 py-2 bg-[#F7F4F0] rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold text-[#211C1A] hover:bg-[#EFE7DD] transition-all">
                        <span className="material-symbols-outlined text-[16px]">chat</span>
                        Chat
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================= */}
        {/* 4. SELECT DATE & TIME SCREEN            */}
        {/* ======================================= */}
        {currentScreen === "select_time" && (
          <div className="flex-1 flex flex-col bg-[#F7F4F0] overflow-y-auto pb-28 no-scrollbar">
            <header className="px-5 py-4 flex items-center bg-[#F7F4F0] sticky top-0 z-10 border-b border-[rgba(33,28,26,0.04)] shrink-0">
              <button 
                onClick={() => setCurrentScreen("studio_detail")}
                className="p-1.5 rounded-full hover:bg-[#EFE7DD] text-[#211C1A]"
              >
                <span className="material-symbols-outlined">arrow_back</span>
              </button>
              <div className="flex-1 text-center pr-8">
                <h1 className="font-serif text-[18px] font-bold text-[#211C1A]">Select Time</h1>
              </div>
            </header>

            <main className="px-5 pt-4">
              {/* Booking Summary Card */}
              <div className="bg-[#FFFFFF] rounded-2xl p-5 border border-[rgba(33,28,26,0.05)] shadow-sm mb-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="font-serif text-[17px] font-bold text-[#211C1A] leading-tight">
                      {bookingService?.name}
                    </h2>
                    <p className="text-xs text-[#7A7068] mt-1 font-semibold flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">schedule</span>
                      {bookingService?.duration} min • {selectedStudio.name}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-[rgba(33,28,26,0.05)]">
                  <span className="text-base text-[#211C1A] font-bold">€{bookingService?.price}.00</span>
                  <span className="text-[10px] uppercase font-bold text-[#7A7068] tracking-widest ml-auto">Step 2 of 3</span>
                </div>
              </div>

              {/* Date Selection */}
              <div className="mb-6">
                <div className="flex justify-between items-end mb-3">
                  <h3 className="text-[11px] font-bold uppercase tracking-widest text-[#7A7068]">October</h3>
                  <span className="text-xs font-bold text-[#C4622D] cursor-pointer">View Calendar</span>
                </div>
                
                <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1 -mx-5 px-5">
                  {[
                    { day: "Mon", date: "14" },
                    { day: "Tue", date: "15" },
                    { day: "Wed", date: "16", active: true },
                    { day: "Thu", date: "17" },
                    { day: "Fri", date: "18" },
                    { day: "Sat", date: "19" }
                  ].map((d, idx) => (
                    <button 
                      key={idx}
                      onClick={() => setSelectedDate(`${d.day} ${d.date}`)}
                      className={`flex-shrink-0 w-14 h-19 rounded-full flex flex-col items-center justify-center gap-0.5 border transition-all cursor-pointer ${
                        selectedDate === `${d.day} ${d.date}` || (d.active && selectedDate === "Wed 16")
                          ? "bg-[#C4622D] text-white border-[#C4622D] shadow-sm scale-102 font-bold" 
                          : "bg-white text-[#211C1A] border-[rgba(33,28,26,0.05)] hover:border-[#C4622D]/30"
                      }`}
                    >
                      <span className={`text-[10px] uppercase tracking-wide ${
                        selectedDate === `${d.day} ${d.date}` || (d.active && selectedDate === "Wed 16") ? "text-white/80" : "text-[#7A7068]"
                      }`}>{d.day}</span>
                      <span className="font-serif text-lg leading-none font-bold">{d.date}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Time Slots */}
              <div className="mb-6">
                <h3 className="text-[11px] font-bold uppercase tracking-widest text-[#7A7068] mb-3.5">Morning</h3>
                <div className="grid grid-cols-3 gap-2.5 mb-6">
                  {["09:00", "09:30", "10:00", "10:30", "11:00"].map((time, idx) => {
                    const isUnavailable = time === "10:30";
                    const isSelected = selectedTime === time && !isUnavailable;
                    return (
                      <button 
                        key={idx}
                        disabled={isUnavailable}
                        onClick={() => setSelectedTime(time)}
                        className={`h-11 rounded-full border text-xs font-semibold flex items-center justify-center transition-colors cursor-pointer ${
                          isUnavailable 
                            ? "bg-[#EFE7DD] text-[#7A7068]/50 border-transparent opacity-50 cursor-not-allowed line-through"
                            : isSelected
                              ? "bg-[#C4622D] text-white border-[#C4622D] font-bold shadow-sm"
                              : "bg-white text-[#211C1A] border-[rgba(33,28,26,0.05)] hover:border-[#C4622D]/40"
                        }`}
                      >
                        {time}
                      </button>
                    );
                  })}
                </div>

                <h3 className="text-[11px] font-bold uppercase tracking-widest text-[#7A7068] mb-3.5">Afternoon</h3>
                <div className="grid grid-cols-3 gap-2.5">
                  {["13:00", "13:30", "14:00", "14:30"].map((time, idx) => {
                    const isUnavailable = time === "13:00";
                    const isSelected = selectedTime === time && !isUnavailable;
                    return (
                      <button 
                        key={idx}
                        disabled={isUnavailable}
                        onClick={() => setSelectedTime(time)}
                        className={`h-11 rounded-full border text-xs font-semibold flex items-center justify-center transition-colors cursor-pointer ${
                          isUnavailable 
                            ? "bg-[#EFE7DD] text-[#7A7068]/50 border-transparent opacity-50 cursor-not-allowed line-through"
                            : isSelected
                              ? "bg-[#C4622D] text-white border-[#C4622D] font-bold shadow-sm"
                              : "bg-white text-[#211C1A] border-[rgba(33,28,26,0.05)] hover:border-[#C4622D]/40"
                        }`}
                      >
                        {time}
                      </button>
                    );
                  })}
                </div>
              </div>
            </main>

            {/* Sticky Action Footer */}
            <div className="absolute bottom-0 left-0 w-full p-5 bg-gradient-to-t from-[#F7F4F0] via-[#F7F4F0] to-transparent pt-10 z-20">
              <button 
                onClick={() => setCurrentScreen("customize")}
                className="w-full h-13 rounded-full bg-[#C4622D] text-white font-bold text-[15px] flex items-center justify-center shadow-[0_6px_20px_rgba(196,98,45,0.22)] hover:bg-[#9E4D22] active:scale-98 transition-all cursor-pointer"
              >
                Continue to Customization
              </button>
            </div>
          </div>
        )}

        {/* ======================================= */}
        {/* 5. CUSTOMIZE TREATMENT SCREEN           */}
        {/* ======================================= */}
        {currentScreen === "customize" && (
          <div className="flex-1 flex flex-col bg-[#F7F4F0] overflow-y-auto pb-28 no-scrollbar">
            <header className="px-5 py-4 flex items-center bg-[#F7F4F0] sticky top-0 z-10 border-b border-[rgba(33,28,26,0.04)] shrink-0">
              <button 
                onClick={() => setCurrentScreen("select_time")}
                className="p-1.5 rounded-full hover:bg-[#EFE7DD] text-[#211C1A]"
              >
                <span className="material-symbols-outlined">arrow_back</span>
              </button>
              <div className="flex-1 text-center pr-8">
                <span className="font-serif text-[18px] font-bold text-[#211C1A]">Customize Session</span>
              </div>
            </header>

            <main className="px-5 pt-4 space-y-6">
              {/* Header intro */}
              <div>
                <h1 className="font-serif text-2xl font-bold text-[#211C1A] leading-tight">Tell your therapist how you like it.</h1>
                <p className="text-xs text-[#7A7068] mt-1">Customize your session parameters to ensure maximum relaxation.</p>
              </div>

              {/* Pressure Selector */}
              <div className="space-y-3">
                <h2 className="font-serif text-base font-bold text-[#211C1A]">Pressure</h2>
                <div className="grid grid-cols-4 gap-2">
                  {["Light", "Medium", "Firm", "Deep"].map((p, idx) => (
                    <button 
                      key={idx}
                      onClick={() => setPressure(p)}
                      className={`h-11 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                        pressure === p 
                          ? "bg-[#C4622D] text-white border-[#C4622D] font-bold shadow-sm scale-102"
                          : "bg-white text-[#7A7068] border-[rgba(33,28,26,0.05)] hover:border-[#C4622D]/35"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Focus Areas Selector */}
              <div className="space-y-3">
                <div className="flex justify-between items-end">
                  <h2 className="font-serif text-base font-bold text-[#211C1A]">Focus areas</h2>
                  <span className="text-[10px] font-bold text-[#7A7068] uppercase tracking-wider">Select Multiple</span>
                </div>
                <div className="flex flex-wrap gap-2 pt-0.5">
                  {["Neck", "Shoulders", "Upper Back", "Lower Back", "Legs", "Feet"].map((area, idx) => {
                    const isSelected = focusAreas.includes(area);
                    return (
                      <button 
                        key={idx}
                        onClick={() => {
                          if (isSelected) {
                            setFocusAreas(focusAreas.filter(a => a !== area));
                          } else {
                            setFocusAreas([...focusAreas, area]);
                          }
                        }}
                        className={`py-2 px-4 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                          isSelected 
                            ? "bg-[#C4622D] text-white border-[#C4622D] font-bold"
                            : "bg-[#EFE7DD] text-[#211C1A] border-transparent hover:bg-[#EFE7DD]/70"
                        }`}
                      >
                        {area}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Enhancements / Add-ons */}
              <div className="space-y-3">
                <h2 className="font-serif text-base font-bold text-[#211C1A]">Enhancements</h2>
                <div className="flex flex-col gap-2.5">
                  {[
                    { name: "Aromatherapy", price: 10, desc: "Bespoke blend of organic essential oils.", icon: "local_florist" },
                    { name: "Hot Stones", price: 20, desc: "Smooth volcanic basalt stones used to massage deep muscles.", icon: "spa" }
                  ].map((addon, idx) => {
                    const isSelected = enhancements.includes(addon.name);
                    return (
                      <button 
                        key={idx}
                        onClick={() => {
                          if (isSelected) {
                            setEnhancements(enhancements.filter(e => e !== addon.name));
                          } else {
                            setEnhancements([...enhancements, addon.name]);
                          }
                        }}
                        className={`p-4 rounded-2xl bg-white border text-left flex items-center justify-between transition-all cursor-pointer ${
                          isSelected 
                            ? "border-[#C4622D] bg-[#F7F4F0]/60 shadow-sm"
                            : "border-[rgba(33,28,26,0.06)] hover:border-[#C4622D]/35 shadow-sm"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                            isSelected ? "bg-[#C4622D]/10 text-[#C4622D]" : "bg-[#F7F4F0] text-[#7A7068]"
                          }`}>
                            <span className="material-symbols-outlined text-[20px]">{addon.icon}</span>
                          </div>
                          <div>
                            <span className="text-sm font-bold text-[#211C1A] block">{addon.name}</span>
                            <span className="text-xs text-[#7A7068] mt-0.5 block">{addon.desc}</span>
                            <span className="text-xs text-[#C4622D] font-semibold mt-1 block">+ €{addon.price}</span>
                          </div>
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          isSelected ? "border-[#C4622D] bg-[#C4622D]" : "border-[rgba(33,28,26,0.15)] bg-white"
                        }`}>
                          {isSelected && <span className="material-symbols-outlined text-white text-[13px] font-bold">check</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Notes Section */}
              <div className="space-y-3">
                <h2 className="font-serif text-base font-bold text-[#211C1A]">Notes for Therapist</h2>
                <textarea 
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any injuries, preferences, or medical conditions we should know about?"
                  rows={3}
                  className="w-full rounded-2xl border border-[rgba(33,28,26,0.12)] bg-white p-4 text-xs text-[#211C1A] placeholder:text-[#7A7068] focus:border-[#C4622D] focus:ring-1 focus:ring-[#C4622D] transition-colors shadow-sm resize-none outline-none"
                />
              </div>
            </main>

            {/* Sticky Action Footer */}
            <div className="absolute bottom-0 left-0 w-full p-5 bg-gradient-to-t from-[#F7F4F0] via-[#F7F4F0] to-transparent pt-10 z-20">
              <button 
                onClick={() => setCurrentScreen("review")}
                className="w-full h-13 rounded-full bg-[#C4622D] text-white font-bold text-[15px] flex items-center justify-center shadow-[0_6px_20px_rgba(196,98,45,0.22)] hover:bg-[#9E4D22] active:scale-98 transition-all cursor-pointer"
              >
                Review Booking
              </button>
            </div>
          </div>
        )}

        {/* ======================================= */}
        {/* 6. REVIEW BOOKING SCREEN                */}
        {/* ======================================= */}
        {currentScreen === "review" && (
          <div className="flex-1 flex flex-col bg-[#F7F4F0] overflow-y-auto pb-28 no-scrollbar">
            <header className="px-5 py-4 flex items-center bg-[#F7F4F0] sticky top-0 z-10 border-b border-[rgba(33,28,26,0.04)] shrink-0">
              <button 
                onClick={() => setCurrentScreen("customize")}
                className="p-1.5 rounded-full hover:bg-[#EFE7DD] text-[#211C1A]"
              >
                <span className="material-symbols-outlined">arrow_back</span>
              </button>
              {/* Progress dots bar */}
              <div className="flex-1 flex justify-center items-center gap-1.5 pr-8">
                <div className="w-2 h-2 rounded-full bg-[#7A7068]/30"></div>
                <div className="w-2 h-2 rounded-full bg-[#7A7068]/30"></div>
                <div className="w-5 h-2 rounded-full bg-[#C4622D]"></div>
              </div>
            </header>

            <main className="px-5 pt-4 space-y-6">
              {/* Heading */}
              <div>
                <h1 className="font-serif text-[26px] font-bold text-[#211C1A] leading-tight">Review your booking</h1>
                <p className="text-xs text-[#7A7068] mt-1">Please confirm your selection and details before requesting.</p>
              </div>

              {/* Summary card with details */}
              <div className="bg-white rounded-2xl p-5 border border-[rgba(33,28,26,0.05)] shadow-sm relative overflow-hidden">
                <div className="flex justify-between items-start gap-4 pb-4 border-b border-[rgba(33,28,26,0.05)]">
                  <div>
                    <h2 className="font-serif text-[17px] font-bold text-[#211C1A] leading-tight">
                      {bookingService?.name}
                    </h2>
                    <p className="text-xs text-[#7A7068] mt-1 font-semibold">{selectedStudio.name}</p>
                  </div>
                  <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 shadow-sm">
                    <img className="w-full h-full object-cover" src={selectedStudio.image} alt={selectedStudio.name} />
                  </div>
                </div>

                <div className="py-4 space-y-3.5 border-b border-[rgba(33,28,26,0.05)]">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#F7F4F0] flex items-center justify-center text-[#C4622D] shrink-0">
                      <span className="material-symbols-outlined text-[18px]">calendar_month</span>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#211C1A]">Thursday, Oct 24 • {selectedTime}</p>
                      <p className="text-[10px] text-[#7A7068] font-semibold mt-0.5">{bookingService?.duration} minutes</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#F7F4F0] flex items-center justify-center text-[#C4622D] shrink-0">
                      <span className="material-symbols-outlined text-[18px]">location_on</span>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#211C1A]">{selectedStudio.district}</p>
                      <p className="text-[10px] text-[#7A7068] font-semibold mt-0.5">{selectedStudio.locationAddress.split(",")[0]}</p>
                    </div>
                  </div>
                </div>

                {/* Total calculations */}
                <div className="pt-4 flex justify-between items-end">
                  <div>
                    <p className="text-[10px] font-bold text-[#7A7068] uppercase tracking-widest mb-0.5">Total to pay</p>
                    <p className="font-serif text-[24px] font-bold text-[#C4622D]">
                      €{(() => {
                        let total = bookingService?.price || 0;
                        if (enhancements.includes("Aromatherapy")) total += 10;
                        if (enhancements.includes("Hot Stones")) total += 20;
                        return total;
                      })()}
                    </p>
                  </div>
                  <div className="bg-[#F7F4F0] px-3.5 py-1.5 rounded-full flex items-center gap-1">
                    <span className="material-symbols-outlined text-[#E0A458] text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>storefront</span>
                    <span className="text-[10px] font-bold text-[#7A7068] tracking-wide uppercase">Pay at studio</span>
                  </div>
                </div>
              </div>

              {/* Customization Recap Card */}
              <div className="bg-[#FFFFFF] rounded-2xl p-5 border border-[rgba(33,28,26,0.05)] shadow-sm">
                <div className="flex items-center gap-2 mb-3.5 pb-2.5 border-b border-[rgba(33,28,26,0.04)]">
                  <span className="material-symbols-outlined text-[#C4622D] text-[18px]">tune</span>
                  <h3 className="text-xs font-bold text-[#211C1A] uppercase tracking-widest">Your Preferences</h3>
                </div>
                
                <div className="space-y-3 text-xs">
                  <div>
                    <span className="text-[#7A7068] block">Pressure Level</span>
                    <span className="font-bold text-[#211C1A] inline-block bg-[#C4622D]/10 text-[#C4622D] px-2.5 py-0.5 rounded-full mt-1">
                      {pressure}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#7A7068] block">Focus Areas</span>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {focusAreas.length === 0 ? (
                        <span className="text-[#7A7068] italic font-medium">None selected</span>
                      ) : (
                        focusAreas.map((a, idx) => (
                          <span key={idx} className="bg-[#F7F4F0] text-[#211C1A] font-semibold px-2.5 py-0.5 rounded-full border border-[rgba(33,28,26,0.05)]">
                            {a}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => setCurrentScreen("customize")}
                  className="mt-4 text-[#C4622D] text-xs font-bold hover:text-[#9E4D22] transition-colors underline decoration-[#C4622D]/25 underline-offset-4 cursor-pointer"
                >
                  Edit preferences
                </button>
              </div>

              {/* Client detail form */}
              <div className="bg-[#FFFFFF] rounded-2xl p-5 border border-[rgba(33,28,26,0.05)] shadow-sm space-y-4">
                <div className="flex items-center gap-2 mb-1 pb-2 border-b border-[rgba(33,28,26,0.04)]">
                  <span className="material-symbols-outlined text-[#C4622D] text-[18px]">person</span>
                  <h3 className="text-xs font-bold text-[#211C1A] uppercase tracking-widest">Your Details</h3>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-[#7A7068] font-semibold mb-1" htmlFor="name">Full Name</label>
                    <input 
                      type="text" 
                      id="name"
                      value={clientName} 
                      onChange={(e) => setClientName(e.target.value)}
                      className="w-full bg-[#F7F4F0] border border-[rgba(33,28,26,0.08)] rounded-xl px-3.5 py-2.5 font-semibold text-[#211C1A] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[#7A7068] font-semibold mb-1" htmlFor="email">Email Address</label>
                    <input 
                      type="email" 
                      id="email"
                      value={clientEmail} 
                      onChange={(e) => setClientEmail(e.target.value)}
                      className="w-full bg-[#F7F4F0] border border-[rgba(33,28,26,0.08)] rounded-xl px-3.5 py-2.5 font-semibold text-[#211C1A] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[#7A7068] font-semibold mb-1" htmlFor="phone">Phone Number</label>
                    <input 
                      type="tel" 
                      id="phone"
                      value={clientPhone} 
                      onChange={(e) => setClientPhone(e.target.value)}
                      className="w-full bg-[#F7F4F0] border border-[rgba(33,28,26,0.08)] rounded-xl px-3.5 py-2.5 font-semibold text-[#211C1A] outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Reassurance Message */}
              <div className="flex items-start gap-2.5 bg-[#C4622D]/10 rounded-2xl p-4">
                <span className="material-symbols-outlined text-[#C4622D] mt-0.5 text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>shield_lock</span>
                <p className="text-xs text-[#211C1A] leading-relaxed font-semibold">
                  The studio confirms your request and you pay there. <strong className="text-[#C4622D]">No credit card needed now.</strong>
                </p>
              </div>
            </main>

            {/* Sticky Action Footer */}
            <div className="absolute bottom-0 left-0 w-full p-5 bg-gradient-to-t from-[#F7F4F0] via-[#F7F4F0] to-transparent pt-10 z-20">
              <button 
                onClick={submitBookingRequest}
                className="w-full h-13 rounded-full bg-[#C4622D] text-white font-bold text-[15px] flex items-center justify-center shadow-[0_6px_20px_rgba(196,98,45,0.22)] hover:bg-[#9E4D22] active:scale-98 transition-all cursor-pointer gap-1.5"
              >
                Request Booking
                <span className="material-symbols-outlined text-sm font-bold">arrow_forward</span>
              </button>
            </div>
          </div>
        )}

        {/* ======================================= */}
        {/* 7. SUCCESS SCREEN                       */}
        {/* ======================================= */}
        {currentScreen === "success" && (
          <div className="flex-1 flex flex-col bg-[#F7F4F0] items-center justify-center p-6 text-center overflow-y-auto no-scrollbar">
            {/* Success Animation Ring */}
            <div className="mb-6 relative flex items-center justify-center w-20 h-20 rounded-full bg-[#FFFFFF] shadow-[0_8px_24px_rgba(158,77,34,0.08)]">
              <div className="absolute inset-0 rounded-full border-2 border-[#C4622D] opacity-20 animate-ping"></div>
              <span className="material-symbols-outlined text-5xl text-[#C4622D]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            </div>

            <h1 className="font-serif text-[30px] leading-tight font-bold text-[#211C1A] mb-2">Request sent.</h1>
            <p className="text-[14px] text-[#7A7068] leading-relaxed mb-6 px-4">
              {selectedStudio.name} will confirm your {bookingService?.name} on Oct 24 at {selectedTime} AM. We'll email you the moment they do.
            </p>

            {/* Receipt Summary Card */}
            <div className="w-full bg-[#FFFFFF] rounded-2xl p-5 border border-[rgba(33,28,26,0.05)] shadow-sm mb-8 flex flex-col gap-3.5 text-xs text-left">
              <div className="flex justify-between items-center pb-3 border-b border-[rgba(33,28,26,0.04)]">
                <span className="text-[#7A7068] font-semibold">Reference</span>
                <span className="bg-[#F7F4F0] px-3 py-1 rounded-full font-bold text-[#211C1A]">
                  {lastSubmittedBooking?.reference}
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="material-symbols-outlined text-[#7A7068] text-[18px]">payments</span>
                <p className="text-[#7A7068] leading-relaxed">
                  Pay at the studio when you arrive. Settle securely via cash or card.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="w-full flex flex-col gap-2.5">
              <button 
                onClick={() => {
                  setCurrentScreen("studios_list");
                  setActiveTab("massages");
                }}
                className="w-full h-11 rounded-full bg-[#C4622D] text-white font-bold text-xs flex items-center justify-center hover:bg-[#9E4D22] transition-colors active:scale-95 duration-200 cursor-pointer shadow-sm"
              >
                Browse more studios
              </button>
              <button 
                onClick={() => {
                  setCurrentScreen("bookings_list");
                  setActiveTab("bookings");
                }}
                className="w-full h-11 rounded-full bg-white border border-[rgba(33,28,26,0.12)] text-[#C4622D] font-bold text-xs flex items-center justify-center hover:bg-[#F7F4F0] transition-colors active:scale-95 duration-200 cursor-pointer"
              >
                View my bookings
              </button>
            </div>
          </div>
        )}

        {/* ======================================= */}
        {/* 8. BOOKINGS LIST SCREEN (CUSTOMER VIEW)  */}
        {/* ======================================= */}
        {currentScreen === "bookings_list" && (
          <div className="flex-1 flex flex-col bg-[#F7F4F0] overflow-hidden">
            <header className="px-6 py-5 bg-[#F7F4F0] shrink-0 border-b border-[rgba(33,28,26,0.04)]">
              <h1 className="font-serif text-[24px] font-bold text-[#211C1A]">My Bookings</h1>
              <p className="text-xs text-[#7A7068] mt-0.5">View your reservation requests and historical visits.</p>
            </header>

            <main className="flex-1 overflow-y-auto px-5 py-4 space-y-4 pb-24 no-scrollbar">
              {bookings.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-3xl p-6 border border-[rgba(33,28,26,0.05)]">
                  <span className="material-symbols-outlined text-[#7A7068] text-4xl mb-2">calendar_today</span>
                  <p className="text-[#7A7068] text-sm">No bookings yet.</p>
                  <button 
                    onClick={() => {
                      setCurrentScreen("studios_list");
                      setActiveTab("massages");
                    }} 
                    className="mt-4 text-xs bg-[#C4622D] text-white py-2 px-5 rounded-full font-bold cursor-pointer"
                  >
                    Find a massage
                  </button>
                </div>
              ) : (
                bookings.map((booking) => (
                  <div 
                    key={booking.id}
                    className="bg-white rounded-2xl p-4.5 border border-[rgba(33,28,26,0.05)] shadow-[0_4px_16px_rgba(158,77,34,0.02)] flex flex-col gap-3.5"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-serif text-[16px] font-bold text-[#211C1A] leading-tight">{booking.serviceName}</h3>
                        <p className="text-[11px] text-[#7A7068] font-semibold mt-1">{booking.studioName}</p>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                        booking.status === "confirmed" 
                          ? "bg-green-100 text-green-800" 
                          : booking.status === "declined"
                            ? "bg-red-100 text-red-800"
                            : "bg-[#C4622D]/10 text-[#C4622D]"
                      }`}>
                        {booking.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] bg-[#F7F4F0] p-3 rounded-xl">
                      <div>
                        <span className="text-[#7A7068] block">When</span>
                        <span className="font-bold text-[#211C1A]">{booking.date} • {booking.time}</span>
                      </div>
                      <div>
                        <span className="text-[#7A7068] block">Price</span>
                        <span className="font-bold text-[#211C1A]">€{booking.price}</span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-2.5 border-t border-[rgba(33,28,26,0.04)] text-[10px] text-[#7A7068]">
                      <span>Ref: {booking.reference}</span>
                      <div className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#E0A458]"></span>
                        <span>Pay at Studio</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </main>
          </div>
        )}

        {/* ======================================= */}
        {/* 9. PROFILE & PREFERENCES SCREEN         */}
        {/* ======================================= */}
        {currentScreen === "profile_view" && (
          <div className="flex-1 flex flex-col bg-[#F7F4F0] overflow-hidden">
            <header className="px-6 py-5 bg-[#F7F4F0] shrink-0 border-b border-[rgba(33,28,26,0.04)]">
              <h1 className="font-serif text-[24px] font-bold text-[#211C1A]">My Profile</h1>
              <p className="text-xs text-[#7A7068] mt-0.5">Manage details and switch account configurations.</p>
            </header>

            <main className="flex-1 overflow-y-auto px-5 py-4 space-y-5 pb-24 no-scrollbar">
              {/* User Identity Card */}
              <div className="bg-white rounded-2xl p-5 border border-[rgba(33,28,26,0.05)] shadow-sm flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-[#C4622D]/10 flex items-center justify-center text-[#C4622D] shrink-0">
                  <span className="material-symbols-outlined text-3xl">account_circle</span>
                </div>
                <div>
                  <h3 className="font-serif text-lg font-bold text-[#211C1A]">Elena Garcia</h3>
                  <p className="text-xs text-[#7A7068] mt-0.5">elena.g@example.com</p>
                </div>
              </div>

              {/* Quick Preferences Card */}
              <div className="bg-white rounded-2xl p-5 border border-[rgba(33,28,26,0.05)] shadow-sm space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-widest text-[#7A7068] pb-1 border-b border-[rgba(33,28,26,0.04)]">Default Preferences</h3>
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-[#7A7068]">Preferred Pressure</span>
                    <span className="font-bold text-[#211C1A]">Medium</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#7A7068]">Language</span>
                    <span className="font-bold text-[#C4622D]">English / Madrid (ES)</span>
                  </div>
                </div>
              </div>

              {/* Owner Portal Quick Link */}
              <div className="bg-white rounded-2xl p-5 border border-[rgba(33,28,26,0.05)] shadow-sm space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-[#211C1A]">Are you a Massage Studio Owner?</h3>
                  <p className="text-xs text-[#7A7068] mt-1">Claim your listing for free, confirm bookings, connect with Google Calendar, and optimize local exposure in Madrid.</p>
                </div>
                <button 
                  onClick={() => {
                    setUserRole("studio_owner");
                    setCurrentScreen("owner_dashboard");
                  }}
                  className="w-full py-2.5 bg-[#C4622D]/10 hover:bg-[#C4622D]/15 text-[#C4622D] text-xs font-bold rounded-full transition-all cursor-pointer"
                >
                  Manage Your Studio
                </button>
              </div>
            </main>
          </div>
        )}

        {/* ======================================= */}
        {/* 10. STUDIO OWNER DASHBOARD (PARTNER)    */}
        {/* ======================================= */}
        {currentScreen === "owner_dashboard" && (
          <div className="flex-1 flex flex-col bg-[#F7F4F0] overflow-y-auto pb-12 no-scrollbar">
            {/* Owner TopAppBar */}
            <header className="bg-[#F7F4F0] flex justify-between items-center w-full px-6 py-4 sticky top-0 z-40 border-b border-[rgba(33,28,26,0.04)] shrink-0">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#C4622D]" style={{ fontVariationSettings: "'FILL' 1" }}>spa</span>
                <span className="font-serif text-[18px] font-bold text-[#211C1A]">Partner Portal</span>
              </div>
              <div className="relative cursor-pointer hover:opacity-85 transition-all">
                <span className="material-symbols-outlined text-[#C4622D] text-[26px]">notifications</span>
                <span className="absolute -top-1 -right-1 bg-[#9E4D22] text-white text-[10px] w-4.5 h-4.5 rounded-full flex items-center justify-center font-bold">
                  {bookings.filter(b => b.status === "pending").length}
                </span>
              </div>
            </header>

            <main className="px-5 pt-4 space-y-6">
              {/* Studio Info Header */}
              <div>
                <h1 className="font-serif text-[28px] font-bold text-[#211C1A]">Oasis Studio</h1>
                <p className="text-xs text-[#7A7068] mt-1">Manage your bookings, service list, and customer requests.</p>
              </div>

              {/* Pending Requests Section */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="font-serif text-lg font-bold text-[#211C1A]">Pending Requests</h2>
                  <span className="text-xs font-bold text-[#C4622D] bg-[#C4622D]/10 px-3 py-1 rounded-full">
                    {bookings.filter(b => b.status === "pending").length} New
                  </span>
                </div>

                <div className="space-y-3">
                  {bookings.filter(b => b.status === "pending").length === 0 ? (
                    <div className="text-center py-8 bg-[#FFFFFF] rounded-2xl border border-[rgba(33,28,26,0.05)]">
                      <span className="material-symbols-outlined text-[#7A7068] text-3xl mb-1.5">check_circle</span>
                      <p className="text-[#7A7068] text-xs font-semibold">No pending requests!</p>
                    </div>
                  ) : (
                    bookings.filter(b => b.status === "pending").map((booking) => (
                      <div 
                        key={booking.id}
                        className="bg-white rounded-2xl p-5 shadow-[0_4px_16px_rgba(158,77,34,0.04)] flex flex-col gap-4 border border-[rgba(33,28,26,0.05)]"
                      >
                        <div>
                          <div className="flex justify-between items-start">
                            <h3 className="text-sm font-bold text-[#211C1A]">{booking.clientName}</h3>
                            <span className="text-[10px] text-[#C4622D] font-bold tracking-wide uppercase bg-[#C4622D]/10 px-2.5 py-0.5 rounded-full">
                              Pending Request
                            </span>
                          </div>
                          <p className="text-xs font-semibold text-[#7A7068] mt-0.5">{booking.serviceName} • {booking.duration} min</p>
                          <p className="text-xs text-[#7A7068] mt-2 flex items-center gap-1 bg-[#F7F4F0] p-2 rounded-lg font-semibold">
                            <span className="material-symbols-outlined text-[15px]">schedule</span>
                            {booking.date}, {booking.time}
                          </p>
                        </div>

                        {/* Customer Preferences Recap */}
                        <div className="text-[11px] text-[#7A7068] space-y-1 py-2 border-t border-b border-[rgba(33,28,26,0.04)]">
                          <p><strong className="text-[#211C1A]">Pressure:</strong> {booking.pressure}</p>
                          <p><strong className="text-[#211C1A]">Focus:</strong> {booking.focusAreas.join(", ") || "None specified"}</p>
                          {booking.notes && <p><strong className="text-[#211C1A]">Notes:</strong> {booking.notes}</p>}
                        </div>

                        <div className="flex gap-2">
                          <button 
                            onClick={() => updateBookingStatus(booking.id, "confirmed")}
                            className="flex-1 bg-[#C4622D] text-white text-xs font-bold h-11 rounded-full hover:bg-[#9E4D22] active:scale-95 transition-all cursor-pointer"
                          >
                            Confirm
                          </button>
                          <button 
                            onClick={() => updateBookingStatus(booking.id, "declined")}
                            className="flex-1 bg-[#EFE7DD] text-[#211C1A] text-xs font-bold h-11 rounded-full hover:bg-[#7A7068]/20 active:scale-95 transition-all cursor-pointer"
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Today's Bookings Section */}
              <div className="space-y-3.5">
                <h2 className="font-serif text-lg font-bold text-[#211C1A]">Today's Confirmed Bookings</h2>
                <div className="flex flex-col gap-2.5">
                  {bookings.filter(b => b.status === "confirmed").length === 0 ? (
                    <div className="text-center py-6 bg-white rounded-2xl border border-[rgba(33,28,26,0.05)] text-xs text-[#7A7068]">
                      No confirmed bookings for today.
                    </div>
                  ) : (
                    bookings.filter(b => b.status === "confirmed").map((booking, idx) => (
                      <div 
                        key={booking.id}
                        className="bg-white rounded-2xl p-4 shadow-[0_4px_16px_rgba(158,77,34,0.03)] flex items-center justify-between border-l-4 border-l-[#C4622D]"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 bg-[#F7F4F0] rounded-full flex flex-col items-center justify-center text-[#C4622D] shrink-0 font-bold border border-[rgba(33,28,26,0.04)]">
                            <span className="text-[11px] leading-tight font-bold">{booking.time.split(":")[0]}</span>
                            <span className="text-[8px] leading-none uppercase tracking-wide">PM</span>
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-[#211C1A]">{booking.clientName}</h4>
                            <p className="text-[10px] text-[#7A7068] mt-0.5">{booking.serviceName} • {booking.duration} min</p>
                          </div>
                        </div>
                        <span className="material-symbols-outlined text-[#7A7068]">chevron_right</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Quick Actions Grid */}
              <div className="space-y-3">
                <h2 className="font-serif text-lg font-bold text-[#211C1A]">Quick Actions</h2>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { name: "Services & Pricing", icon: "list_alt" },
                    { name: "Working Hours", icon: "schedule" },
                    { name: "Studio Photos", icon: "photo_library" },
                    { name: "Sync Calendar", icon: "calendar_today" }
                  ].map((act, idx) => (
                    <div 
                      key={idx}
                      className="bg-[#FFFFFF] rounded-2xl p-4.5 shadow-[0_4px_12px_rgba(158,77,34,0.02)] border border-[rgba(33,28,26,0.05)] flex flex-col items-center justify-center gap-2 hover:-translate-y-0.5 transition-transform cursor-pointer"
                    >
                      <div className="w-9 h-9 bg-[#F7F4F0] rounded-full flex items-center justify-center text-[#C4622D]">
                        <span className="material-symbols-outlined text-[18px]">{act.icon}</span>
                      </div>
                      <span className="text-[10px] font-bold text-[#211C1A] text-center">{act.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </main>
          </div>
        )}

        {/* ======================================= */}
        {/* CUSTOMER BOTTOM NAVIGATION SHELL        */}
        {/* ======================================= */}
        {userRole === "customer" && currentScreen !== "landing" && currentScreen !== "success" && (
          <nav className="absolute bottom-0 left-0 w-full flex justify-around items-center px-4 pt-3 pb-6 bg-white shadow-[0_-4px_24px_rgba(158,77,34,0.06)] z-40 border-t border-[rgba(33,28,26,0.05)]">
            <button 
              onClick={() => navigateToTab("massages")}
              className={`flex flex-col items-center justify-center gap-1 cursor-pointer transition-all active:scale-95 ${
                activeTab === "massages" ? "text-[#C4622D]" : "text-[#7A7068] hover:text-[#211C1A]"
              }`}
            >
              <span 
                className="material-symbols-outlined text-[22px]"
                style={{ fontVariationSettings: activeTab === "massages" ? "'FILL' 1" : "'FILL' 0" }}
              >
                dry_cleaning
              </span>
              <span className="text-[10px] font-bold tracking-wide uppercase">Massages</span>
            </button>

            <button 
              onClick={() => navigateToTab("discovery")}
              className={`flex flex-col items-center justify-center gap-1 cursor-pointer transition-all active:scale-95 ${
                activeTab === "discovery" ? "text-[#C4622D]" : "text-[#7A7068] hover:text-[#211C1A]"
              }`}
            >
              <span 
                className="material-symbols-outlined text-[22px]"
                style={{ fontVariationSettings: activeTab === "discovery" ? "'FILL' 1" : "'FILL' 0" }}
              >
                explore
              </span>
              <span className="text-[10px] font-bold tracking-wide uppercase">Discovery</span>
            </button>

            <button 
              onClick={() => navigateToTab("bookings")}
              className={`flex flex-col items-center justify-center gap-1 cursor-pointer transition-all active:scale-95 ${
                activeTab === "bookings" ? "text-[#C4622D]" : "text-[#7A7068] hover:text-[#211C1A]"
              }`}
            >
              <span 
                className="material-symbols-outlined text-[22px]"
                style={{ fontVariationSettings: activeTab === "bookings" ? "'FILL' 1" : "'FILL' 0" }}
              >
                calendar_month
              </span>
              <span className="text-[10px] font-bold tracking-wide uppercase">Bookings</span>
            </button>

            <button 
              onClick={() => navigateToTab("profile")}
              className={`flex flex-col items-center justify-center gap-1 cursor-pointer transition-all active:scale-95 ${
                activeTab === "profile" ? "text-[#C4622D]" : "text-[#7A7068] hover:text-[#211C1A]"
              }`}
            >
              <span 
                className="material-symbols-outlined text-[22px]"
                style={{ fontVariationSettings: activeTab === "profile" ? "'FILL' 1" : "'FILL' 0" }}
              >
                person
              </span>
              <span className="text-[10px] font-bold tracking-wide uppercase">Profile</span>
            </button>
          </nav>
        )}
      </div>
    </div>
  );
}
