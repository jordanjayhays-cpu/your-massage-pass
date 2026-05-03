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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
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
          </Route>
          <Route path="/landing" element={<Index />} />
          {/* Partner Portal Routes */}
          <Route path="/partner/onboarding" element={<PartnerOnboarding />} />
          <Route path="/partner" element={<PartnerLogin />} />
          <Route path="/partner/dashboard" element={<PartnerDashboard />} />
          <Route path="/partner/profile" element={<PartnerProfile />} />
          <Route path="/partner/services" element={<PartnerServices />} />
          <Route path="/partner/calendar" element={<PartnerCalendar />} />
          <Route path="/partner/connect-calendar" element={<PartnerConnectCalendar />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
