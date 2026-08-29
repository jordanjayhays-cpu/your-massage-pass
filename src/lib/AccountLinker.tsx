import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { applyPendingAccount } from "@/lib/pendingAccount";

/**
 * Mounted once, app wide. The magic link can land minutes after the booking,
 * so whenever a session appears we finish the job: fill the profile from the
 * booking details and attach the request to the account.
 */
export default function AccountLinker() {
  useEffect(() => {
    void applyPendingAccount();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") void applyPendingAccount();
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  return null;
}
