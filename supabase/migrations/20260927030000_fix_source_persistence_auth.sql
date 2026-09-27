-- Fix the server-only source persistence RPC.
-- SECURITY DEFINER changes current_user to the function owner (postgres),
-- so authorization must inspect the request JWT role instead.
create or replace function public.enqueue_source_persistence(payload jsonb)
returns bigint
language plpgsql
security definer
set search_path = ''
as $function$
declare
  msg_id bigint;
  jwt_role text;
begin
  jwt_role := coalesce(
    current_setting('request.jwt.claim.role', true),
    current_setting('request.jwt.claims', true)::jsonb ->> 'role'
  );

  if jwt_role <> 'service_role' then
    raise exception 'forbidden';
  end if;

  select pgmq.send('source_persistence', payload) into msg_id;
  return msg_id;
end;
$function$;

create or replace function public.enqueue_source_persistence_batch(payloads jsonb[])
returns bigint[]
language plpgsql
security definer
set search_path = ''
as $function$
declare
  ids bigint[];
  jwt_role text;
begin
  jwt_role := coalesce(
    current_setting('request.jwt.claim.role', true),
    current_setting('request.jwt.claims', true)::jsonb ->> 'role'
  );

  if jwt_role <> 'service_role' then
    raise exception 'forbidden';
  end if;

  select array_agg(id) into ids
  from pgmq.send_batch('source_persistence', coalesce(payloads, '{}'::jsonb[]));
  return coalesce(ids, '{}'::bigint[]);
end;
$function$;
