import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import {
  Loader2, Check, MapPin, Phone, Globe, Plus, Trash2,
  Sparkles, ChevronRight, ChevronLeft, Euro, CheckCircle2
} from "lucide-react";

const MAPS_KEY = "AIzaSyDx4a7iq1lt4LItVg44_kDmzvlpK7Ftldo";
const MASSAGE_TYPES = ["Swedish", "Deep Tissue", "Hot Stone", "Sports", "Aromatherapy", "Thai", "Shiatsu", "Couples", "Facial", "Other"];
const DAYS = [
  { num: 1, label: "Mon" }, { num: 2, label: "Tue" }, { num: 3, label: "Wed" },
  { num: 4, label: "Thu" }, { num: 5, label: "Fri" }, { num: 6, label: "Sat" }, { num: 0, label: "Sun" },
];
const DEFAULT_SLOTS = ["09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00"];

type Service = { name: string; type: string; duration: number; price: number; description: string };

function StudioSetupInner() {
  const searchParams = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [step, setStep] = useState(1);
  const TOTAL_STEPS = 5;

  // Invite data
  const [inviteData, setInviteData] = useState<any>(null);
  const [inviteError, setInviteError] = useState("");
  const [validatingToken, setValidatingToken] = useState(true);

  // Step 1: Account
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [accountLoading, setAccountLoading] = useState(false);
  const [partnerId, setPartnerId] = useState<string | null>(null);

  // Step 2: Profile
  const [studio, setStudio] = useState({ business_name: "", address: "", phone: "", website: "", description: "", city: "Madrid" });
  const [profileLoading, setProfileLoading] = useState(false);

  // Step 3: Services
  const [services, setServices] = useState<Service[]>([
    { name: "", type: "Swedish", duration: 60, price: 45, description: "" }
  ]);

  // Step 4: Availability
  const [availability, setAvailability] = useState<Record<number, string[]>>({
    1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 0: [],
  });

  // Validate token on mount
  useEffect(() => {
    if (!token) { setInviteError("No token provided"); setValidatingToken(false); return; }
    supabase
      .from("invites")
      .select("*")
      .eq("token", token)
      .eq("used", false)
      .single()
      .then(({ data, error }) => {
        if (error || !data) { setInviteError("Invalid or expired invite link"); }
        else {
          setInviteData(data);
          setEmail(data.email || "");
          setStudio(prev => ({ ...prev, business_name: data.studio_name || "" }));
        }
        setValidatingToken(false);
      });
  }, [token]);

  // Progress
  const progress = (step / TOTAL_STEPS) * 100;

  // Step 1: Create account
  const handleCreateAccount = async () => {
    if (!password || password !== confirmPassword) { toast.error("Passwords don't match"); return; }
    if (password.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    setAccountLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: { data: { business_name: inviteData?.studio_name } }
      });
      if (error) throw error;
      if (!data.user) throw new Error("No user returned");

      // Mark invite as used
      await supabase.from("invites").update({ used: true }).eq("token", token);

      setPartnerId(data.user.id);
      toast.success("Account created!");
      setStep(2);
    } catch (err: any) {
      toast.error(err.message || "Failed to create account");
    } finally {
      setAccountLoading(false);
    }
  };

  // Step 2: Save profile
  const handleSaveProfile = async () => {
    if (!studio.business_name.trim()) { toast.error("Studio name is required"); return; }
    setProfileLoading(true);
    try {
      await supabase.from("partners").upsert({
        id: partnerId || (await supabase.auth.getUser()).data.user?.id,
        business_name: studio.business_name,
        email,
        address: studio.address,
        phone: studio.phone,
        website: studio.website,
        description: studio.description,
        city: studio.city,
        status: "active",
      });
      toast.success("Profile saved!");
      setStep(3);
    } catch (err: any) {
      toast.error(err.message || "Failed to save profile");
    } finally {
      setProfileLoading(false);
    }
  };

  // Step 3: Save services
  const handleSaveServices = async () => {
    const validServices = services.filter(s => s.name.trim());
    if (validServices.length === 0) { toast.error("Add at least one service"); return; }
    try {
      const uid = partnerId || (await supabase.auth.getUser()).data.user?.id;
      await supabase.from("partner_services").delete().eq("partner_id", uid);
      await supabase.from("partner_services").insert(
        validServices.map(s => ({ partner_id: uid, name: s.name, type: s.type, duration: s.duration, price: s.price, description: s.description }))
      );
      toast.success("Services saved!");
      setStep(4);
    } catch (err: any) {
      toast.error(err.message || "Failed to save services");
    }
  };

  // Step 4: Save availability
  const handleSaveAvailability = async () => {
    try {
      const uid = partnerId || (await supabase.auth.getUser()).data.user?.id;
      await supabase.from("partner_availability").delete().eq("partner_id", uid);
      const rows = DAYS.flatMap(day =>
        (availability[day.num] || []).map(slot => ({ partner_id: uid, day_of_week: day.num, time_slot: slot }))
      );
      if (rows.length > 0) await supabase.from("partner_availability").insert(rows);
      toast.success("Availability saved!");
      setStep(5);
    } catch (err: any) {
      toast.error(err.message || "Failed to save availability");
    }
  };

  const addService = () => setServices([...services, { name: "", type: "Swedish", duration: 60, price: 45, description: "" }]);
  const removeService = (i: number) => setServices(services.filter((_, idx) => idx !== i));
  const updateService = (i: number, field: keyof Service, value: any) => {
    const updated = [...services]; updated[i] = { ...updated[i], [field]: value }; setServices(updated);
  };
  const toggleDay = (day: number) => {
    setAvailability(prev => ({ ...prev, [day]: prev[day].length > 0 ? [] : [...DEFAULT_SLOTS] }));
  };
  const toggleSlot = (day: number, slot: string) => {
    setAvailability(prev => ({
      ...prev, [day]: prev[day].includes(slot) ? prev[day].filter(s => s !== slot) : [...prev[day], slot].sort(),
    }));
  };

  // ── Token validation loading ──
  if (validatingToken) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (inviteError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="w-full max-w-md bg-card border-border">
          <CardContent className="p-8 text-center">
            <div className="h-16 w-16 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">❌</span>
            </div>
            <h2 className="font-display text-xl font-bold mb-2">Invalid Link</h2>
            <p className="text-muted-foreground text-sm">{inviteError}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="max-w-xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-4">
          <div className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-1.5 rounded-full text-sm font-semibold mb-3">
            <Sparkles size={14} /> Studio Setup
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome, {inviteData?.studio_name}</h1>
          <p className="text-gray-500 text-sm mt-1">Complete all steps to go live on Massage Club</p>
        </div>

        {/* Progress */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-medium text-gray-500">Step {step} of {TOTAL_STEPS}</span>
            <span className="text-xs font-medium text-blue-600">{Math.round(progress)}% complete</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-blue-600 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex justify-between mt-2">
            {["Account", "Profile", "Services", "Hours", "Done"].map((label, i) => (
              <span key={label} className={`text-xs ${i + 1 === step ? "text-blue-600 font-semibold" : "text-gray-400"}`}>{label}</span>
            ))}
          </div>
        </div>

        {/* ═══════════════ STEP 1: ACCOUNT ═══════════════ */}
        {step === 1 && (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold">1</div>
                <h2 className="font-semibold text-gray-900">Create your account</h2>
              </div>
              <p className="text-sm text-gray-500 mb-4">Email is pre-filled from your invite.</p>
              <div className="space-y-3">
                <Input type="email" value={email} disabled className="bg-gray-50" />
                <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Create a password (min 8 chars)" className="h-11" />
                <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirm password" className="h-11" />
              </div>
              <Button onClick={handleCreateAccount} disabled={accountLoading} className="w-full mt-4 h-11 bg-blue-600 hover:bg-blue-700">
                {accountLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating account…</> : <>Continue <ChevronRight className="h-4 w-4 ml-2" /></>}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ═══════════════ STEP 2: PROFILE ═══════════════ */}
        {step === 2 && (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold">2</div>
                <h2 className="font-semibold text-gray-900">Studio details</h2>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Studio Name</label>
                <Input value={studio.business_name} onChange={e => setStudio(p => ({ ...p, business_name: e.target.value }))} className="h-11" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Address</label>
                <div className="relative">
                  <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <Input value={studio.address} onChange={e => setStudio(p => ({ ...p, address: e.target.value }))} placeholder="Calle Gran Vía 15, Madrid" className="pl-9 h-11" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Phone</label>
                <div className="relative">
                  <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <Input value={studio.phone} onChange={e => setStudio(p => ({ ...p, phone: e.target.value }))} placeholder="+34 600 000 000" className="pl-9 h-11" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Website (optional)</label>
                <div className="relative">
                  <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <Input value={studio.website} onChange={e => setStudio(p => ({ ...p, website: e.target.value }))} placeholder="https://yourstudio.com" className="pl-9 h-11" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Description</label>
                <textarea value={studio.description} onChange={e => setStudio(p => ({ ...p, description: e.target.value }))} placeholder="Tell members about your studio…" rows={3} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-blue-400 resize-none" />
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1 h-11"><ChevronLeft className="h-4 w-4 mr-1" /> Back</Button>
                <Button onClick={handleSaveProfile} disabled={profileLoading} className="flex-1 h-11 bg-blue-600 hover:bg-blue-700">
                  {profileLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving…</> : <>Next <ChevronRight className="h-4 w-4 ml-1" /></>}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ═══════════════ STEP 3: SERVICES ═══════════════ */}
        {step === 3 && (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold">3</div>
                <h2 className="font-semibold text-gray-900">Your services</h2>
              </div>
              <div className="space-y-3">
                {services.map((svc, i) => (
                  <div key={i} className="p-3 border border-gray-200 rounded-xl bg-white">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-medium text-gray-500">Service {i + 1}</span>
                      {services.length > 1 && <button onClick={() => removeService(i)} className="text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input value={svc.name} onChange={e => updateService(i, "name", e.target.value)} placeholder="Service name" className="col-span-2 text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400" />
                      <select value={svc.type} onChange={e => updateService(i, "type", e.target.value)} className="text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none">
                        {MASSAGE_TYPES.map(t => <option key={t}>{t}</option>)}
                      </select>
                      <div className="flex items-center gap-1 border border-gray-200 rounded-lg px-2">
                        <Euro size={13} className="text-gray-400" />
                        <input value={svc.price} onChange={e => updateService(i, "price", Number(e.target.value))} type="number" min={0} className="w-full py-2 text-sm focus:outline-none" />
                      </div>
                      <select value={svc.duration} onChange={e => updateService(i, "duration", Number(e.target.value))} className="text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none col-span-2">
                        {[30,45,60,75,90,120].map(d => <option key={d} value={d}>{d} min</option>)}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
              {services.length < 5 && (
                <button onClick={addService} className="w-full py-2.5 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-blue-400 hover:text-blue-500 transition flex items-center justify-center gap-1">
                  <Plus size={14} /> Add service
                </button>
              )}
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(2)} className="flex-1 h-11"><ChevronLeft className="h-4 w-4 mr-1" /> Back</Button>
                <Button onClick={handleSaveServices} className="flex-1 h-11 bg-blue-600 hover:bg-blue-700">Next <ChevronRight className="h-4 w-4 ml-1" /></Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ═══════════════ STEP 4: AVAILABILITY ═══════════════ */}
        {step === 4 && (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold">4</div>
                <h2 className="font-semibold text-gray-900">Availability</h2>
              </div>
              <p className="text-sm text-gray-500">Tap a day to toggle on/off. Tap times to adjust.</p>
              <div className="space-y-3">
                {DAYS.map(day => (
                  <div key={day.num}>
                    <div className="flex items-center justify-between mb-1.5">
                      <button onClick={() => toggleDay(day.num)} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${availability[day.num].length > 0 ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500"}`}>
                        {day.label}
                      </button>
                      <span className="text-xs text-gray-400">{availability[day.num].length > 0 ? `${availability[day.num].length} slots` : "Closed"}</span>
                    </div>
                    {availability[day.num].length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pl-1">
                        {DEFAULT_SLOTS.map(slot => (
                          <button key={slot} onClick={() => toggleSlot(day.num, slot)} className={`px-2 py-1 rounded-md text-xs font-medium transition ${availability[day.num].includes(slot) ? "bg-blue-100 text-blue-700 border border-blue-300" : "bg-gray-50 text-gray-400 border border-gray-200"}`}>
                            {slot}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(3)} className="flex-1 h-11"><ChevronLeft className="h-4 w-4 mr-1" /> Back</Button>
                <Button onClick={handleSaveAvailability} className="flex-1 h-11 bg-blue-600 hover:bg-blue-700">Next <ChevronRight className="h-4 w-4 ml-1" /></Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ═══════════════ STEP 5: DONE ═══════════════ */}
        {step === 5 && (
          <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-600 to-blue-700">
            <CardContent className="p-8 text-center text-white">
              <div className="h-16 w-16 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="h-8 w-8 text-white" />
              </div>
              <h2 className="font-display text-2xl font-bold mb-2">You're live on Massage Club! 🎉</h2>
              <p className="text-blue-100 text-sm mb-6">Your studio is now visible to thousands of members in Madrid.</p>
              <Button onClick={() => navigate("/studio-portal")} className="w-full h-12 bg-white text-blue-700 hover:bg-blue-50 font-semibold text-base rounded-xl">
                Go to your portal →
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default function StudioSetup() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <StudioSetupInner />
    </Suspense>
  );
}