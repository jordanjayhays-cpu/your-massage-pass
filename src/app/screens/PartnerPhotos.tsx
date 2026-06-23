import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Upload, Trash2, ImagePlus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

const BUCKET = "studio-photos";

export default function PartnerPhotos() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [gallery, setGallery] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/partner/login"); return; }
      setUserId(user.id);
      const { data } = await supabase
        .from("partners")
        .select("logo_url, cover_url, gallery")
        .eq("id", user.id)
        .single();
      if (data) {
        setLogoUrl(data.logo_url ?? null);
        setCoverUrl(data.cover_url ?? null);
        setGallery(data.gallery ?? []);
      }
      setLoading(false);
    })();
  }, [navigate]);

  const uploadFile = async (file: File, kind: string): Promise<string | null> => {
    if (!userId) return null;
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${userId}/${kind}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
    if (error) {
      toast.error(`Upload failed: ${error.message}`);
      return null;
    }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
  };

  const onPickLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    setBusy("logo");
    const url = await uploadFile(f, "logo");
    if (url) setLogoUrl(url);
    setBusy(null);
  };

  const onPickCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    setBusy("cover");
    const url = await uploadFile(f, "cover");
    if (url) setCoverUrl(url);
    setBusy(null);
  };

  const onPickGallery = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setBusy("gallery");
    const urls: string[] = [];
    for (const f of files) {
      const url = await uploadFile(f, "gallery");
      if (url) urls.push(url);
    }
    setGallery(prev => [...prev, ...urls]);
    setBusy(null);
  };

  const removeGalleryImg = (url: string) => setGallery(prev => prev.filter(u => u !== url));

  const handleSave = async () => {
    if (!userId) return;
    setBusy("save");
    const { error } = await supabase
      .from("partners")
      .update({ logo_url: logoUrl, cover_url: coverUrl, gallery })
      .eq("id", userId);
    setBusy(null);
    if (error) { toast.error("Couldn't save: " + error.message); return; }
    setSaved(true);
    toast.success("Photos saved!");
    setTimeout(() => setSaved(false), 1500);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="px-6 py-5 border-b border-border bg-card">
        <div className="max-w-xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate("/partner/dashboard")} className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center">←</button>
          <div>
            <p className="text-xs text-muted-foreground">Profile</p>
            <h1 className="font-display text-lg font-bold">Photos</h1>
          </div>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-6 py-6 space-y-6">
        <p className="text-sm text-muted-foreground">Add photos so your booking page looks inviting. These show on your public link.</p>

        {/* Cover */}
        <div>
          <p className="text-sm font-semibold mb-2">Cover photo <span className="text-muted-foreground font-normal">(big banner at the top)</span></p>
          <div className="relative h-40 rounded-2xl overflow-hidden border border-border bg-secondary flex items-center justify-center">
            {coverUrl
              ? <img src={coverUrl} alt="cover" className="absolute inset-0 h-full w-full object-cover" />
              : <span className="text-muted-foreground text-sm">No cover yet</span>}
            <label className="absolute bottom-3 right-3 cursor-pointer">
              <span className="inline-flex items-center gap-1.5 bg-black/60 text-white text-xs px-3 py-1.5 rounded-full">
                {busy === "cover" ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />} Upload
              </span>
              <input type="file" accept="image/*" className="hidden" onChange={onPickCover} />
            </label>
          </div>
        </div>

        {/* Logo */}
        <div>
          <p className="text-sm font-semibold mb-2">Logo</p>
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 rounded-2xl overflow-hidden border border-border bg-secondary flex items-center justify-center">
              {logoUrl ? <img src={logoUrl} alt="logo" className="h-full w-full object-cover" /> : <ImagePlus className="text-muted-foreground" />}
            </div>
            <label className="cursor-pointer">
              <span className="inline-flex items-center gap-1.5 bg-secondary text-foreground text-sm px-4 py-2 rounded-xl border border-border">
                {busy === "logo" ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Upload logo
              </span>
              <input type="file" accept="image/*" className="hidden" onChange={onPickLogo} />
            </label>
          </div>
        </div>

        {/* Gallery */}
        <div>
          <p className="text-sm font-semibold mb-2">Gallery <span className="text-muted-foreground font-normal">(your space, treatments)</span></p>
          <div className="grid grid-cols-3 gap-2">
            {gallery.map(url => (
              <div key={url} className="relative aspect-square rounded-xl overflow-hidden border border-border">
                <img src={url} alt="" className="h-full w-full object-cover" />
                <button onClick={() => removeGalleryImg(url)} className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
            <label className="aspect-square rounded-xl border-2 border-dashed border-border flex items-center justify-center cursor-pointer text-muted-foreground hover:border-primary/50">
              {busy === "gallery" ? <Loader2 size={18} className="animate-spin" /> : <ImagePlus size={18} />}
              <input type="file" accept="image/*" multiple className="hidden" onChange={onPickGallery} />
            </label>
          </div>
        </div>

        <Button onClick={handleSave} disabled={busy === "save"} className="w-full h-12 bg-gradient-royal text-primary-foreground hover:opacity-90">
          {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <><Check className="h-4 w-4 mr-1" /> Saved!</> : "Save photos"}
        </Button>
      </div>
    </div>
  );
}
