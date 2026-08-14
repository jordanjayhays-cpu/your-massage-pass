import type { PartnerLang } from "@/app/lib/partnerLanguage";

const OPTIONS: { lang: PartnerLang; flag: string; label: string }[] = [
  { lang: "es", flag: "es", label: "Español" },
  { lang: "en", flag: "gb", label: "English" },
];

/** Two pill buttons to pick the partner UI language. */
export default function PartnerLangPills({
  value,
  onChange,
  className = "",
}: {
  value: PartnerLang;
  onChange: (lang: PartnerLang) => void;
  className?: string;
}) {
  return (
    <div className={`flex gap-2 ${className}`}>
      {OPTIONS.map((o) => {
        const active = value === o.lang;
        return (
          <button
            key={o.lang}
            type="button"
            onClick={() => onChange(o.lang)}
            aria-pressed={active}
            className={`h-11 px-4 rounded-full border-2 font-semibold text-sm inline-flex items-center gap-2 transition focus:outline-none focus:ring-2 focus:ring-[#B85C38]/40 ${
              active
                ? "bg-[#B85C38] border-[#B85C38] text-white"
                : "bg-white border-[#E5DDD3] text-[#2b2b2b] hover:border-[#B85C38]"
            }`}
          >
            <img
              src={`https://flagcdn.com/w40/${o.flag}.png`}
              srcSet={`https://flagcdn.com/w40/${o.flag}.png 1x, https://flagcdn.com/w80/${o.flag}.png 2x`}
              alt=""
              aria-hidden
              className="h-4 w-6 rounded-[3px] object-cover"
              loading="lazy"
            />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
