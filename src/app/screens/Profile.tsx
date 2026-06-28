import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Loader2, LogOut, ArrowLeft, Camera, UserCircle } from "lucide-react";

const PRESSURES = ["Light", "Medium", "Firm", "Deep"];
const FOCUS = ["Neck", "Shoulders", "Upper Back", "Lower Back", "Legs", "Feet", "Arms", "Hands"];
const MEDICALS = ["High blood pressure", "Heart condition", "Diabetes", "Blood clots / DVT", "Pregnant", "Recent surgery", "Cancer", "Epilepsy", "Skin condition"];
const GENDERS = ["Female", "Male", "Other", "Prefer not to say"];
const THERAPIST_GENDERS: { label: string; value: string }[] = [
  { label: "No preference", value: "any" },
  { label: "Female", value: "female" },
  { label: "Male", value: "male" },
];
const MASSAGE_TYPES: { label: string; value: string }[] = [
  { label: "Swedish", value: "swedish" },
  { label: "Deep Tissue", value: "deep" },
  { label: "Thai", value: "thai" },
  { label: "Sports", value: "sports" },
  { label: "Hot Stone", value: "stone" },
  { label: "Aromatherapy", value: "aromatherapy" },
  { label: "Reflexology", value: "reflexology" },
  { label: "Shiatsu", value: "shiatsu" },
  { label: "Balinese", value: "balinese" },
  { label: "Lymphatic", value: "lymphatic" },
  { label: "Prenatal", value: "prenatal" },
];
const DURATIONS = [30, 60, 90, 120];
const BUDGETS: { label: string; value: string }[] = [
  { label: "Under €40", value: "under_40" },
  { label: "€40–60", value: "40_60" },
  { label: "€60–90", value: "60_90" },
  { label: "€90+", value: "90_plus" },
];
const ADDONS: { label: string; value: string }[] = [
  { label: "Aromatherapy", value: "aromatherapy" },
  { label: "Hot stones", value: "hot_stones" },
  { label: "Scalp massage", value: "scalp" },
  { label: "Foot scrub", value: "foot_scrub" },
  { label: "CBD oil", value: "cbd" },
  { label: "Cupping", value: "cupping" },
  { label: "Extra 15 min", value: "extra_time" },
];
const FREQUENCIES: { label: string; value: string }[] = [
  { label: "Weekly", value: "weekly" },
  { label: "Monthly", value: "monthly" },
  { label: "A few times a year", value: "few_times_year" },
  { label: "Rarely / first time", value: "rarely" },
];
const GOALS: { label: string; value: string }[] = [
  { label: "Relaxation", value: "relaxation" },
  { label: "Pain & tension relief", value: "pain_relief" },
  { label: "Sports recovery", value: "sports_recovery" },
  { label: "Better sleep", value: "sleep" },
  { label: "Stress & anxiety", value: "stress" },
  { label: "Injury rehab", value: "injury_rehab" },
  { label: "Pampering", value: "pampering" },
];

