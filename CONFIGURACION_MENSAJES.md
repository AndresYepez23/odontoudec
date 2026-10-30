# Configuración: nombres de usuario y mensajes privados

Esta mejora se prepara en una rama separada. Antes de publicarla, completa estos pasos:

## 1. Ejecutar la migración de Supabase

1. Abre el proyecto de Supabase de OdontoUdeC.
2. Entra en **SQL Editor**.
3. Abre el archivo \`supabase/migrations/20261030000000_usernames_private_messaging.sql\` de esta rama.
4. Copia y ejecuta el SQL completo.

La migración:
- Agrega un nombre de usuario único, sin distinguir mayúsculas/minúsculas.
- Mantiene las cuentas y contraseñas existentes.
- Crea un índice privado para resolver el nombre de usuario a correo sin exponer correos en la tabla pública de perfiles.
- Crea las tablas de conversaciones y mensajes privados con políticas RLS para que solo los participantes puedan leer o enviar mensajes.
- Permite que los usuarios antiguos elijan su nombre de usuario desde la pantalla de mensajes privados.

## 2. Configurar variables en Netlify

En **Site configuration → Environment variables**, agrega:

- \`SUPABASE_URL\`: URL del proyecto Supabase.
- \`SUPABASE_ANON_KEY\`: la clave pública/publishable del proyecto (la misma que usa el frontend).
- \`SUPABASE_SERVICE_ROLE_KEY\`: clave secreta service_role del proyecto.

**Importante:** la clave service_role es privada. Solo se configura en Netlify y nunca debe agregarse al HTML, al repositorio ni compartirse públicamente.

## 3. Publicar

Después de ejecutar el SQL y guardar las variables:
1. Revisa el pull request de la rama \`feat/auth-private-messaging\`.
2. Combina el PR con \`main\` cuando estés conforme.
3. Netlify desplegará la versión nueva si está conectado a la rama principal.

## 4. Cuentas existentes

Las cuentas actuales siguen iniciando sesión con su correo y contraseña. Al abrir **Mensajes privados**, cada estudiante que todavía no tenga usuario verá un formulario para elegir uno. A partir de ahí podrá iniciar sesión con correo o nombre de usuario.

## 5. Límite de esta primera versión

Los mensajes privados se actualizan automáticamente cada cinco segundos. No se habilitan adjuntos ni envío de información identificable de pacientes.
