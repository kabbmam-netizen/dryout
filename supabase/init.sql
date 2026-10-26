-- ============================================================================
-- VibeDistill / DRYOUT 内容切片机 — Supabase 初始化脚本
-- ----------------------------------------------------------------------------
-- 用法：Supabase Dashboard → SQL Editor → New query → 全选粘贴 → Run
--
-- 本脚本 **幂等且非破坏**：可以重复执行，不会删除任何已有数据。
--   已存在的表  → 只补缺失的列、改名、修正约束，不重建
--   种子数据    → on conflict do nothing，已存在的行不会被覆盖
--
-- 想清空重来，请用 supabase/reset.sql（那个会 drop 表，是破坏性的）。
--
-- 表结构说明：
--   distill_cards          卡片内容 + 公开默认值，一张卡一行，所有人共享
--   distill_card_personal  每个用户对某张卡的星标与批注，按 (user_id, card_id)
--
-- 命名差异（容易看错，先说明）：
--   distill_cards.sample_note    卡片的「示例批注」，公开默认，谁都能看到
--   distill_card_personal.personal_note  我自己写的那条，只有我能看到
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. 卡片表
-- ---------------------------------------------------------------------------
create table if not exists public.distill_cards (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references auth.users (id) on delete cascade,

  title            text        not null,
  source_type      text        not null,
  source_name      text        not null default '',
  source_url       text        not null default '',
  source_assets    jsonb       not null default '[]'::jsonb,
  meta             text        not null default '',

  golden_quote     text        not null,
  one_line_summary text        not null,
  key_takeaways    text[]      not null default '{}',
  tags             text[]      not null default '{}',

  sample_note      text        not null default '',
  distilled_by     text        not null default 'local',
  is_public        boolean     not null default false,

  created_at       timestamptz not null default now(),
  note_updated_at  timestamptz
);


-- ---------------------------------------------------------------------------
-- 2. 增量迁移（对已存在的旧表补齐结构，不删数据）
-- ---------------------------------------------------------------------------

-- 2.1 personal_note → sample_note：先判断旧列在不在，再改名，最后兜底补列
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'distill_cards' and column_name = 'personal_note'
  ) then
    alter table public.distill_cards rename column personal_note to sample_note;
  end if;
end $$;

alter table public.distill_cards add column if not exists sample_note  text    not null default '';
alter table public.distill_cards add column if not exists distilled_by text    not null default 'local';

-- 2.2 星标只存在于个人状态表，卡片行不再保留该列
alter table public.distill_cards drop column if exists starred;

-- 2.3 来源类型从「平台」改为「形态」：bilibili → video
--     顺序很重要：**先拆旧约束，再改数据，最后建新约束**。
--     反过来写的话，update 会被旧的 check（只允许 podcast/bilibili/article）拦住；
--     而 SQL Editor 把整份脚本当一个事务，一条失败就全部回滚，
--     表现出来就是「脚本跑完了但什么都没变」。
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.distill_cards'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%source_type%'
  loop
    execute format('alter table public.distill_cards drop constraint %I', c.conname);
  end loop;
end $$;

update public.distill_cards set source_type = 'video' where source_type = 'bilibili';

alter table public.distill_cards
  add constraint distill_cards_source_type_check
  check (source_type in ('podcast', 'video', 'article'));

alter table public.distill_cards drop constraint if exists distill_cards_distilled_by_check;
alter table public.distill_cards
  add constraint distill_cards_distilled_by_check
  check (distilled_by in ('llm', 'local'));

-- 2.4 旧表的 is_public 默认值是 true，改成 false（新表建表时已经是 false）
--     前端插入时总会显式传 is_public，这里改默认值是为了兜住直接写 SQL 的场景
alter table public.distill_cards alter column is_public set default false;


comment on table  public.distill_cards                is '长内容脱水后的归档卡片；user_id 为 null 的是公开演示数据';
comment on column public.distill_cards.source_type    is '内容形态：podcast 播客 / video 视频 / article 深度长文（B 站与 YouTube 都是 video，用 source_name 区分平台）';
comment on column public.distill_cards.meta           is '展示用元信息，如「14 分钟阅读」「72 分钟」「18:24」';
comment on column public.distill_cards.source_assets  is '本地附件元信息数组，元素形如 {"kind","name","size","duration","cueCount"}，不含文件本体';
comment on column public.distill_cards.key_takeaways  is '三段式论据，按顺序渲染为 01—03';
comment on column public.distill_cards.sample_note    is '示例批注：公开默认值，用户没写过自己的批注时展示它';
comment on column public.distill_cards.distilled_by   is '产出方式：llm 由大模型生成 / local 由本地启发式算法降级生成';
comment on column public.distill_cards.is_public      is '是否公开；新建卡片默认 false（私密）';
comment on column public.distill_cards.note_updated_at is '个人批注最后保存时间；未修改过为 null';

