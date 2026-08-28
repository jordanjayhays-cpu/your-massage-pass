import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LocationAskProvider } from "@/lib/locationConsent";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
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
import PartnerAddons from "./app/screens/PartnerAddons";
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
import StudioIdRedirect from "./app/screens/StudioIdRedirect";
import PartnerPhotos from "./app/screens/PartnerPhotos";
import PartnerClients from "./app/screens/PartnerClients";
import MyBookings from "./app/screens/MyBookings";
import Profile from "./app/screens/Profile";
import Web from "./pages/Web";
import Home from "./pages/Home";
import BookingResult from "./pages/BookingResult";
import Welcome from "./pages/Welcome";
import Compare from "./pages/Compare";
import MassageTypePage from "./pages/MassageTypePage";
import { MASSAGE_TYPE_SLUGS } from "./lib/massageTypes";

/**
 * Permanent redirect from the old /fb route to /start, preserving query
 * params and hash so existing ad links keep working.
 */
function FbRedirect() {
  const { search, hash } = useLocation();
  return <Navigate to={`/start${search}${hash}`} replace />;
}

/**
 * Generic permanent redirect that preserves query params and hash.
 * Used for common singular/plural and trailing-slash near-misses.
 */
function Redirect({ to }: { to: string }) {
  const { search, hash } = useLocation();
  return <Navigate to={`${to}${search}${hash}`} replace />;
}







import Review from "./pages/Review";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import ForStudios from "./pages/ForStudios";
import Request from "./pages/Request";
import BookFlow from "./pages/BookFlow";
import FbLanding from "./pages/FbLanding";

import HowItWorks from "./pages/HowItWorks";
import Notify from "./pages/Notify";
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
import StudioHours from "./pages/StudioHours";
import BookingActionRedirect from "./app/screens/BookingActionRedirect";
import RouteTracker from "./lib/RouteTracker";
import ConsentBanner from "./components/ConsentBanner";
import AnalyticsOptOut from "./components/AnalyticsOptOut";
import ThanksToast from "./components/ThanksToast";
import WhatsAppBubble from "./app/components/WhatsAppBubble";







const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <LocationAskProvider>
        <RouteTracker />
        <ConsentBanner />
        <AnalyticsOptOut />
        <ThanksToast />
        <WhatsAppBubble />

        <Routes>
          <Route path="/booking-result" element={<BookingResult />} />
          <Route path="/welcome" element={<Welcome />} />

          <Route path="/compare" element={<Compare />} />
          <Route path="/review" element={<Review />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />

          {/* Public lead-capture pages shared on WhatsApp */}
          <Route path="/book" element={<BookFlow />} />
          <Route path="/start" element={<FbLanding />} />
          <Route path="/fb" element={<FbRedirect />} />

          {/* Common near-miss redirects - keep them before the /:studioId catch-all */}
          <Route path="/studio" element={<Redirect to="/studios" />} />
          <Route path="/massages" element={<Redirect to="/studios" />} />
          <Route path="/booking" element={<Redirect to="/book" />} />
          {/* NOTE: no "/start/" route - React Router treats it as "/start", so a
              redirect there loops forever and renders a blank page. */}



          <Route path="/request" element={<Request />} />
          <Route path="/notify" element={<Notify />} />
          <Route path="/how-it-works" element={<HowItWorks />} />

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

          {/* Standalone massage type pages (static slugs win over /massages/:id) */}
          {MASSAGE_TYPE_SLUGS.map((slug) => (
            <Route key={slug} path={`/massages/${slug}`} element={<MassageTypePage slug={slug} />} />
          ))}



          {/* Branded forwarder for the "confirm your opening hours" email link.
              Preserves query string and hash, then hops to the Supabase edge function. */}
          <Route path="/confirm-hours" element={<ConfirmHoursRedirect />} />

          {/* Per-studio pretty hours link: book.massageclub.io/spa-calma/hours?c=ab12cd */}
          <Route path="/:studioId/hours" element={<StudioHours />} />

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
          {/* Customer email sign-in */}
          <Route path="/login" element={<AppLayout />}>
            <Route index element={<Login />} />
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
          <Route path="/partner/addons" element={<PartnerAddons />} />
          <Route path="/partner/calendar" element={<PartnerCalendar />} />
          <Route path="/partner/connect-calendar" element={<PartnerConnectCalendar />} />
          <Route path="/partner/photos" element={<PartnerPhotos />} />
          <Route path="/partner/clients" element={<PartnerClients />} />
          <Route path="/survey" element={<Survey />} />
          <Route path="/survey/customers" element={<SurveyCustomers />} />
          <Route path="/survey/studios" element={<SurveyStudios />} />
          <Route path="/founder" element={<FounderDashboard />} />
          {/* Shareable public booking page (goes on Google Maps / WhatsApp) */}
          {/* Legacy id links stay alive, redirecting to the canonical /{slug} URL. */}
          <Route path="/s/:studioId" element={<StudioIdRedirect />} />
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
          {/* Studio terms page */}
          <Route path="/for-studios" element={<ForStudios />} />
          <Route path="/para-estudios" element={<ForStudios />} />

          {/* Canonical studio URL on every host: /{slug} */}
          <Route path="/:studioId" element={<StudioBookingPage />} />

          <Route path="*" element={<NotFound />} />
        </Routes>
        </LocationAskProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;