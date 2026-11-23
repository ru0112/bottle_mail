alter table public.messages
  add constraint messages_content_max_length
  check (char_length(content) <= 200)
  not valid;

alter table public.message_replies
  add constraint message_replies_content_max_length
  check (char_length(content) <= 200)
  not valid;