create index if not exists distill_cards_created_at_idx on public.distill_cards (created_at desc);
create index if not exists distill_cards_user_id_idx    on public.distill_cards (user_id);
create index if not exists distill_cards_tags_idx       on public.distill_cards using gin (tags);


-- ---------------------------------------------------------------------------
-- 3. 个人状态表（星标 / 批注）
--    personal_note 为 null 表示「我还没写过」，展示时沿用 sample_note；
--    写成空字符串则表示「我主动清空了」。
-- ---------------------------------------------------------------------------
create table if not exists public.distill_card_personal (
  user_id         uuid        not null references auth.users (id) on delete cascade,
  card_id         uuid        not null,
  starred         boolean     not null default false,
  personal_note   text,
  note_updated_at timestamptz,
  primary key (user_id, card_id)
);

-- 外键单独补建：旧库可能因为历史 drop ... cascade 丢掉了它
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.distill_card_personal'::regclass and contype = 'f'
  ) then
    alter table public.distill_card_personal
      add constraint distill_card_personal_card_id_fkey
      foreign key (card_id) references public.distill_cards (id) on delete cascade;
  end if;
end $$;

create index if not exists distill_card_personal_card_idx on public.distill_card_personal (card_id);

comment on table  public.distill_card_personal               is '每个用户对某张卡片的个人状态；与卡片内容分离，互不污染';
comment on column public.distill_card_personal.starred       is '我的星标；卡片行不存星标';
comment on column public.distill_card_personal.personal_note is '我的批注；null = 没写过（沿用 sample_note），空字符串 = 主动清空';


-- ---------------------------------------------------------------------------
-- 4. 行级安全
-- ---------------------------------------------------------------------------
alter table public.distill_cards enable row level security;

drop policy if exists "cards_select_public_or_own" on public.distill_cards;
create policy "cards_select_public_or_own"
  on public.distill_cards for select to anon, authenticated
  using (is_public or auth.uid() = user_id);

drop policy if exists "cards_insert_own" on public.distill_cards;
create policy "cards_insert_own"
  on public.distill_cards for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "cards_update_own" on public.distill_cards;
create policy "cards_update_own"
  on public.distill_cards for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "cards_delete_own" on public.distill_cards;
create policy "cards_delete_own"
  on public.distill_cards for delete to authenticated
  using (auth.uid() = user_id);

grant select on public.distill_cards to anon, authenticated;
grant insert, update, delete on public.distill_cards to authenticated;

alter table public.distill_card_personal enable row level security;

drop policy if exists "personal_select_own" on public.distill_card_personal;
create policy "personal_select_own"
  on public.distill_card_personal for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "personal_insert_own" on public.distill_card_personal;
create policy "personal_insert_own"
  on public.distill_card_personal for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "personal_update_own" on public.distill_card_personal;
create policy "personal_update_own"
  on public.distill_card_personal for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "personal_delete_own" on public.distill_card_personal;
create policy "personal_delete_own"
  on public.distill_card_personal for delete to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.distill_card_personal to authenticated;


