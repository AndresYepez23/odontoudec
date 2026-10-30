# Configuración: acceso por correo y mensajes privados

Esta mejora se prepara en una rama separada. El acceso usa únicamente nombre visible, correo electrónico y contraseña. No se pide ni se utiliza un nombre de usuario.

## 1. Ejecutar la migración de búsqueda por nombre

La migración inicial de mensajes privados ya fue ejecutada. Ahora, en Supabase → SQL Editor, abre y ejecuta una sola vez:

`supabase/migrations/20261030010000_search_students_legacy_accounts.sql`

Esta actualización completa los perfiles de cuentas existentes que no tengan nombre visible y permite buscar compañeros por su nombre. No modifica correos ni contraseñas.

## 2. Variables de Netlify

El frontend utiliza:
- `SUPABASE_URL`: URL del proyecto Supabase.
- `SUPABASE_ANON_KEY`: clave pública/publishable del proyecto.

La función de acceso con nombre de usuario ya no se utiliza. La clave service_role no debe ponerse en el frontend ni compartirse públicamente.

## 3. Pruebas antes de publicar

1. Comprueba el registro con nombre, correo y contraseña.
2. Comprueba el inicio de sesión con correo y contraseña.
3. Busca un compañero por su nombre.
4. Abre una conversación y prueba el envío y recepción de mensajes.
5. Verifica que la comunidad y el chat grupal sigan funcionando.

No combines el PR con `main` hasta completar estas pruebas.

## 4. Alcance de esta primera versión

Los mensajes privados se actualizan automáticamente cada cinco segundos. No se habilitan adjuntos ni envío de información identificable de pacientes.
