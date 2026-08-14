import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Plus, Trash2, ChevronRight, Clock, DollarSign, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

type Service = {
  id?: string;
  name: string;
  type: string;
  duration: number; // minutes
  price: number; // EUR
  description: string;
};

const MASSAGE_TYPES = ["Swedish", "Deep Tissue", "Hot Stone", "Sports", "Aromatherapy", "Thai", "Shiatsu", "Lomi Lomi", "Couples", "Facial", "Other"];
const DURATION_OPTIONS = [30, 45, 60, 75, 90, 120];
const fieldCls = "w-full h-10 px-3 rounded-xl border border-border bg-background text-sm";

function ServiceTypeField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useTranslation();
  const [custom, setCustom] = useState(() => !!value && !MASSAGE_TYPES.includes(value));
  if (custom) {
    return (
      <div className="flex items-center gap-1">
        <Input
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t("partner.services.customTypePlaceholder")}
          className="h-10"
        />
        <button type="button" title={t("partner.services.useListAgain")} onClick={() => { setCustom(false); onChange("Swedish"); }} className="px-2 text-muted-foreground hover:text-primary">×</button>
      </div>
    );
  }
  return (
    <select
      value={value}
      onChange={(e) => { if (e.target.value === "__custom__") { setCustom(true); onChange(""); } else onChange(e.target.value); }}
      className={fieldCls}
    >
      {MASSAGE_TYPES.map(m => <option key={m} value={m}>{m}</option>)}
      <option value="__custom__">{t("partner.services.customTypeOption")}</option>
    </select>
  );
}

function ServiceDurationField({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const { t } = useTranslation();
  const [custom, setCustom] = useState(() => !DURATION_OPTIONS.includes(value));
  if (custom) {
    return (
      <div className="flex items-center gap-1">
        <Input
          autoFocus
          type="number"
          min={10}
          max={240}
          step={5}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          placeholder={t("partner.services.customDurationPlaceholder")}
          className="h-10"
        />
        <button type="button" title={t("partner.services.useListAgain")} onClick={() => { setCustom(false); onChange(60); }} className="px-2 text-muted-foreground hover:text-primary">×</button>
      </div>
    );
  }
  return (
    <select
      value={value}
      onChange={(e) => { if (e.target.value === "__custom__") { setCustom(true); } else onChange(Number(e.target.value)); }}
      className={fieldCls}
    >
      {DURATION_OPTIONS.map(d => <option key={d} value={d}>{t("partner.services.minutesOption", { minutes: d })}</option>)}
      <option value="__custom__">{t("partner.services.customDurationOption")}</option>
    </select>
  );
}

export default function PartnerServices() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [services, setServices] = useState<Service[]>([
    { name: "", type: "Swedish", duration: 60, price: 50, description: "" }
  ]);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const addService = () => {
    setServices([...services, { name: "", type: "Swedish", duration: 60, price: 50, description: "" }]);
  };

  const removeService = (i: number) => {
    if (services.length > 1) setServices(services.filter((_, idx) => idx !== i));
  };

  const updateService = (i: number, field: keyof Service, value: any) => {
    const updated = [...services];
    updated[i] = { ...updated[i], [field]: value };
    setServices(updated);
  };

  const handleSave = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error(t("partner.services.toastSignIn")); setLoading(false); return; }

    // Filter out empty rows
    const validServices = services.filter(s => s.name.trim());

    const { error } = await supabase.from("partner_services").upsert(
      validServices.map(s => ({
        partner_id: user.id,
        name: s.name,
        type: s.type,
        duration: s.duration,
        price: s.price,
        description: s.description,
      })),
      { onConflict: "partner_id,name" }
    );

    setLoading(false);
    if (error) { toast.error(t("partner.services.toastError", { message: error.message })); return; }
    setSaved(true);
    toast.success(t("partner.services.toastSaved", { count: validServices.length }));
    setTimeout(() => navigate("/partner/calendar"), 1200);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="px-6 py-5 border-b border-border bg-card">
        <div className="max-w-xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => navigate("/partner/profile")} className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center">←</button>
            <div>
              <p className="text-xs text-muted-foreground">{t("partner.services.stepLabel")}</p>
              <h1 className="font-display text-lg font-bold">{t("partner.services.title")}</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-6 py-6 space-y-4">
        {services.map((svc, i) => (
          <Card key={i} className="bg-card border-border">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-primary uppercase">{t("partner.services.serviceLabel", { number: i + 1 })}</span>
                {services.length > 1 && (
                  <button onClick={() => removeService(i)} className="text-muted-foreground hover:text-red-500">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">{t("partner.services.nameLabel")}</label>
                  <Input
                    value={svc.name}
                    onChange={(e) => updateService(i, "name", e.target.value)}
                    placeholder={t("partner.services.namePlaceholder")}
                    className="h-10"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">{t("partner.services.typeLabel")}</label>
                  <ServiceTypeField value={svc.type} onChange={(v) => updateService(i, "type", v)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {t("partner.services.durationLabel")}
                  </label>
                  <ServiceDurationField value={svc.duration} onChange={(v) => updateService(i, "duration", v)} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                    <DollarSign className="h-3 w-3" /> {t("partner.services.priceLabel")}
                  </label>
                  <Input
                    type="number"
                    value={svc.price}
                    onChange={(e) => updateService(i, "price", Number(e.target.value))}
                    min={0}
                    className="h-10"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">{t("partner.services.descriptionLabel")}</label>
                <Input
                  value={svc.description}
                  onChange={(e) => updateService(i, "description", e.target.value)}
                  placeholder={t("partner.services.descriptionPlaceholder")}
                  className="h-10"
                />
              </div>
            </CardContent>
          </Card>
        ))}

        <Button
          onClick={addService}
          variant="outline"
          className="w-full h-11 border-primary text-primary hover:bg-primary/5"
        >
          <Plus className="h-4 w-4" /> {t("partner.services.addService")}
        </Button>

        <Button
          onClick={handleSave}
          disabled={loading || services.every(s => !s.name.trim())}
          className="w-full h-12 bg-gradient-royal text-primary-foreground hover:opacity-90"
        >
          {loading ? t("partner.services.saving") : saved ? t("partner.services.saved") : t("partner.services.saveAndSetAvailability")}
          <ChevronRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
