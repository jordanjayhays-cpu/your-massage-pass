-- Massage Club Reviewer Program Schema
-- Studios must receive 2 verified reviews before going live

create table if not exists reviewer_applications (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text not null,
  massage_frequency text check (massage_frequency in ('weekly', 'monthly', 'occasionally')),
  massage_types text,
  why text,
  massage_background text,
  status text default 'pending' check (status in ('pending', 'approved', 'rejected')),
  applied_at timestamptz default now()
);

create table if not exists reviewer_assignments (
  id uuid primary key default gen_random_uuid(),
  reviewer_id uuid references reviewer_applications(id),
  studio_id text not null,
  status text default 'assigned' check (status in ('assigned', 'completed', 'cancelled')),
  assigned_at timestamptz default now(),
  completed_at timestamptz
);

create table if not exists studio_reviews (
  id uuid primary key default gen_random_uuid(),
  studio_id text not null,
  reviewer_id uuid references reviewer_applications(id),
  
  -- Atmosphere scores
  lighting int check (lighting between 1 and 5),
  music int check (music between 1 and 5),
  temperature int check (temperature between 1 and 5),
  cleanliness int check (cleanliness between 1 and 5),
  ambiance_text text,
  
  -- Space scores
  privacy int check (privacy between 1 and 5),
  table_comfort int check (table_comfort between 1 and 5),
  room_size int check (room_size between 1 and 5),
  
  -- Therapist scores
  professionalism int check (professionalism between 1 and 5),
  technique int check (technique between 1 and 5),
  communication int check (communication between 1 and 5),
  knowledge int check (knowledge between 1 and 5),
  
  -- Logistics scores
  ease_of_booking int check (ease_of_booking between 1 and 5),
  punctuality int check (punctuality between 1 and 5),
  price_transparency int check (price_transparency between 1 and 5),
  value_for_money int check (value_for_money between 1 and 5),
  
  -- Overall
  overall_score int check (overall_score between 1 and 10),
  would_return boolean,
  would_recommend boolean,
  best_for text,
  best_thing text,
  biggest_drawback text,
  
  -- Photos
  photo_urls text[],
  
  -- Status
  status text default 'pending' check (status in ('pending', 'approved', 'rejected')),
  verified_at timestamptz,
  created_at timestamptz default now()
);

-- RLS
alter table reviewer_applications enable row level security;
alter table reviewer_assignments enable row level security;
alter table studio_reviews enable row level security;

-- Anon: apply to be reviewer, submit reviews
create policy "anon_apply" on reviewer_applications for insert with check (true);
create policy "anon_submit" on studio_reviews for insert with check (true);

-- Admin: manage all
create policy "admin_all_reviewer_apps" on reviewer_applications using (true);
create policy "admin_all_assignments" on reviewer_assignments using (true);
create policy "admin_all_reviews" on studio_reviews using (true);
