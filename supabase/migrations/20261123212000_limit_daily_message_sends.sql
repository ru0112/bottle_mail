drop policy if exists "Authenticated users can post messages" on public.messages;
revoke insert on public.messages from anon, authenticated;

create index messages_user_id_created_at_idx
  on public.messages (user_id, created_at);

create index message_replies_user_id_created_at_idx
  on public.message_replies (user_id, created_at);

create or replace function public.create_message(p_content text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  action_time timestamptz;
  jst_day date;
  day_start timestamptz;
  day_end timestamptz;
  message_count integer;
begin
  if current_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'メッセージを流すにはログインが必要です。';
  end if;

  if p_content is null or btrim(p_content) = '' then
    raise exception using
      errcode = '22023',
      message = 'メッセージを入力してください。';
  end if;

  if char_length(btrim(p_content)) > 200 then
    raise exception using
      errcode = '22023',
      message = 'メッセージは200文字以内で入力してください。';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(current_user_id::text || ':message', 0)
  );
  action_time := clock_timestamp();
  jst_day := (action_time at time zone 'Asia/Tokyo')::date;
  day_start := jst_day::timestamp at time zone 'Asia/Tokyo';
  day_end := (jst_day + 1)::timestamp at time zone 'Asia/Tokyo';

  select count(*)::integer
  into message_count
  from public.messages as message
  where message.user_id = current_user_id
    and message.created_at >= day_start
    and message.created_at < day_end;

  if message_count >= 1 then
    raise exception using
      errcode = '22023',
      message = '本日の新規投稿上限に達しました。';
  end if;

  insert into public.messages (content, user_id, created_at)
  values (btrim(p_content), current_user_id, action_time);
end;
$$;

revoke all on function public.create_message(text) from public, anon, authenticated;
grant execute on function public.create_message(text) to authenticated;

create or replace function public.create_message_reply(
  p_message_id uuid,
  p_content text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  parent_message public.messages%rowtype;
  reply_count integer;
  daily_reply_count integer;
  last_speaker_id uuid;
  action_time timestamptz;
  jst_day date;
  day_start timestamptz;
  day_end timestamptz;
begin
  if current_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'ログインが必要です。';
  end if;

  if p_content is null or btrim(p_content) = '' then
    raise exception using
      errcode = '22023',
      message = '返信を入力してください。';
  end if;

  if char_length(btrim(p_content)) > 200 then
    raise exception using
      errcode = '22023',
      message = '返信は200文字以内で入力してください。';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(current_user_id::text || ':reply', 0)
  );
  action_time := clock_timestamp();
  jst_day := (action_time at time zone 'Asia/Tokyo')::date;
  day_start := jst_day::timestamp at time zone 'Asia/Tokyo';
  day_end := (jst_day + 1)::timestamp at time zone 'Asia/Tokyo';

  select count(*)::integer
  into daily_reply_count
  from public.message_replies as reply
  where reply.user_id = current_user_id
    and reply.created_at >= day_start
    and reply.created_at < day_end;

  if daily_reply_count >= 1 then
    raise exception using
      errcode = '22023',
      message = '本日の返信上限に達しました。';
  end if;

  select message.*
  into parent_message
  from public.messages as message
  where message.id = p_message_id
  for update;

  if not found then
    raise exception using
      errcode = '42501',
      message = 'このスレッドには返信できません。';
  end if;

  select count(*)::integer
  into reply_count
  from public.message_replies as reply
  where reply.message_id = p_message_id;

  if reply_count = 0 then
    if parent_message.user_id <> current_user_id then
      if parent_message.recipient_id is not null
        and parent_message.recipient_id <> current_user_id
      then
        raise exception using
          errcode = '22023',
          message = 'このメッセージは既に他のユーザーとやり取りが始まりました';
      end if;

      update public.messages as message
      set recipient_id = current_user_id
      where message.id = p_message_id
        and message.recipient_id is null;

      if not found
        and parent_message.recipient_id is distinct from current_user_id
      then
        raise exception using
          errcode = '22023',
          message = 'このメッセージは既に他のユーザーとやり取りが始まりました';
      end if;

      parent_message.recipient_id := current_user_id;
    end if;
  elsif parent_message.user_id is distinct from current_user_id
    and parent_message.recipient_id is distinct from current_user_id
  then
    raise exception using
      errcode = '22023',
      message = 'このメッセージは既に他のユーザーとやり取りが始まりました';
  end if;

  if reply_count >= 3 then
    raise exception using
      errcode = '22023',
      message = 'このスレッドのやり取りは終了しています。';
  end if;

  select reply.user_id
  into last_speaker_id
  from public.message_replies as reply
  where reply.message_id = p_message_id
  order by reply.created_at desc, reply.id desc
  limit 1;

  if not found then
    last_speaker_id := parent_message.user_id;
  end if;

  if last_speaker_id = current_user_id then
    raise exception using
      errcode = '22023',
      message = '相手の返信を待ってから送信してください。';
  end if;

  insert into public.message_replies (
    message_id,
    user_id,
    content,
    created_at
  )
  values (p_message_id, current_user_id, btrim(p_content), action_time);
end;
$$;

revoke all on function public.create_message_reply(uuid, text) from public, anon, authenticated;
grant execute on function public.create_message_reply(uuid, text) to authenticated;

create or replace function public.get_daily_message_usage()
returns table (
  message_count integer,
  reply_count integer,
  resets_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  jst_day date;
  day_start timestamptz;
  day_end timestamptz;
begin
  if current_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'ログインが必要です。';
  end if;

  jst_day := (statement_timestamp() at time zone 'Asia/Tokyo')::date;
  day_start := jst_day::timestamp at time zone 'Asia/Tokyo';
  day_end := (jst_day + 1)::timestamp at time zone 'Asia/Tokyo';

  return query
  select
    (
      select count(*)::integer
      from public.messages as message
      where message.user_id = current_user_id
        and message.created_at >= day_start
        and message.created_at < day_end
    ),
    (
      select count(*)::integer
      from public.message_replies as reply
      where reply.user_id = current_user_id
        and reply.created_at >= day_start
        and reply.created_at < day_end
    ),
    day_end;
end;
$$;

revoke all on function public.get_daily_message_usage() from public, anon, authenticated;
grant execute on function public.get_daily_message_usage() to authenticated;
