"""Builds massage_booking_flow.json (WhatsApp Flow 2519994188477304).

    python3 build_flow.py <dir with the rendered art jpgs>

The art comes from art/art.html, rendered to jpg (banners b*.jpg, icons i_*.jpg).
One question per screen, like the website wizard: massage, day, a time as
tap-to-pick chips (more only if flexible), area, then name and email.

The day lists are not in this file. Real dates ("Wed 7 Oct") change every day,
so wa-bot sends them as `days` in flow_action_payload each time it
sends the form (flowDays() in bot.ts). Option ids are ISO dates or "flexible";

"""
import base64, json, os, sys

ART = sys.argv[1]
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "massage_booking_flow.json")

def img(name):
    with open(os.path.join(ART, name + ".jpg"), "rb") as f:
        return base64.b64encode(f.read()).decode()

def banner(n, alt):
    # A fixed 120dp strip. Without a height WhatsApp draws a square box (5 Oct).
    return {"type": "Image", "src": img(n), "height": 120, "scale-type": "cover", "alt-text": alt}

S = {"type": "string", "__example__": "x"}
DAY_ITEMS = {"type": "array", "items": {"type": "object", "properties": {
    "id": {"type": "string"}, "title": {"type": "string"}, "description": {"type": "string"}}}}
DAYS_EX = [{"id": "2026-10-05", "title": "Today", "description": "Mon 5 Oct"},
           {"id": "2026-10-06", "title": "Tomorrow", "description": "Tue 6 Oct"},
           {"id": "2026-10-07", "title": "Wed 7 Oct"},
           {"id": "flexible", "title": "I am flexible", "description": "Whenever a studio has room"}]
DAYS = dict(DAY_ITEMS, __example__=DAYS_EX)

SERVICES = [
    ("relaxing", "Relaxing", "Gentle, to switch off"),
    ("deep_tissue", "Deep tissue", "Firm, for knots and tension"),
    ("thai", "Thai", "Stretching, done clothed"),
    ("sports", "Sports", "For training and recovery"),
    ("hot_stone", "Hot stone", "Warm stones, deeply relaxing"),
    ("unsure", "Not sure yet", "We will help you choose"),
]
# 5 Oct (Jordan): "make it easier to pick a time". Real start times as chips,
# tap every one that works (up to 3), no bands and no radio buttons. 20:00 is
# the last start: a massage has to finish by 21:00.
HOURS = [{"id": str(h), "title": f"{h}:00"} for h in range(10, 21)]
HOURS_T = {"type": "array", "items": {"type": "string"}, "__example__": ["18"]}

def chips(name, label, desc, max_n):
    return {"type": "ChipsSelector", "name": name, "label": label, "description": desc,
            "min-selected-items": 1, "max-selected-items": max_n, "required": True, "data-source": HOURS}
AREAS = [
    ("locate", "📍 Use my location", "We find the studios closest to you"),
    ("centro", "Centro / Sol", "Sol, Ópera, La Latina"),
    ("malasana", "Malasaña / Chueca", "Tribunal, Gran Vía"),
    ("chamberi", "Chamberí", "Bilbao, Iglesia, Ríos Rosas"),
    ("salamanca", "Salamanca", "Serrano, Goya, Velázquez"),
    ("retiro", "Retiro", "Ibiza, Atocha"),
    ("chamartin", "Chamartín", "Nuevos Ministerios, Plaza Castilla"),
    ("anywhere", "Anywhere in Madrid", "Closest good studio wins"),
    ("other", "Somewhere else", "Tell us after"),
]

def opts(rows, icons=True):
    out = []
    for oid, title, desc in rows:
        o = {"id": oid, "title": title}
        if desc: o["description"] = desc
        if icons: o["image"] = img("i_" + oid)
        out.append(o)
    return out

def radio(name, label, source):
    return {"type": "RadioButtonsGroup", "name": name, "label": label, "required": True, "data-source": source}

def nav(label, screen, payload):
    return {"type": "Footer", "label": label, "on-click-action": {"name": "navigate", "next": {"type": "screen", "name": screen}, "payload": payload}}

def form(children, init=None):
    f = {"type": "Form", "name": "f", "children": children}
    if init: f["init-values"] = init
    return f

def screen(sid, data, children, terminal=False):
    s = {"id": sid, "title": "Massage Club", "data": data, "layout": {"type": "SingleColumnLayout", "children": children}}
    if terminal: s.update(terminal=True, success=True)
    return s

carry = lambda *keys: {k: "${data.%s}" % k for k in keys}

screens = [
    screen("SERVICE", {"days": DAYS}, [
        banner("b1", "Massage Club, step 1 of 5"),
        {"type": "TextBody", "text": "Professional studios in Madrid. You pay the studio directly, no fee from us."},
        form([radio("service", "Pick one", opts(SERVICES)),
              nav("Next", "DAY", dict(service="${form.service}", **carry("days")))],
             {"service": "relaxing"}),
    ]),
    screen("DAY", {"service": S, "days": DAYS}, [
        banner("b2", "Massage Club, step 2 of 5"),
        form([radio("day", "Pick a day", "${data.days}"),
              nav("Next", "TIME", dict(day="${form.day}", **carry("service")))]),
    ]),
    screen("TIME", {"service": S, "day": S}, [
        banner("b3", "Massage Club, step 3 of 5"),
        form([chips("time_pref", "Pick a time", "Tap one. Add more only if you are flexible.", 3),
              nav("Next", "AREA", dict(time_pref="${form.time_pref}", **carry("service", "day")))]),
    ]),
    screen("AREA", {"service": S, "day": S, "time_pref": HOURS_T}, [
        banner("b4", "Massage Club, step 4 of 5"),
        form([radio("area", "Pick an area", opts(AREAS, icons=False)),
              nav("Next", "YOU", dict(area="${form.area}", **carry("service", "day", "time_pref")))],
             {"area": "locate"}),
    ]),
    screen("YOU", {"service": S, "day": S, "time_pref": HOURS_T, "area": S}, [
        banner("b5", "Massage Club, step 5 of 5"),
        {"type": "TextBody", "text": "We ask the best studios near you and send you their offer right here in WhatsApp. Nothing is booked until you say yes."},
        form([{"type": "TextInput", "name": "name", "label": "Your first name", "input-type": "text", "required": True},
              {"type": "TextInput", "name": "email", "label": "Email", "helper-text": "Your confirmation goes here too", "input-type": "email", "required": True},
              {"type": "Footer", "label": "Find me a studio", "on-click-action": {"name": "complete", "payload": dict(
                  name="${form.name}", email="${form.email}", **carry("service", "day", "time_pref", "area"))}}]),
    ], terminal=True),
]

with open(OUT, "w") as f:
    json.dump({"version": "6.3", "screens": screens}, f, ensure_ascii=False, separators=(",", ":"))
print("wrote", OUT, os.path.getsize(OUT), "bytes")
