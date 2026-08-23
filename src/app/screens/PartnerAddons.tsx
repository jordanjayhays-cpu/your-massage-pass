import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2, ChevronRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

type Addon = {
  id?: string;
  name: string;
  name_es: string;
  price: number; // EUR
  duration_extra: number; // minutes
  active: boolean;
};

const blankAddon = (): Addon => ({ name: "", name_es: "", price: 10, duration_extra: 15, active: true });

export default function PartnerAddons() {
  const navigate = useNavigate();
  const [addons, setAddons] = useState<Addon[]>([]);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Please sign in / Por favor inicia sesión"); navigate("/partner/login"); return; }

    const { data, error } = await supabase
      .from("partner_addons")
      .select("*")
      .eq("partner_id", user.id)
      .order("name", { ascending: true });

    if (error) { toast.error(error.message); setLoading(false); return; }

    setAddons((data ?? []).map((a: any) => ({
      id: a.id,
      name: a.name ?? "",
      name_es: a.name_es ?? "",
      price: a.price ?? 0,
      duration_extra: a.duration_extra ?? 0,
      active: a.active ?? true,
    })));
    setLoading(false);
  };

  const addAddon = () => setAddons([...addons, blankAddon()]);

  const removeAddon = (i: number) => {
    const target = addons[i];
    if (target?.id) setDeletedIds(prev => [...prev, target.id!]);
    setAddons(addons.filter((_, idx) => idx !== i));
  };

  const updateAddon = (i: number, field: keyof Addon, value: any) => {
    const updated = [...addons];
    updated[i] = { ...updated[i], [field]: value };
    setAddons(updated);
  };

  const handleSave = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Please sign in / Por favor inicia sesión"); setSaving(false); return; }

    if (deletedIds.length) {
      const { error: delError } = await supabase.from("partner_addons").delete().in("id", deletedIds);
      if (delError) { toast.error(delError.message); setSaving(false); return; }
    }

    const validAddons = addons.filter(a => a.name.trim());

    if (validAddons.length) {
      const { error } = await supabase.from("partner_addons").upsert(
        validAddons.map(a => ({
          ...(a.id ? { id: a.id } : {}),
          partner_id: user.id,
          name: a.name,
          name_es: a.name_es,
          price: a.price,
          duration_extra: a.duration_extra,
          active: a.active,
        }))
      );
      if (error) { toast.error(error.message); setSaving(false); return; }
    }

    setDeletedIds([]);
    setSaving(false);
    setSaved(true);
    toast.success("Add-ons saved / Extras guardados");
    load();
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="min-h-screen" style={{ background: "#FAF6F1" }}>
      <div className="px-6 py-5 border-b" style={{ borderColor: "#E6DCCF", background: "#fff" }}>
        <div className="max-w-xl mx-auto">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/partner/dashboard")}
              className="h-9 w-9 rounded-full flex items-center justify-center"
              style={{ background: "#F1E9DE" }}
            >
              ←
            </button>
            <div>
              <p className="text-xs" style={{ color: "#8a7460" }}>Add-ons / Extras</p>
              <h1 className="font-display text-lg font-bold" style={{ color: "#2b2b2b" }}>Add-ons</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-6 py-6 space-y-4">
        {loading ? (
          <p className="text-sm" style={{ color: "#7A7068" }}>Loading… / Cargando…</p>
        ) : addons.length === 0 ? (
          <Card className="border" style={{ borderColor: "#E6DCCF" }}>
            <CardContent className="p-6 text-center space-y-2">
              <Sparkles className="h-6 w-6 mx-auto" style={{ color: "#C4622D" }} />
              <p className="text-sm" style={{ color: "#2b2b2b" }}>
                Add extras you offer, like hot stones or aromatherapy, and clients can add them to bookings.
              </p>
              <p className="text-sm" style={{ color: "#7A7068" }}>
                Añade extras que ofreces, como piedras calientes o aromaterapia, y los clientes podrán añadirlos a sus reservas.
              </p>
            </CardContent>
          </Card>
        ) : (
          addons.map((addon, i) => (
            <Card key={addon.id ?? `new-${i}`} className="border" style={{ borderColor: "#E6DCCF" }}>
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase" style={{ color: "#B85C38" }}>Add-on {i + 1}</span>
                  <button onClick={() => removeAddon(i)} style={{ color: "#7A7068" }} className="hover:text-red-500">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold mb-1 block" style={{ color: "#7A7068" }}>Name (English)</label>
                    <Input
                      value={addon.name}
                      onChange={(e) => updateAddon(i, "name", e.target.value)}
                      placeholder="Hot stones"
                      className="h-10"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold mb-1 block" style={{ color: "#7A7068" }}>Nombre (Español)</label>
                    <Input
                      value={addon.name_es}
                      onChange={(e) => updateAddon(i, "name_es", e.target.value)}
                      placeholder="Piedras calientes"
                      className="h-10"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold mb-1 block" style={{ color: "#7A7068" }}>Price (€)</label>
                    <Input
                      type="number"
                      min={0}
                      value={addon.price}
                      onChange={(e) => updateAddon(i, "price", Number(e.target.value))}
                      className="h-10"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold mb-1 block" style={{ color: "#7A7068" }}>Extra minutes</label>
                    <Input
                      type="number"
                      min={0}
                      step={5}
                      value={addon.duration_extra}
                      onChange={(e) => updateAddon(i, "duration_extra", Number(e.target.value))}
                      className="h-10"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 text-sm" style={{ color: "#2b2b2b" }}>
                  <input
                    type="checkbox"
                    checked={addon.active}
                    onChange={(e) => updateAddon(i, "active", e.target.checked)}
                  />
                  Active / Activo
                </label>
              </CardContent>
            </Card>
          ))
        )}

        <Button
          onClick={addAddon}
          variant="outline"
          className="w-full h-11"
          style={{ borderColor: "#B85C38", color: "#B85C38" }}
        >
          <Plus className="h-4 w-4" /> Add an add-on / Añadir un extra
        </Button>

        <Button
          onClick={handleSave}
          disabled={saving || loading}
          className="w-full h-12 text-white hover:opacity-90"
          style={{ background: "#B85C38" }}
        >
          {saving ? "Saving… / Guardando…" : saved ? "Saved / Guardado" : "Save add-ons / Guardar extras"}
          <ChevronRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
