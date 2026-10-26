-- ============================================================================
-- 02 · 个人状态表（星标 / 批注）
-- ----------------------------------------------------------------------------
-- 用法：Supabase Dashboard → SQL Editor → New query → 全选粘贴 → Run
-- 幂等：可重复执行，不会重复建表，也不会覆盖已有的个人状态。
--
-- 为什么单独建表：
--   distill_cards 是"内容"，一张卡片只有一行，所有人共享；
--   星标和批注是"我的状态"，每个人各不相同。
--   两者混在同一行时，谁收藏了别人也看得见，公开默认就被污染了。
--   拆开之后规则只剩两条：
--     收藏与批注：任何登录用户都能写，只写自己的行
--     删除卡片：  只限卡片创建者
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. 表结构
--    personal_note 允许为 null，语义是"我还没写过，沿用卡片自带的批注"；
--    写成空字符串 '' 则表示"我主动清空了"。
-- ---------------------------------------------------------------------------
create table if not exists public.distill_card_personal (
  user_id         uuid        not null references auth.users (id) on delete cascade,
  card_id         uuid        not null references public.distill_cards (id) on delete cascade,
  starred         boolean     not null default false,
  personal_note   text,
  note_updated_at timestamptz,
  primary key (user_id, card_id)
);

comment on table  public.distill_card_personal                 is '每个用户对某张卡片的个人状态；与卡片内容分离，互不污染';
comment on column public.distill_card_personal.starred         is '我的星标状态；公开默认永远是 false';
comment on column public.distill_card_personal.personal_note   is '我的批注；null = 没写过，沿用 distill_cards.personal_note 的示例批注';
comment on column public.distill_card_personal.note_updated_at is '我的批注最后保存时间';

-- 卡片被删除时需要按 card_id 反查级联，单独建索引
create index if not exists distill_card_personal_card_idx
  on public.distill_card_personal (card_id);


-- ---------------------------------------------------------------------------
-- 2. 行级安全：只有本人能读写自己的状态，访客完全不可见
--    upsert 同时需要 insert 与 update 两条策略，少一条就会 403
-- ---------------------------------------------------------------------------
alter table public.distill_card_personal enable row level security;

drop policy if exists "personal_select_own" on public.distill_card_personal;
create policy "personal_select_own"
  on public.distill_card_personal
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "personal_insert_own" on public.distill_card_personal;
create policy "personal_insert_own"
  on public.distill_card_personal
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "personal_update_own" on public.distill_card_personal;
create policy "personal_update_own"
  on public.distill_card_personal
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "personal_delete_own" on public.distill_card_personal;
create policy "personal_delete_own"
  on public.distill_card_personal
  for delete
  to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.distill_card_personal to authenticated;


-- ---------------------------------------------------------------------------
-- 3. 公开默认：全部不收藏
--    当前有 3 条预置卡是 starred = true，置零后访客看到的就是干净默认态；
--    各人的收藏从此只存在于上面那张个人状态表里。
-- ---------------------------------------------------------------------------
update public.distill_cards
set starred = false
where starred = true;


-- ---------------------------------------------------------------------------
-- 4. 自检（执行后应返回 0 行）
-- ---------------------------------------------------------------------------
-- select id, title, starred from public.distill_cards where starred = true;