export default function Profile() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Avatar
  const [avatarUrl, setAvatarUrl] = useState("");

  // Personal details
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [city, setCity] = useState("");
  const [preferredLanguage, setPreferredLanguage] = useState("");

  // New preferences
  const [preferredMassageTypes, setPreferredMassageTypes] = useState<string[]>([]);
  const [preferredDuration, setPreferredDuration] = useState<number | null>(null);
  const [typicalBudget, setTypicalBudget] = useState("");
  const [usualAddons, setUsualAddons] = useState<string[]>([]);
  const [massageFrequency, setMassageFrequency] = useState("");
  const [massageGoals, setMassageGoals] = useState<string[]>([]);

  // Massage preferences
  const [pressure, setPressure] = useState("");
  const [preferredTherapistGender, setPreferredTherapistGender] = useState("");
  const [focusAreas, setFocusAreas] = useState<string[]>([]);
  const [allergies, setAllergies] = useState("");
  const [healthNotes, setHealthNotes] = useState("");

  // Health & safety
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

        const metaFull = user.user_metadata?.full_name || user.user_metadata?.name || "";
        const derivedFirst = metaFull.split(" ")[0] || "";
        const derivedLast = metaFull.split(" ").slice(1).join(" ") || "";

        setFirstName(data?.first_name || derivedFirst);
        setLastName(data?.last_name || derivedLast);
        setAvatarUrl(data?.avatar_url || "");
        setPhone(data?.phone || "");
        setDateOfBirth(data?.date_of_birth || "");
        setGender(data?.gender || "");
        setCity(data?.city || "");
        setPreferredLanguage(data?.preferred_language || "");

        setPressure(data?.preferred_pressure || "");
        setPreferredTherapistGender(data?.preferred_therapist_gender || "");
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

        setPreferredMassageTypes(data?.preferred_massage_types || []);
        setPreferredDuration(typeof data?.preferred_duration === "number" ? data.preferred_duration : null);
        setTypicalBudget(data?.typical_budget || "");
        setUsualAddons(data?.usual_addons || []);
        setMassageFrequency(data?.massage_frequency || "");
        setMassageGoals(data?.massage_goals || []);
      }
      setLoading(false);
    })();
  }, []);

  const toggleFocus = (v: string) =>
    setFocusAreas(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);

  const toggleMedical = (v: string) =>
    setMedicalConditions(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingPhoto(true);
    const path = `${user.id}/${Date.now()}-${file.name}`;
    const { error: upError } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (upError) {
      toast.error("Photo upload failed: " + upError.message);
      setUploadingPhoto(false);
      return;
    }
    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    const publicUrl = urlData?.publicUrl || "";
    setAvatarUrl(publicUrl);
    const { error: dbError } = await supabase.from("profiles").upsert({
      id: user.id,
      avatar_url: publicUrl || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" });
    if (dbError) {
      toast.error("Photo saved, but profile update failed: " + dbError.message);
    } else {
      toast.success("Photo updated");
    }
    setUploadingPhoto(false);
  };

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const full_name = `${firstName} ${lastName}`.trim();
    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      first_name: firstName || null,
      last_name: lastName || null,
      full_name: full_name || null,
      avatar_url: avatarUrl || null,
      phone: phone || null,
      date_of_birth: dateOfBirth || null,
      gender: gender || null,
      city: city || null,
      preferred_language: preferredLanguage || null,
      preferred_pressure: pressure || null,
      preferred_therapist_gender: preferredTherapistGender || null,
      focus_areas: focusAreas.length ? focusAreas : null,
      allergies: allergies || null,
      health_notes: healthNotes || null,
      reason_for_visit: reasonForVisit || null,
      medical_conditions: medicalConditions.length ? medicalConditions : null,
      medications: medications || null,
      past_surgeries: pastSurgeries || null,
      avoid_areas: avoidAreas || null,
      emergency_contact_name: emergencyName || null,
      emergency_contact_phone: emergencyPhone || null,
      is_first_massage: isFirstMassage,
      consent_accepted: consentAccepted,
      consent_at: consentAccepted ? new Date().toISOString() : null,
      preferred_massage_types: preferredMassageTypes.length ? preferredMassageTypes : null,
      preferred_duration: preferredDuration ?? null,
      typical_budget: typicalBudget || null,
      usual_addons: usualAddons.length ? usualAddons : null,
      massage_frequency: massageFrequency || null,
      massage_goals: massageGoals.length ? massageGoals : null,
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

  const chip = (active: boolean) =>
    `px-3 py-2 rounded-full text-sm font-medium border transition ${
      active
        ? "bg-[#C4622D] text-white border-[#C4622D]"
        : "bg-white text-gray-700 border-gray-200 hover:border-gray-300"
    }`;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F4F0]">
        <Loader2 className="h-7 w-7 animate-spin text-[#C4622D]" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F7F4F0] text-center px-6">
        <div className="h-16 w-16 rounded-full bg-[#C4622D]/10 flex items-center justify-center mb-4">
          <UserCircle className="h-8 w-8 text-[#C4622D]" />
        </div>
        <h1 className="text-xl font-bold text-gray-900">Sign in to set up your profile</h1>
        <p className="text-sm text-gray-500 mt-1 max-w-xs">
          Save your preferences so every studio knows how you like your massage.
        </p>
        <button
          onClick={() => navigate("/")}
          className="mt-6 h-12 px-6 rounded-full bg-[#C4622D] text-white font-semibold shadow-lg"
        >
          Sign in
        </button>
      </div>
    );
  }

  const avatarLetter = (firstName || user.user_metadata?.full_name || user.email || "?").charAt(0).toUpperCase();

  return (
    <div className="h-full overflow-y-auto bg-[#F7F4F0]">
      <div className="max-w-lg mx-auto px-5 pt-6 pb-8">
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

        {/* Photo header */}
        <div className="mt-6 flex flex-col items-center">
          <div className="relative">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="avatar"
                className="h-24 w-24 rounded-full object-cover border-2 border-gray-200"
              />
            ) : (
              <div className="h-24 w-24 rounded-full bg-[#C4622D] text-white flex items-center justify-center text-3xl font-bold border-2 border-[#C4622D]">
                {avatarLetter}
              </div>
            )}
            {uploadingPhoto && (
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/30">
                <Loader2 className="h-6 w-6 animate-spin text-white" />
              </div>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePhotoSelect}
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="mt-3 flex items-center gap-1.5 text-sm font-medium text-[#C4622D] bg-white border border-gray-200 px-4 py-2 rounded-full hover:bg-gray-50"
          >
            <Camera size={16} /> Change photo
          </button>
        </div>

        {/* Personal details card */}
        <div className="mt-6 bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-5">
          <h2 className="text-lg font-bold text-gray-900">Personal details</h2>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">First name</label>
              <input
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                className="mt-1 w-full h-11 px-3 rounded-xl border border-gray-200 bg-white"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Last name</label>
              <input
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                className="mt-1 w-full h-11 px-3 rounded-xl border border-gray-200 bg-white"
              />
            </div>
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
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Date of birth</label>
            <input
              type="date"
              value={dateOfBirth}
              onChange={e => setDateOfBirth(e.target.value)}
              className="mt-1 w-full h-11 px-3 rounded-xl border border-gray-200 bg-white"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Gender</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {GENDERS.map(g => (
                <button key={g} type="button" onClick={() => setGender(g)} className={chip(gender === g)}>
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">City</label>
            <input
              value={city}
              onChange={e => setCity(e.target.value)}
              placeholder="e.g. Madrid"
              className="mt-1 w-full h-11 px-3 rounded-xl border border-gray-200 bg-white"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Preferred language</label>
            <input
              value={preferredLanguage}
              onChange={e => setPreferredLanguage(e.target.value)}
              placeholder="e.g. English, Spanish"
              className="mt-1 w-full h-11 px-3 rounded-xl border border-gray-200 bg-white"
            />
          </div>
        </div>

        {/* Massage preferences card */}
        <div className="mt-5 bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-5">
          <h2 className="text-lg font-bold text-gray-900">Massage preferences</h2>

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
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Preferred therapist</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {THERAPIST_GENDERS.map(t => (
                <button key={t.value} type="button" onClick={() => setPreferredTherapistGender(t.value)} className={chip(preferredTherapistGender === t.value)}>
                  {t.label}
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

          <div className="pt-2 border-t border-gray-100">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Preferred massage types</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {MASSAGE_TYPES.map(t => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() =>
                    setPreferredMassageTypes(prev =>
                      prev.includes(t.value) ? prev.filter(x => x !== t.value) : [...prev, t.value]
                    )
                  }
                  className={chip(preferredMassageTypes.includes(t.value))}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Typical session length</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {DURATIONS.map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setPreferredDuration(preferredDuration === d ? null : d)}
                  className={chip(preferredDuration === d)}
                >
                  {d} min
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Typical budget</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {BUDGETS.map(b => (
                <button
                  key={b.value}
                  type="button"
                  onClick={() => setTypicalBudget(typicalBudget === b.value ? "" : b.value)}
                  className={chip(typicalBudget === b.value)}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Usual add-ons</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {ADDONS.map(a => (
                <button
                  key={a.value}
                  type="button"
                  onClick={() =>
                    setUsualAddons(prev =>
                      prev.includes(a.value) ? prev.filter(x => x !== a.value) : [...prev, a.value]
                    )
                  }
                  className={chip(usualAddons.includes(a.value))}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">How often you get a massage</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {FREQUENCIES.map(f => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setMassageFrequency(massageFrequency === f.value ? "" : f.value)}
                  className={chip(massageFrequency === f.value)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Main goals</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {GOALS.map(g => (
                <button
                  key={g.value}
                  type="button"
                  onClick={() =>
                    setMassageGoals(prev =>
                      prev.includes(g.value) ? prev.filter(x => x !== g.value) : [...prev, g.value]
                    )
                  }
                  className={chip(massageGoals.includes(g.value))}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Health & safety card */}
        <div className="mt-5 bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-5">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Health &amp; safety</h2>
            <p className="text-xs text-gray-500">Private — only shared with your therapist</p>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Reason for visit / goals</label>
            <textarea
              value={reasonForVisit}
              onChange={e => setReasonForVisit(e.target.value)}
              rows={3}
              placeholder="e.g. lower back pain from desk work"
              className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-200 bg-white"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Medical conditions</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {MEDICALS.map(m => (
                <button key={m} type="button" onClick={() => toggleMedical(m)} className={chip(medicalConditions.includes(m))}>
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Medications</label>
            <input
              value={medications}
              onChange={e => setMedications(e.target.value)}
              placeholder="e.g. blood thinners"
              className="mt-1 w-full h-11 px-3 rounded-xl border border-gray-200 bg-white"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Past surgeries / injuries</label>
            <textarea
              value={pastSurgeries}
              onChange={e => setPastSurgeries(e.target.value)}
              rows={3}
              placeholder="e.g. shoulder surgery 2022"
              className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-200 bg-white"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Areas to avoid</label>
            <input
              value={avoidAreas}
              onChange={e => setAvoidAreas(e.target.value)}
              placeholder="e.g. left knee"
              className="mt-1 w-full h-11 px-3 rounded-xl border border-gray-200 bg-white"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Emergency contact</label>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <input
                value={emergencyName}
                onChange={e => setEmergencyName(e.target.value)}
                placeholder="Name"
                className="w-full h-11 px-3 rounded-xl border border-gray-200 bg-white"
              />
              <input
                value={emergencyPhone}
                onChange={e => setEmergencyPhone(e.target.value)}
                placeholder="Phone"
                className="w-full h-11 px-3 rounded-xl border border-gray-200 bg-white"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input
              id="firstMassage"
              type="checkbox"
              checked={isFirstMassage}
              onChange={e => setIsFirstMassage(e.target.checked)}
              className="h-5 w-5 rounded border-gray-300 text-[#C4622D] focus:ring-[#C4622D]"
            />
            <label htmlFor="firstMassage" className="text-sm text-gray-700">Is this your first professional massage?</label>
          </div>

          <div className="flex items-start gap-3 pt-2">
            <input
              id="consent"
              type="checkbox"
              checked={consentAccepted}
              onChange={e => setConsentAccepted(e.target.checked)}
              className="mt-0.5 h-5 w-5 rounded border-gray-300 text-[#C4622D] focus:ring-[#C4622D]"
            />
            <label htmlFor="consent" className="text-sm text-gray-700 leading-relaxed">
              I confirm the above is accurate and consent to treatment.
            </label>
          </div>
        </div>
      </div>

      {/* Sticky Save */}
      <div className="sticky bottom-0 inset-x-0 bg-[#F7F4F0]/95 backdrop-blur border-t border-gray-200 px-5 py-3">
        <div className="max-w-lg mx-auto">
          <button
            onClick={save}
            disabled={saving}
            className="w-full h-12 rounded-full bg-[#C4622D] text-white font-semibold shadow-lg disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
