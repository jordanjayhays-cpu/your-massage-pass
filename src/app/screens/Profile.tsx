import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Loader2, LogOut, ArrowLeft, UserCircle2 } from "lucide-react";

const PRESSURES = ["Light", "Medium", "Firm", "Deep"];
const FOCUS = ["Neck", "Shoulders", "Upper Back", "Lower Back", "Legs", "Feet", "Arms", "Hands"];
const MEDICALS = ["High blood pressure", "Heart condition", "Diabetes", "Blood clots / DVT", "Pregnant", "Recent surgery", "Cancer", "Epilepsy", "Skin condition"];

export default function Profile() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<any>(null);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [pressure, setPressure] = useState("Medium");
  const [focusAreas, setFocusAreas] = useState<string[]>([]);
  const [allergies, setAllergies] = useState("");
  const [healthNotes, setHealthNotes] = useState("");

  const [reasonForVisit, setReasonForVisit] = useState("");
  const [medicalConditions, setMedicalConditions] = useState<string[]>([]);
  const [medications, setMedications] = useState("");
  const [pastSurgeries, setPastSurgeries] = useState("");
  const [avoidAreas, setAvoidAreas] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [isFirstMassage, setIsFirstMassage] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (user) {
        const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
        setFullName(data?.full_name || user.user_metadata?.full_name || user.user_metadata?.name || "");
        setPhone(data?.phone || "");
        setPressure(data?.preferred_pressure || "Medium");
        setFocusAreas(data?.focus_areas || []);
        setAllergies(data?.allergies || "");
        setHealthNotes(data?.health_notes || "");
        setReasonForVisit(data?.reason_for_visit || "");
        setMedicalConditions(data?.medical_conditions || []);
        setMedications(data?.medications || "");
        setPastSurgeries(data?.past_surgeries || "");
        setAvoidAreas(data?.avoid_areas || "");
        setEmergencyName(data?.emergency_contact_name || "");
        setEmergencyPhone(data?.emergency_contact_phone || "");
        setIsFirstMassage(!!data?.is_first_massage);
        setConsentAccepted(!!data?.consent_accepted);
      }
      setLoading(false);
    })();
  }, []);

  const toggleFocus = (v: string) =>
    setFocusAreas(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      full_name: fullName,
      phone,
      preferred_pressure: pressure,
      focus_areas: focusAreas,
      allergies,
      health_notes: healthNotes,
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" });
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Profile saved");
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf6ee]">
        <Loader2 className="h-7 w-7 animate-spin text-[#A21228]" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#faf6ee] text-center px-6">
        <div className="h-16 w-16 rounded-full bg-[#A21228]/10 flex items-center justify-center mb-4">
          <UserCircle2 className="h-8 w-8 text-[#A21228]" />
        </div>
        <h1 className="text-xl font-bold text-gray-900">Sign in to set up your profile</h1>
        <p className="text-sm text-gray-500 mt-1 max-w-xs">
          Save your preferences so every studio knows how you like your massage.
        </p>
        <button
          onClick={() => navigate("/")}
          className="mt-6 h-12 px-6 rounded-full bg-[#A21228] text-white font-semibold shadow-lg"
        >
          Sign in
        </button>
      </div>
    );
  }

  const chip = (active: boolean) =>
    `px-3 py-2 rounded-full text-sm font-medium border transition ${
      active
        ? "bg-[#A21228] text-white border-[#A21228]"
        : "bg-white text-gray-700 border-gray-200 hover:border-gray-300"
    }`;

  return (
    <div className="min-h-screen bg-[#faf6ee] pb-32">
      <div className="max-w-lg mx-auto px-5 pt-6">
        <button
          onClick={() => navigate("/app/bookings")}
          className="flex items-center gap-1 text-sm text-gray-500 mb-3"
        >
          <ArrowLeft size={14} /> Back
        </button>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">My profile</h1>
          <button
            onClick={signOut}
            className="flex items-center gap-1 text-sm text-gray-500 px-3 py-1.5 rounded-full border border-gray-200 bg-white"
          >
            <LogOut size={14} /> Sign out
          </button>
        </div>

        <div className="mt-6 space-y-5 bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Full name</label>
            <input
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              className="mt-1 w-full h-11 px-3 rounded-xl border border-gray-200 bg-white"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</label>
            <input
              value={user.email || ""}
              readOnly
              className="mt-1 w-full h-11 px-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Phone</label>
            <input
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+34 ..."
              className="mt-1 w-full h-11 px-3 rounded-xl border border-gray-200 bg-white"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Preferred pressure</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {PRESSURES.map(p => (
                <button key={p} type="button" onClick={() => setPressure(p)} className={chip(pressure === p)}>
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Focus areas</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {FOCUS.map(f => (
                <button key={f} type="button" onClick={() => toggleFocus(f)} className={chip(focusAreas.includes(f))}>
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Allergies</label>
            <input
              value={allergies}
              onChange={e => setAllergies(e.target.value)}
              placeholder="e.g. nut oils"
              className="mt-1 w-full h-11 px-3 rounded-xl border border-gray-200 bg-white"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Health notes</label>
            <textarea
              value={healthNotes}
              onChange={e => setHealthNotes(e.target.value)}
              rows={4}
              placeholder="Injuries, pregnancy, areas to avoid…"
              className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-200 bg-white"
            />
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 inset-x-0 bg-[#faf6ee]/95 backdrop-blur border-t border-gray-200 px-5 py-3">
        <div className="max-w-lg mx-auto">
          <button
            onClick={save}
            disabled={saving}
            className="w-full h-12 rounded-full bg-[#A21228] text-white font-semibold shadow-lg disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
