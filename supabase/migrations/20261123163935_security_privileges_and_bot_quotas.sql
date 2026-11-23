-- Manual review/apply only, in OdontoUDEC. No data or RLS policy is changed.
BEGIN;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLE
 public.academic_events, public.academic_progress, public.academic_resources,
 public.chat_message_reactions, public.chat_messages, public.chat_reports,
 public.comments, public.content_reports, public.post_comments, public.post_reactions,
 public.posts, public.private_conversations, public.private_message_reads,
 public.private_messages, public.profiles, public.resource_collections,
 public.saved_resources, public.student_notes, public.student_reminders,
 public.study_activity, public.study_group_members, public.study_group_messages,
 public.study_groups, public.user_roles
 FROM anon, authenticated;

-- Fail closed if inherited grants or schema drift leave an effective excess grant.
DO $$
BEGIN
 IF EXISTS (
  SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  CROSS JOIN (VALUES('anon'),('authenticated')) r(role_name)
  CROSS JOIN (VALUES('TRUNCATE'),('TRIGGER'),('REFERENCES')) p(privilege)
  WHERE n.nspname='public' AND c.relkind IN ('r','p')
   AND has_table_privilege(r.role_name,c.oid,p.privilege)
 ) THEN RAISE EXCEPTION 'Excess privileges remain; review inherited grants and schema drift'; END IF;
END $$;

CREATE SCHEMA IF NOT EXISTS private;
CREATE TABLE IF NOT EXISTS private.odonto_bot_limits (
 scope text NOT NULL,
 window_start bigint NOT NULL,
 request_count integer NOT NULL CHECK (request_count >= 0),
 PRIMARY KEY(scope, window_start)
);
CREATE INDEX IF NOT EXISTS odonto_bot_limits_window_idx ON private.odonto_bot_limits(window_start);
ALTER TABLE private.odonto_bot_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.odonto_bot_limits FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.reserve_odonto_bot_request(p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 minute_start bigint := floor(extract(epoch FROM now()) / 60)::bigint;
 day_start bigint;
 entry record;
 consumed integer;
BEGIN
 IF p_user_id IS NULL THEN RAISE EXCEPTION 'Verified user required'; END IF;
 day_start := (minute_start / 1440) * 1440;
 DELETE FROM private.odonto_bot_limits WHERE window_start < day_start - 2880;
 FOR entry IN SELECT * FROM (VALUES
   ('user-minute:' || p_user_id::text, minute_start, 6, 1),
   ('user-day:' || p_user_id::text, day_start, 40, 1440),
   ('global-day', day_start, 200, 1440)
 ) AS limits(scope, window_start, cap, duration)
 LOOP
   consumed := NULL;
   INSERT INTO private.odonto_bot_limits AS current(scope,window_start,request_count)
   VALUES(entry.scope,entry.window_start,1)
   ON CONFLICT(scope,window_start) DO UPDATE
     SET request_count = current.request_count + 1 WHERE current.request_count < entry.cap
   RETURNING request_count INTO consumed;
   IF consumed IS NULL THEN
     RETURN jsonb_build_object('allowed',false,'retry_after',
       greatest(1,(entry.window_start + entry.duration)*60 - floor(extract(epoch FROM now()))::bigint));
   END IF;
 END LOOP;
 RETURN jsonb_build_object('allowed',true);
END $$;
REVOKE ALL ON FUNCTION public.reserve_odonto_bot_request(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_odonto_bot_request(uuid) TO service_role;
COMMIT;
