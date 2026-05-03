# Supabase Edge Functions — Calendar Integration

## What These Do

- `google-calendar-oauth` — Handles Google OAuth callback when studio clicks "Connect Calendar"
- `get-availability` — Reads Google Calendar free/busy + manual availability to calculate open slots
- `create-booking` — Creates booking in Supabase + Google Calendar event + notifies studio
- `cancel-booking` — Cancels booking in Supabase + removes Google Calendar event

---

## One-Time Google Cloud Setup

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Select project `696177385406` (or create new)
3. Enable **Google Calendar API**
4. Enable **Google Calendar Events API**
5. Go to **APIs & Services → Credentials → Create Credentials → OAuth client ID**
6. Application type: **Web application**
7. Add **Authorized redirect URI**:
   ```
   https://jglftdstrowwckwqmpue.supabase.co/functions/v1/google-calendar-oauth
   ```
8. Copy **Client ID** and **Client Secret**

---

## Add Secrets to Supabase

In [Supabase Dashboard](https://supabase.com/dashboard/project/jglftdstrowwckwqmpue) → Settings → Secrets:

```
GOOGLE_CLIENT_ID = your_client_id_here
GOOGLE_CLIENT_SECRET = your_client_secret_here
```

---

## Deploy Edge Functions

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link project
supabase link --project-ref jglftdstrowwckwqmpue

# Deploy all functions
supabase functions deploy google-calendar-oauth
supabase functions deploy get-availability
supabase functions deploy create-booking
supabase functions deploy cancel-booking
```

Or deploy individually:
```bash
supabase functions deploy google-calendar-oauth --no-verify-jwt
supabase functions deploy get-availability --no-verify-jwt
supabase functions deploy create-booking --no-verify-jwt
supabase functions deploy cancel-booking --no-verify-jwt
```

---

## Test the OAuth Flow

1. Build the Partner Portal "Connect Calendar" button
2. Button links to:
   ```
   https://accounts.google.com/o/oauth2/v2/auth?
     client_id=YOUR_CLIENT_ID&
     redirect_uri=https://jglftdstrowwckwqmpue.supabase.co/functions/v1/google-calendar-oauth&
     response_type=code&
     scope=https://www.googleapis.com/auth/calendar.readonly%20https://www.googleapis.com/auth/calendar.events&
     access_type=offline&
     prompt=consent&
     state=PARTNER_UUID
   ```
3. After approval, tokens stored in `partners.google_refresh_token`

---

## API Endpoints

### GET Available Slots
```
POST /functions/v1/get-availability
{
  "studio_id": "uuid",
  "date": "2026-05-15",
  "service_duration": 60
}
```

### Create Booking
```
POST /functions/v1/create-booking
{
  "studio_id": "uuid",
  "service_id": "uuid",
  "booking_date": "2026-05-15",
  "time_slot": "14:00",
  "customer_name": "Maria Garcia",
  "customer_phone": "+34612345678",
  "customer_email": "maria@example.com",
  "notes": "Prefers firm pressure"
}
```

### Cancel Booking
```
POST /functions/v1/cancel-booking
{
  "booking_id": "uuid",
  "reason": "Customer requested cancellation"
}
```

---

## SQL Setup (run after schema is live)

```bash
# Run in Supabase SQL editor
# File: supabase-calendar-integration.sql
```
