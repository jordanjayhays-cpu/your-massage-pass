import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
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
import PartnerResetPassword from "./app/screens/PartnerResetPassword";
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
import Home from "./pages/Home";
import BookingResult from "./pages/BookingResult";
import Review from "./pages/Review";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import MassageInEnglishMadrid from "./pages/guides/MassageInEnglishMadrid";
import MassagePricesMadrid from "./pages/guides/MassagePricesMadrid";
import MassagePricesMadridStudy from "./pages/guides/MassagePricesMadridStudy";

import DeepTissueMassageMadrid from "./pages/guides/DeepTissueMassageMadrid";
import MadridChamberi from "./pages/guides/MadridChamberi";
import MadridSalamanca from "./pages/guides/MadridSalamanca";
import MadridChamartin from "./pages/guides/MadridChamartin";
import MadridChueca from "./pages/guides/MadridChueca";
import MadridCentro from "./pages/guides/MadridCentro";
import MadridMalasana from "./pages/guides/MadridMalasana";
import IsMassageGoodForYou from "./pages/guides/IsMassageGoodForYou";
import YourFirstMassageInMadrid from "./pages/guides/YourFirstMassageInMadrid";
import ConfirmHoursRedirect from "./app/screens/ConfirmHoursRedirect";
import BookingActionRedirect from "./app/screens/BookingActionRedirect";
import RouteTracker from "./lib/RouteTracker";
import ConsentBanner from "./components/ConsentBanner";
import AnalyticsOptOut from "./components/AnalyticsOptOut";
import ThanksToast from "./components/ThanksToast";







const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <RouteTracker />
        <ConsentBanner />
        <AnalyticsOptOut />

        <Routes>
          <Route path="/booking-result" element={<BookingResult />} />
          <Route path="/review" element={<Review />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />

          {/* SEO guide pages (static paths win over the /:studioId dynamic route) */}
          <Route path="/massage-in-english-madrid" element={<MassageInEnglishMadrid />} />
          <Route path="/guides/massage-prices-madrid" element={<MassagePricesMadrid />} />
          <Route path="/guides/massage-prices-madrid-study" element={<MassagePricesMadridStudy />} />

          <Route path="/guides/deep-tissue-massage-madrid" element={<DeepTissueMassageMadrid />} />
          <Route path="/madrid/chamberi" element={<MadridChamberi />} />
          <Route path="/madrid/salamanca" element={<MadridSalamanca />} />
          <Route path="/madrid/chamartin" element={<MadridChamartin />} />
          <Route path="/madrid/chueca" element={<MadridChueca />} />
          <Route path="/madrid/centro" element={<MadridCentro />} />
          <Route path="/madrid/malasana" element={<MadridMalasana />} />
          <Route path="/guides/is-massage-good-for-you" element={<IsMassageGoodForYou />} />
          <Route path="/guides/your-first-massage-in-madrid" element={<YourFirstMassageInMadrid />} />

          {/* Branded forwarder for the "confirm your opening hours" email link.
              Preserves query string and hash, then hops to the Supabase edge function. */}
          <Route path="/confirm-hours" element={<ConfirmHoursRedirect />} />

          {/* Per-studio pretty hours link: book.massageclub.io/spa-calma/hours?c=ab12cd */}
          <Route path="/:studioId/hours" element={<ConfirmHoursRedirect />} />

          {/* Branded forwarder for one-tap booking action links in emails.
              Preserves query string and hash, then hops to the Supabase edge function. */}
          <Route path="/booking-action" element={<BookingActionRedirect />} />

          {/* On the booking subdomain (book.<domain>), the root path IS the studio:
              book.massageclub.io/art-thai-massage → that studio's booking page. */}
          {typeof window !== "undefined" && window.location.hostname.startsWith("book.") ? (
            <Route path="/:studioId" element={<StudioBookingPage />} />
          ) : (
            <Route path="/" element={<Home />} />
          )}

          <Route path="/web" element={<Web />} />
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
          {/* Canonical studio list route */}
          <Route path="/studios" element={<AppLayout />}>
            <Route index element={<MassageList />} />
          </Route>

          <Route path="/app" element={<AppLayout />}>
            {/* /app duplicated the homepage — send it to the single homepage */}
            <Route index element={<Navigate to="/" replace />} />
            <Route path="massages" element={<Navigate to="/studios" replace />} />
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
          {/* Partner Portal Routes */}
          <Route path="/partner/onboarding" element={<PartnerOnboarding />} />
          <Route path="/partner" element={<PartnerLogin />} />
          <Route path="/partner/login" element={<PartnerLogin />} />
          <Route path="/partner/reset-password" element={<PartnerResetPassword />} />
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
          {/* Permanent redirect for renamed Calma slug */}
          <Route path="/calma-madrid-spa" element={<Navigate to="/spa-calma" replace />} />
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