-- BGMクイズオンライン対戦：RLSポリシー一括修正
-- 既存ポリシーを削除して、anonキーでも操作できるように再作成します。

alter table public.bgm_quiz_rooms enable row level security;
alter table public.bgm_quiz_questions enable row level security;
alter table public.bgm_quiz_questions_public enable row level security;
alter table public.bgm_quiz_players enable row level security;
alter table public.bgm_quiz_answers enable row level security;

drop policy if exists "bgm_quiz_rooms_read" on public.bgm_quiz_rooms;
drop policy if exists "bgm_quiz_rooms_insert" on public.bgm_quiz_rooms;
drop policy if exists "bgm_quiz_rooms_update" on public.bgm_quiz_rooms;

drop policy if exists "bgm_quiz_questions_read" on public.bgm_quiz_questions;
drop policy if exists "bgm_quiz_questions_insert" on public.bgm_quiz_questions;
drop policy if exists "bgm_quiz_questions_update" on public.bgm_quiz_questions;

drop policy if exists "bgm_quiz_questions_public_read" on public.bgm_quiz_questions_public;
drop policy if exists "bgm_quiz_questions_public_insert" on public.bgm_quiz_questions_public;
drop policy if exists "bgm_quiz_questions_public_update" on public.bgm_quiz_questions_public;

drop policy if exists "bgm_quiz_players_read" on public.bgm_quiz_players;
drop policy if exists "bgm_quiz_players_insert" on public.bgm_quiz_players;
drop policy if exists "bgm_quiz_players_update" on public.bgm_quiz_players;

drop policy if exists "bgm_quiz_answers_read" on public.bgm_quiz_answers;
drop policy if exists "bgm_quiz_answers_insert" on public.bgm_quiz_answers;
drop policy if exists "bgm_quiz_answers_update" on public.bgm_quiz_answers;

create policy "bgm_quiz_rooms_read"
  on public.bgm_quiz_rooms for select
  using (true);

create policy "bgm_quiz_rooms_insert"
  on public.bgm_quiz_rooms for insert
  with check (true);

create policy "bgm_quiz_rooms_update"
  on public.bgm_quiz_rooms for update
  using (true)
  with check (true);

create policy "bgm_quiz_questions_read"
  on public.bgm_quiz_questions for select
  using (true);

create policy "bgm_quiz_questions_insert"
  on public.bgm_quiz_questions for insert
  with check (true);

create policy "bgm_quiz_questions_update"
  on public.bgm_quiz_questions for update
  using (true)
  with check (true);

create policy "bgm_quiz_questions_public_read"
  on public.bgm_quiz_questions_public for select
  using (true);

create policy "bgm_quiz_questions_public_insert"
  on public.bgm_quiz_questions_public for insert
  with check (true);

create policy "bgm_quiz_questions_public_update"
  on public.bgm_quiz_questions_public for update
  using (true)
  with check (true);

create policy "bgm_quiz_players_read"
  on public.bgm_quiz_players for select
  using (true);

create policy "bgm_quiz_players_insert"
  on public.bgm_quiz_players for insert
  with check (true);

create policy "bgm_quiz_players_update"
  on public.bgm_quiz_players for update
  using (true)
  with check (true);

create policy "bgm_quiz_answers_insert"
  on public.bgm_quiz_answers for insert
  with check (true);

create policy "bgm_quiz_answers_read"
  on public.bgm_quiz_answers for select
  using (true);

create policy "bgm_quiz_answers_update"
  on public.bgm_quiz_answers for update
  using (true)
  with check (true);
