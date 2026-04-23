import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://jglftdstrowwckwqmpue.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpnbGZ0ZHN0cm93d2Nrd3FtcHVlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTY0ODQ2MTg3NywiZXhwIjoxOTY0MDM3ODc3fQ.DpLS2hS3a6JNFtSvLNJcL-T6M3F0Rp3Fz8lTQT5VxJQ";

export const supabase = createClient(supabaseUrl, supabaseKey);

export interface Booking {
  id?: number;
  client_name: string;
  client_email: string;
  client_phone?: string;
  spa_name: string;
  massage_type: string;
  booking_date: string;
  booking_time: string;
  duration: number;
  pressure?: string;
  focus_areas?: string[];
  add_ons?: string[];
  notes?: string;
  status: "pending" | "confirmed" | "cancelled";
  created_at?: string;
}

export interface Lead {
  id?: number;
  email: string;
  name?: string;
  source: string;
  created_at?: string;
}

export async function saveBooking(booking: Omit<Booking, "id" | "created_at">): Promise<{ success: boolean; ref?: string }> {
  try {
    const { data, error } = await supabase
      .from("bookings")
      .insert([booking])
      .select("id")
      .single();

    if (error) {
      console.error("Supabase booking error:", error);
      return { success: false };
    }

    const ref = `MR-2026-${String(data.id).padStart(4, "0")}`;
    return { success: true, ref };
  } catch (err) {
    console.error("Booking save error:", err);
    return { success: false };
  }
}

export async function saveLead(email: string, name: string, source: string): Promise<boolean> {
  try {
    const { error } = await supabase.from("leads").insert([{ email, name, source }]);
    if (error) {
      // Duplicate email is fine
      if (error.code !== "23505") console.error("Lead save error:", error);
    }
    return true;
  } catch {
    return false;
  }
}
