import { createContext, useContext, type ReactNode } from "react";
import { Outlet } from "react-router-dom";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

/** true inside a tree that already draws SiteHeader and SiteFooter. */
const ChromeDrawn = createContext(false);

/**
 * SiteHeader above the page and SiteFooter below it, from 900px up (desktop
 * fixes F11 and F12). Below 900px both render nothing, so phones keep each
 * page's own header and footer exactly as they are.
 *
 * It draws once per tree: a nested SiteChrome (for example NotFound shown by a
 * page that is already wrapped) only renders its children. MobileFrame draws
 * the header and footer itself and marks its tree with SiteChromeDrawn.
 */
export function SiteChrome({ children, footer = true }: { children: ReactNode; footer?: boolean }) {
  const drawn = useContext(ChromeDrawn);
  if (drawn) return <>{children}</>;
  return (
    <ChromeDrawn.Provider value={true}>
      <SiteHeader />
      {children}
      {footer && <SiteFooter />}
    </ChromeDrawn.Provider>
  );
}

/** Marks a tree whose layout already places SiteHeader and SiteFooter. */
export function SiteChromeDrawn({ children }: { children: ReactNode }) {
  return <ChromeDrawn.Provider value={true}>{children}</ChromeDrawn.Provider>;
}

/** Layout route: wraps every child route in SiteChrome (used in App.tsx). */
export function SiteChromeLayout() {
  return (
    <SiteChrome>
      <Outlet />
    </SiteChrome>
  );
}

export default SiteChrome;
