-- BGMクイズオンライン対戦用テーブル

create table if not exists public.bgm_quiz_rooms (
  room_code text primary key,
  status text not null default 'lobby',
  current_index integer not null default 0,
  total_questions integer not null default 0,
  game_type text not null default 'fast',
  host_player_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.bgm_quiz_questions (
  id bigserial primary key,
  room_code text not null references public.bgm_quiz_rooms(room_code) on delete cascade,
  question_index integer not null,
  track_file text not null,
  choices text[] not null,
  correct_index integer not null,
  is_solved boolean not null default false,
  winner_player_id uuid,
  created_at timestamptz not null default now(),
  unique (room_code, question_index)
);

create table if not exists public.bgm_quiz_questions_public (
  id bigserial primary key,
  room_code text not null references public.bgm_quiz_rooms(room_code) on delete cascade,
  question_index integer not null,
  track_file text not null,
  choices text[] not null,
  is_solved boolean not null default false,
  winner_player_id uuid,
  created_at timestamptz not null default now(),
  unique (room_code, question_index)
);

create table if not exists public.bgm_quiz_players (
  id bigserial primary key,
  room_code text not null references public.bgm_quiz_rooms(room_code) on delete cascade,
  player_id uuid not null,
  display_name text not null,
  score integer not null default 0,
  created_at timestamptz not null default now(),
  unique (room_code, player_id)
);

create table if not exists public.bgm_quiz_answers (
  id bigserial primary key,
  room_code text not null references public.bgm_quiz_rooms(room_code) on delete cascade,
  player_id uuid not null,
  question_index integer not null,
  choice_index integer not null,
  is_correct boolean not null,
  stop_time numeric(10, 2),
  answer_time numeric(10, 2),
  created_at timestamptz not null default now()
);

create or replace function public.increment_bgm_quiz_score(p_room_code text, p_player_id uuid)
returns void
language plpgsql
as $$
begin
  update public.bgm_quiz_players
  set score = score + 1
  where room_code = p_room_code
    and player_id = p_player_id;
end;
$$;

alter table public.bgm_quiz_rooms enable row level security;
alter table public.bgm_quiz_questions enable row level security;
alter table public.bgm_quiz_questions_public enable row level security;
alter table public.bgm_quiz_players enable row level security;
alter table public.bgm_quiz_answers enable row level security;

-- 参加リンク経由の匿名ユーザーでも参照できるよう公開（ルームコード前提のため推測困難）
create policy "bgm_quiz_rooms_read"
  on public.bgm_quiz_rooms for select
  using (true);

create policy "bgm_quiz_questions_public_read"
  on public.bgm_quiz_questions_public for select
  using (true);

create policy "bgm_quiz_players_read"
  on public.bgm_quiz_players for select
  using (true);

create policy "bgm_quiz_players_insert"
  on public.bgm_quiz_players for insert
  with check (true);

create policy "bgm_quiz_answers_insert"
  on public.bgm_quiz_answers for insert
  with check (true);
