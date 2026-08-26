import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, MapPin, MessageCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { massageTypeBySlug, findMassageType, MASSAGE_TYPES_CONTENT } from "@/lib/massageTypes";
import { MassageTypeBody } from "@/app/components/MassageTypeInfo";
import { fetchShops, type Shop, type ShopService } from "@/lib/supabase";
import { studioPath } from "@/lib/studioHref";
import { servicePrimaryName, serviceSecondaryName } from "@/lib/serviceName";
import { conciergePrefill, conciergeWhatsappUrl, MASSAGE_CLUB_WA } from "@/app/lib/whatsapp";
import { logWhatsappRequest } from "@/lib/whatsappLog";
import { trackEvent } from "@/lib/siteVisit";
import { setWaBubbleContext, clearWaBubbleContext } from "@/app/components/WhatsAppBubble";
import NotFound from "./NotFound";


/**
 * Standalone, shareable page for one massage type: /massages/<slug>.
 * Same write-up as the in-flow overlay, plus the studios that list it.
 */
export default function MassageTypePage({ slug: slugProp }: { slug?: string }) {
  const params = useParams();
  const slug = slugProp ?? params.slug;
  const { i18n } = useTranslation();
  const es = (i18n.language || "en").startsWith("es");
  const type = massageTypeBySlug(slug);
  const [shops, setShops] = useState<Shop[]>([]);

  useEffect(() => {
    if (!type) return;
    document.title = `${type.name.en} in Madrid · Massage Club`;
    const desc = `${type.name.en} in Madrid. ${type.what.en} See studios offering it and their prices.`;
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", desc.slice(0, 158));
  }, [type]);

  useEffect(() => {
    fetchShops().then(setShops).catch(() => {});
  }, []);

  // Ad traffic lands straight here, so the pageview is a funnel event of its own.
  useEffect(() => {
    if (!type) return;
    trackEvent("type_page_view", { slug: type.slug, meta: { type: type.slug } });
  }, [type?.slug]);

  // The mobile sticky bar owns the bottom right corner on these pages.
  useEffect(() => {
    setWaBubbleContext({ hidden: true });
    return () => clearWaBubbleContext();
  }, []);

  const matches = useMemo(() => {
    if (!type) return [];
    const out: { shop: Shop; service: ShopService }[] = [];
    for (const shop of shops) {
      for (const s of shop.partner_services ?? []) {
        const found = findMassageType((s as any).name_en, (s as any).name, (s as any).type);
        if (found?.slug === type.slug) {
          out.push({ shop, service: s });
          break;
        }
      }
    }
    // Studios that can be booked on Massage Club first, then cheapest first.
    return out
      .sort((a, b) => {
        const activeA = a.shop.status === "active" ? 0 : 1;
        const activeB = b.shop.status === "active" ? 0 : 1;
        if (activeA !== activeB) return activeA - activeB;
        const pa = Number(a.service.price) || Number.POSITIVE_INFINITY;
        const pb = Number(b.service.price) || Number.POSITIVE_INFINITY;
        return pa - pb;
      })
      .slice(0, 6);
  }, [shops, type]);


  if (!type) return <NotFound />;

  return (
    <div className="min-h-screen bg-[#FDFBF8]">
      <div className="mx-auto max-w-[760px] px-5 py-6 min-[900px]:py-10">
        <Link to="/studios" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#B85C38]">
          <ArrowLeft size={16} /> All studios <span className="font-normal text-[#8a7460]">/ Todos los estudios</span>
        </Link>

        <header className="mt-5">
          <h1 className="font-display text-3xl leading-tight text-[#2b2b2b] min-[900px]:text-4xl">
            {type.name.en} in Madrid
          </h1>
          <p className="mt-1 text-lg text-[#8a7460]">{type.name.es} en Madrid</p>
        </header>

        <div className="mt-6 rounded-3xl border border-[#E6DCCF] bg-white p-5 min-[900px]:p-7">
          <MassageTypeBody type={type} es={es} />
        </div>

        <section className="mt-8">
          <h2 className="font-display text-2xl text-[#2b2b2b]">
            Studios offering this <span className="text-base font-normal text-[#8a7460]">/ Estudios que lo ofrecen</span>
          </h2>
          {matches.length === 0 ? (
            <p className="mt-3 text-[15px] text-[#8a7460]">
              No listed studio currently shows this style. Browse all studios instead.
              <br />
              Ningún estudio listado lo muestra ahora mismo. Puedes ver todos los estudios.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {matches.map(({ shop, service }) => (
                <li key={shop.id}>
                  <Link
                    to={studioPath(shop)}
                    className="flex items-start justify-between gap-3 rounded-2xl border border-[#E6DCCF] bg-white p-4 motion-safe:transition hover:border-[#B85C38]"
                  >
                    <span className="min-w-0">
                      <span className="block font-semibold text-[#2b2b2b]">{shop.studio}</span>
                      <span className="mt-0.5 flex items-center gap-1 text-xs text-[#8a7460]">
                        <MapPin size={12} /> {shop.district || "Madrid"}
                      </span>
                      <span className="mt-1 block text-sm text-[#5a4736]">{servicePrimaryName(service)}</span>
                      {serviceSecondaryName(service) && (
                        <span className="block text-xs text-[#8a7460]">{serviceSecondaryName(service)}</span>
                      )}
                    </span>
                    <span className="flex-shrink-0 text-right">
                      {Number(service.price) > 0 && (
                        <span className="block font-bold text-[#B85C38]">€{Number(service.price)}</span>
                      )}
                      {Number(service.duration) > 0 && (
                        <span className="block text-xs text-[#8a7460]">{Number(service.duration)} min</span>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-10">
          <h2 className="font-display text-xl text-[#2b2b2b]">
            Other massage types <span className="text-sm font-normal text-[#8a7460]">/ Otros tipos de masaje</span>
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {MASSAGE_TYPES_CONTENT.filter((t) => t.slug !== type.slug).map((t) => (
              <Link
                key={t.slug}
                to={`/massages/${t.slug}`}
                className="rounded-full border border-[#E6DCCF] bg-white px-3 py-1.5 text-sm text-[#5a4736] hover:border-[#B85C38]"
              >
                {t.name.en}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
