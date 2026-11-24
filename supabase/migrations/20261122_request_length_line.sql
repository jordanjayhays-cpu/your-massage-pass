-- 22 Nov 2026 (Jordan: "Please do it" to "build and ship" the length fix).
--
-- Request #127 wrote "Relaxing, 120 mins preferred" in the website note, and the
-- studios were asked for 60 min. Every reader of the length (dispatch-studios,
-- wa-bot, the lead-to-studio offer email in notify-whatsapp-request,
-- stuck-booking-rescue, studio-calls) reads only a "Duración: N min" line in
-- message_text, and only the WhatsApp bot ever wrote one.
--
-- So the length is read once, here, just before a request is saved. If the
-- customer's own words name a length other than 60, a "Duración: N min" line is
-- added, and every reader agrees with no code change. Rules:
--   * WhatsApp bot rows are left alone: the bot reads the length itself.
--   * A row that already has a "Duración:" line is left alone (the website's
--     new 60 / 90 / 120 choice writes one).
--   * Website rows: only the customer's note is read. Other rows: everything
--     except the day, time, area, location and origin fields.
--   * The first length the customer mentions wins ("120 min preferred, 90 ok"
--     is 120). A number right after or before a timing word is not a length:
--     "in 45 min", "llego en 30 minutos", "30 min away", "a las 2h".
--   * Lengths from 30 to 180 min in steps of 5. "1h30" is 90, "hora y media"
--     is 90, "2 hours" / "dos horas" is 120.
--   * It can never block a request: any error saves the row unchanged.

create or replace function public.mc_length_from_words(p text)
returns int language plpgsql immutable as $$
declare
  s text := lower(coalesce(p, ''));
  pat constant text :=
       '\y[1-3] ?(?:h|hr|hrs|hora|horas|hour|hours) ?(?:y |and )?[0-5][05] ?(?:min|mins|minutos|minutes|m)?\y'
    || '|hora y media|(?:an |one )?hour and a half|one and a half hours?|\y1[.,]5 ?(?:h|hrs?|hours?|horas?)\y'
    || '|media hora|half an hour'
    || '|\y(?:dos|tres|una|two|three|one) (?:horas?|hours?)\y'
    || '|\y[1-3] ?(?:h|hrs?|hours?|horas?)\y'
    || '|\y\d{2,3} ?(?:min|mins|minuto|minutos|minute|minutes)\y'
    || '|\y(?:noventa|sesenta|ninety|sixty) (?:min|minutos|minutes)\y';
  n int := 1;
  m text;
  pos int;
  pre text;
  post text;
  v int;
begin
  loop
    m := regexp_substr(s, pat, 1, n);
    exit when m is null or n > 20;
    pos := regexp_instr(s, pat, 1, n);
    pre := substring(s from greatest(1, pos - 24) for least(pos - 1, 24));
    post := substring(s from pos + length(m) for 24);
    v := null;
    if pre ~ '(\y(in|en|within|dentro de|away|desde|from|late|tarde|llego|llegaré|llegare|llegamos|llegar|walk|walking|andando|caminando|after|después de|despues de|antes de|before|a las|at|by|sobre las|hacia las|hasta las|until|every|cada|hace|ago)|[:\d])\s*$' then
      v := null;
    elsif post ~ '^\s*(away|walk|walking|andando|caminando|from|de distancia|late|tarde|de retraso|by metro|en metro|por metro|in metro|de aquí|de aqui|antes|before|after|después|despues|later|más tarde|mas tarde|ago)' then
      v := null;
    else
      v := case
        when m ~ '^[1-3] ?(h|hr|hrs|hora|horas|hour|hours) ?(y |and )?[0-5][05]'
          then substring(m from '^([1-3])')::int * 60 + substring(m from '([0-5][05]) ?(min|mins|minutos|minutes|m)?$')::int
        when m ~ 'hora y media|hour and a half|one and a half|1[.,]5' then 90
        when m ~ 'media hora|half an hour' then 30
        when m ~ '^(dos|two) ' then 120
        when m ~ '^(tres|three) ' then 180
        when m ~ '^(una|one) ' then 60
        when m ~ '^[1-3] ?(h|hrs?|hours?|horas?)$' then substring(m from '^([1-3])')::int * 60
        when m ~ '^(noventa|ninety)' then 90
        when m ~ '^(sesenta|sixty)' then 60
        when m ~ '^\d{2,3} ?min' then substring(m from '^(\d{2,3})')::int
      end;
      if v is not null and v between 30 and 180 and v % 5 = 0 then
        return v;
      end if;
    end if;
    n := n + 1;
  end loop;
  return null;
end $$;

create or replace function public.mc_request_length(mt text)
returns int language plpgsql immutable as $$
declare
  t text := coalesce(mt, '');
begin
  if t ~* 'Duraci[oó]n: ?\d' or t ~* 'Origen: *whatsapp-bot' then
    return null;
  end if;
  if t ~* 'Nota del cliente:' then
    return public.mc_length_from_words(substring(t from '(?i)Nota del cliente:(.*?)(?: \| Origen:|$)'));
  end if;
  t := regexp_replace(t, '(Cuando|Fecha|Zona|Ubicaci[oó]n): [^|;]*', ' ', 'gi');
  t := regexp_replace(t, 'Origen: .*$', ' ', 'i');
  return public.mc_length_from_words(t);
end $$;

create or replace function public.mc_add_length_line()
returns trigger language plpgsql as $$
declare
  v int;
begin
  begin
    v := public.mc_request_length(new.message_text);
    if v is not null and v <> 60 then
      new.message_text := coalesce(new.message_text, '') || ' | Duración: ' || v || ' min';
    end if;
  exception when others then
    null;  -- never block a request because of the length
  end;
  return new;
end $$;

create trigger trg_mc_request_length
  before insert on public.whatsapp_requests
  for each row execute function public.mc_add_length_line();
