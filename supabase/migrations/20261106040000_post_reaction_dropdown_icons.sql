-- Permite las seis reacciones visuales nuevas en publicaciones.
-- Conserva las claves anteriores para que las reacciones ya guardadas sigan siendo válidas.
begin;
alter table public.post_reactions
  drop constraint if exists post_reactions_reaction_check;
alter table public.post_reactions
  add constraint post_reactions_reaction_check
  check (reaction in (
    'apoyo','me_encanta','idea','gracias','divertido','sorprendido',
    'like','love','laughing','soaked','sad','angry'
  ));
commit;
