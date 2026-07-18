import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import AppLayout from "./app/AppLayout";
import Login from "./app/screens/Login";
import MassageList from "./app/screens/MassageList";
import ShopDetail from "./app/screens/ShopDetail";
import Calendar from "./app/screens/Calendar";
import Customize from "./app/screens/Customize";
import Payment from "./app/screens/Payment";
import Discovery from "./app/screens/Discovery";
import MassageType from "./app/screens/MassageType";
import Quiz from "./app/screens/Quiz";
import PartnerLogin from "./app/screens/PartnerLogin";
import PartnerOnboarding from "./app/screens/PartnerOnboarding";
import PartnerDashboard from "./app/screens/PartnerDashboard";
import PartnerProfile from "./app/screens/PartnerProfile";
import PartnerServices from "./app/screens/PartnerServices";
import PartnerCalendar from "./app/screens/PartnerCalendar";
import PartnerConnectCalendar from "./app/screens/PartnerConnectCalendar";
import Survey from "./app/screens/Survey";
import SurveyCustomers from "./app/screens/SurveyCustomers";
import SurveyStudios from "./app/screens/SurveyStudios";
import FounderDashboard from "./app/screens/FounderDashboard";
import AdminInviteStudio from "./app/screens/AdminInviteStudio";
import StudioSetup from "./app/screens/StudioSetup";
import ClaimShortLink from "./app/screens/ClaimShortLink";
import StudioPortal from "./app/screens/StudioPortal";
import StudioBookingPage from "./app/screens/StudioBookingPage";
import PartnerPhotos from "./app/screens/PartnerPhotos";
import PartnerClients from "./app/screens/PartnerClients";
import MyBookings from "./app/screens/MyBookings";
import Profile from "./app/screens/Profile";
import Web from "./pages/Web";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* On the booking subdomain (book.<domain>), the root path IS the studio:
              book.massageclub.io/art-thai-massage → that studio's booking page. */}
          {typeof window !== "undefined" && window.location.hostname.startsWith("book.") ? (
            <Route path="/:studioId" element={<StudioBookingPage />} />
          ) : (
            <Route path="/" element={<Web />} />
          )}
          <Route path="/" element={<AppLayout />}>
            <Route index element={<Login />} />
            <Route path="massages" element={<MassageList />} />
            <Route path="massages/:id" element={<ShopDetail />} />
            <Route path="booking/:id/calendar" element={<Calendar />} />
            <Route path="booking/:id/customize" element={<Customize />} />
            <Route path="booking/:id/payment" element={<Payment />} />
            <Route path="discovery" element={<Discovery />} />
            <Route path="discovery/quiz" element={<Quiz />} />
            <Route path="discovery/:type" element={<MassageType />} />
            <Route path="bookings" element={<MyBookings />} />
            <Route path="profile" element={<Profile />} />
          </Route>
          <Route path="/app" element={<AppLayout />}>
            <Route index element={<Login />} />
            <Route path="massages" element={<MassageList />} />
            <Route path="massages/:id" element={<ShopDetail />} />
            <Route path="booking/:id/calendar" element={<Calendar />} />
            <Route path="booking/:id/customize" element={<Customize />} />
            <Route path="booking/:id/payment" element={<Payment />} />
            <Route path="discovery" element={<Discovery />} />
            <Route path="discovery/quiz" element={<Quiz />} />
            <Route path="discovery/:type" element={<MassageType />} />
            <Route path="bookings" element={<MyBookings />} />
            <Route path="profile" element={<Profile />} />
          </Route>
          <Route path="/landing" element={<Index />} />
          <Route path="/web" element={<Web />} />
          {/* Partner Portal Routes */}
          <Route path="/partner/onboarding" element={<PartnerOnboarding />} />
          <Route path="/partner" element={<PartnerLogin />} />
          <Route path="/partner/login" element={<PartnerLogin />} />
          <Route path="/partner/dashboard" element={<PartnerDashboard />} />
          <Route path="/partner/profile" element={<PartnerProfile />} />
          <Route path="/partner/services" element={<PartnerServices />} />
          <Route path="/partner/calendar" element={<PartnerCalendar />} />
          <Route path="/partner/connect-calendar" element={<PartnerConnectCalendar />} />
          <Route path="/partner/photos" element={<PartnerPhotos />} />
          <Route path="/partner/clients" element={<PartnerClients />} />
          <Route path="/survey" element={<Survey />} />
          <Route path="/survey/customers" element={<SurveyCustomers />} />
          <Route path="/survey/studios" element={<SurveyStudios />} />
          <Route path="/founder" element={<FounderDashboard />} />
          {/* Shareable public booking page (goes on Google Maps / WhatsApp) */}
          <Route path="/s/:studioId" element={<StudioBookingPage />} />
          <Route path="/book/:studioId" element={<StudioBookingPage />} />
          {/* Studio Invite + Setup */}
          <Route path="/admin/invite-studio" element={<AdminInviteStudio />} />
          <Route path="/studio-setup" element={<StudioSetup />} />
          {/* Short branded claim link for outreach: /claim/<slug> */}
          <Route path="/claim/:slug" element={<ClaimShortLink />} />
          <Route path="/studio-portal" element={<StudioPortal />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;