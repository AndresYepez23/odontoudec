-- Amplía las reacciones de mensajes para usar los seis SVG institucionales.
-- Conserva temporalmente las claves anteriores para no invalidar reacciones existentes.
begin;
alter table public.chat_message_reactions
  drop constraint if exists chat_message_reactions_reaction_check;
alter table public.chat_message_reactions
  add constraint chat_message_reactions_reaction_check
  check (reaction in (
    'apoyo','me_encanta','idea','gracias','divertido','sorprendido',
    'like','love','laughing','soaked','sad','angry'
  ));
commit;