-- ---------------------------------------------------------------------------
-- 5. 预置演示数据
--    user_id 为 null，因此对所有人可读、任何人都不可改删。
--    on conflict do nothing：重复执行不会覆盖已被修改过的内容。
-- ---------------------------------------------------------------------------
insert into public.distill_cards (
  id, user_id, title, source_type, source_name, source_url, source_assets, meta,
  golden_quote, one_line_summary, key_takeaways, tags,
  sample_note, is_public, created_at, note_updated_at
)
values
  (
    '00000000-0000-4000-8000-000000000006',
    null,
    '工具应该让人更像自己',
    'video',
    'B站 · 产品观察室',
    '',
    '[]'::jsonb,
    '12:08',
    '好工具不会替你生活，它只会把障碍拿走，让你更像自己。',
    '工具的终点不是占据用户，而是让用户更自主地离开。',
    array['效率工具不应把人的价值压缩成可量化的使用时长。', '自动化应该消除重复劳动，而不是替人做所有判断。', '好的产品会增强用户的自主感，而不是制造新的依赖。'],
    array['工具', '自主性', '产品'],
    '',
    true,
    '2026-10-12T08:45:00+00:00',
    null
  ),
  (
    '00000000-0000-4000-8000-000000000005',
    null,
    '学习不是输入更多，而是留下改变',
    'podcast',
    '《组织进化论》EP.42',
    '',
    '[]'::jsonb,
    '46 分钟',
    '没有改变行为的学习，只是一场看起来很努力的娱乐。',
    '检验学习成果的不是笔记数量，而是下一次行动是否不同。',
    array['知识只有进入真实决策，才从被理解的信息变成个人能力。', '复盘应该记录行为变化，而不是重复摘抄已经知道的概念。', '降低输出门槛，比继续增加输入渠道更能形成学习闭环。'],
    array['学习', '复盘', '行动'],
    '',
    true,
    '2026-10-14T11:10:00+00:00',
    null
  ),
  (
    '00000000-0000-4000-8000-000000000004',
    null,
    '好设计为什么总是少做一点',
    'article',
    '设计深度 · 3200 字',
    '',
    '[]'::jsonb,
    '8 分钟阅读',
    '克制不是少放东西，而是每一件留下的东西都有非在不可的理由。',
    '设计中的删减不是风格选择，而是对信息优先级负责。',
    array['装饰与功能的区别，在于它是否帮助用户理解或完成任务。', '视觉一致性不是重复组件，而是重复清晰的决策原则。', '删除之前先确认层级，否则极简只会让重要信息一起消失。'],
    array['设计', '克制', '产品思维'],
    '这句话也可以作为本次作品集视觉设计的检查标准。',
    true,
    '2026-10-17T06:30:00+00:00',
    null
  ),
  (
    '00000000-0000-4000-8000-000000000003',
    null,
    '为什么你的效率系统总在第三周崩塌',
    'video',
    'B站 · 硬地骇客',
    '',
    '[]'::jsonb,
    '18:24',
    '真正的效率不是把日程塞满，而是给意外留出呼吸的空隙。',
    '效率系统的敌人不是懒，而是零冗余的日程表。',
    array['任何没有预留缓冲的计划，都会在第一次意外之后连锁崩塌。', '把计划完成率换成关键事项推进率，你会更容易坚持。', '能被疲惫状态下的自己执行的系统，才是真正有效的系统。'],
    array['效率', '时间管理', '习惯'],
    '',
    true,
    '2026-10-19T13:05:00+00:00',
    null
  ),
  (
    '00000000-0000-4000-8000-000000000002',
    null,
    '与 AI 共事的一年：从工具到同事',
    'podcast',
    '《晚点聊》Vol.128',
    '',
    '[]'::jsonb,
    '72 分钟',
    'AI 不会取代你，它只会把你本来是谁放大十倍。',
    '把 AI 当同事而不是工具，前提是你先拥有值得被放大的判断力。',
    array['从写提示词转向定义问题：能说清楚要什么，比会调参数更稀缺。', '把 AI 放进工作流的三层：检索与整理、初稿与变体、审稿与挑错。', '人类真正不可替代的是取舍：在信息不全时，决定做什么、不做什么。'],
    array['AI 协作', '判断力', '工作流'],
    '下次做项目复盘时，把 AI 的初稿与我的修改并排比较。',
    true,
    '2026-10-21T09:20:00+00:00',
    null
  ),
  (
    '00000000-0000-4000-8000-000000000001',
    null,
    '注意力是被设计的：信息过载时代的自保手册',
    'article',
    '深度长文 · 5500 字',
    '',
    '[]'::jsonb,
    '14 分钟阅读',
    '你不是缺少时间，你是把注意力租给了别人的商业模式。',
    '注意力不是自律问题，而是一场关于谁来决定你看什么的产权之争。',
    array['推荐算法的目标不是让你满意，而是让你停留，这两件事经常相反。', '高质量输入需要主动检索，而不是被动接收永无止境的信息流。', '给深度工作设置物理隔离，比设置 App 使用时长更有效。'],
    array['注意力', '媒介', '认知'],
    '试一周：每天上午十点前不打开任何信息流。',
    true,
    '2026-10-24T02:40:00+00:00',
    null
  )
on conflict (id) do nothing;
