import { Outlet } from "react-router-dom";
import { BookingProvider } from "./BookingContext";
import { MobileFrame } from "./MobileFrame";

export default function AppLayout() {
  return (
    <BookingProvider>
      <MobileFrame>
        <Outlet />
      </MobileFrame>
    </BookingProvider>
  );
}
