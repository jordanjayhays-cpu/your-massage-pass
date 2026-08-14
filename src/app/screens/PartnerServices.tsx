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
                  <select
                    value={svc.type}
                    onChange={(e) => updateService(i, "type", e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm"
                  >
                    {MASSAGE_TYPES.map(t2 => <option key={t2} value={t2}>{t2}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {t("partner.services.durationLabel")}
                  </label>
                  <select
                    value={svc.duration}
                    onChange={(e) => updateService(i, "duration", Number(e.target.value))}
                    className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm"
                  >
                    {[30, 45, 60, 75, 90, 120].map(d => <option key={d} value={d}>{t("partner.services.minutesOption", { minutes: d })}</option>)}
                  </select>
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
