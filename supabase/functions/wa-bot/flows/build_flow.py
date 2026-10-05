"""Builds massage_booking_flow.json (WhatsApp Flow 2519994188477304).

    python3 build_flow.py <dir with the rendered art jpgs>

The art comes from art/art.html, rendered to jpg (banners b*.jpg, icons i_*.jpg).
One question per screen, like the website wizard: massage, day, time, a backup
day and time (recommended, skippable), area, then name and email.

The day lists are not in this file. Real dates ("Wed 7 Oct") change every day,
so wa-bot sends them as `days` / `days2` in flow_action_payload each time it
sends the form (flowDays() in bot.ts). Option ids are ISO dates or "flexible";
days2 starts with "none" (no backup).
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
DAYS2 = dict(DAY_ITEMS, __example__=[{"id": "none", "title": "No backup", "description": "Just my first choice"}] + DAYS_EX)

SERVICES = [
    ("relaxing", "Relaxing", "Gentle, to switch off"),
    ("deep_tissue", "Deep tissue", "Firm, for knots and tension"),
    ("thai", "Thai", "Stretching, done clothed"),
    ("sports", "Sports", "For training and recovery"),
    ("hot_stone", "Hot stone", "Warm stones, deeply relaxing"),
    ("unsure", "Not sure yet", "We will help you choose"),
]
TIMES = [
    ("morning", "Morning", "10:00 to 13:00"),
    ("afternoon", "Afternoon", "13:00 to 18:00"),
    ("evening", "Evening", "18:00 to 21:00"),
]
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
    screen("SERVICE", {"days": DAYS, "days2": DAYS2}, [
        banner("b1", "Massage Club, step 1 of 6"),
        {"type": "TextBody", "text": "Professional studios in Madrid. You pay the studio directly, no fee from us."},
        form([radio("service", "Pick one", opts(SERVICES)),
              nav("Next", "DAY", dict(service="${form.service}", **carry("days", "days2")))],
             {"service": "relaxing"}),
    ]),
    screen("DAY", {"service": S, "days": DAYS, "days2": DAYS2}, [
        banner("b2", "Massage Club, step 2 of 6"),
        form([radio("day", "Pick a day", "${data.days}"),
              nav("Next", "TIME", dict(day="${form.day}", **carry("service", "days2")))]),
    ]),
    screen("TIME", {"service": S, "day": S, "days2": DAYS2}, [
        banner("b3", "Massage Club, step 3 of 6"),
        form([radio("time_pref", "Pick a time", opts(TIMES)),
              nav("Next", "BACKUP", dict(time_pref="${form.time_pref}", **carry("service", "day", "days2")))],
             {"time_pref": "evening"}),
    ]),
    screen("BACKUP", {"service": S, "day": S, "time_pref": S, "days2": DAYS2}, [
        banner("b4", "Massage Club, step 4 of 6, backup day"),
        {"type": "TextBody", "text": "Studios say yes faster when you give them two options."},
        form([radio("day2", "Pick a backup day", "${data.days2}"),
              {"type": "If", "condition": "${form.day2} == 'none'",
               "then": [nav("Next", "AREA", dict(day2="none", time2="", **carry("service", "day", "time_pref")))],
               "else": [nav("Next", "BACKUP_TIME", dict(day2="${form.day2}", **carry("service", "day", "time_pref")))]}]),
    ]),
    screen("BACKUP_TIME", {"service": S, "day": S, "time_pref": S, "day2": S}, [
        banner("b4t", "Massage Club, step 4 of 6, backup time"),
        form([radio("time2", "Pick a backup time", opts(TIMES)),
              nav("Next", "AREA", dict(time2="${form.time2}", **carry("service", "day", "time_pref", "day2")))]),
    ]),
    screen("AREA", {"service": S, "day": S, "time_pref": S, "day2": S, "time2": S}, [
        banner("b5", "Massage Club, step 5 of 6"),
        form([radio("area", "Pick an area", opts(AREAS, icons=False)),
              nav("Next", "YOU", dict(area="${form.area}", **carry("service", "day", "time_pref", "day2", "time2")))],
             {"area": "locate"}),
    ]),
    screen("YOU", {"service": S, "day": S, "time_pref": S, "day2": S, "time2": S, "area": S}, [
        banner("b6", "Massage Club, step 6 of 6"),
        {"type": "TextBody", "text": "We ask the best studios near you and send you their offer right here in WhatsApp. Nothing is booked until you say yes."},
        form([{"type": "TextInput", "name": "name", "label": "Your first name", "input-type": "text", "required": True},
              {"type": "TextInput", "name": "email", "label": "Email", "helper-text": "Your confirmation goes here too", "input-type": "email", "required": True},
              {"type": "Footer", "label": "Find me a studio", "on-click-action": {"name": "complete", "payload": dict(
                  name="${form.name}", email="${form.email}", **carry("service", "day", "time_pref", "day2", "time2", "area"))}}]),
    ], terminal=True),
]

with open(OUT, "w") as f:
    json.dump({"version": "6.3", "screens": screens}, f, ensure_ascii=False, separators=(",", ":"))
print("wrote", OUT, os.path.getsize(OUT), "bytes")
