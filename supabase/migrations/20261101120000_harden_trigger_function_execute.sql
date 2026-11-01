-- These SECURITY DEFINER routines are trigger-only and must not be exposed as RPCs.
revoke execute on function public.assign_student_public_id() from public, anon, authenticated;
revoke execute on function public.check_chat_rate_limit() from public, anon, authenticated;
revoke execute on function public.sync_odontoudec_user() from public, anon, authenticated;
revoke execute on function public.touch_private_conversation() from public, anon, authenticated;

-- Admin status is only meaningful for authenticated sessions.
revoke execute on function public.is_admin() from public, anon;
