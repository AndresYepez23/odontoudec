# Encuesta estudiantil — diseño de persistencia y permisos

Estado: propuesta técnica; no aplicada a Supabase.
Rama: `redesign/ux-audit-2026-11-05`

## Decisiones confirmadas
- Solo usuarios autenticados pueden enviar.
- Una participación por cuenta para esta encuesta.
- Cada respuesta queda vinculada a la cuenta que la envió.
- Solo administradores pueden consultar respuestas individuales y resultados.
- Estudiantes no pueden leer, editar ni borrar respuestas; tampoco consultar resultados.
- El formulario actual es una vista previa: no persiste respuestas todavía.

## Modelo propuesto
Una tabla de envíos, por ejemplo `survey_submissions`:
- `id`: UUID, clave primaria.
- `survey_key`: identificador estable de la encuesta (por ejemplo `reconocimientos-2026`).
- `user_id`: UUID que referencia `auth.users`.
- `answers`: JSONB con las 15 respuestas validadas.
- `submitted_at`: timestamp generado en servidor.
- Restricción única sobre `(survey_key, user_id)` para impedir duplicados incluso con envíos simultáneos.

## Validación
- El backend valida que estén presentes las 15 categorías.
- Las 8 categorías con candidatos aceptan únicamente un valor de la lista vigente para esa categoría.
- Las 7 categorías abiertas aceptan texto con límites de longitud y normalización.
- No confiar en etiquetas, IDs o nombres enviados libremente por el navegador.
- El servidor establece `user_id` a partir de la sesión autenticada; nunca aceptar un `user_id` suministrado por el cliente.
- La restricción única es la defensa final contra doble participación.

## Acceso y RLS
- Activar RLS.
- No conceder SELECT, UPDATE ni DELETE a estudiantes.
- El envío debe ocurrir mediante una operación controlada que compruebe sesión y valide el payload.
- La lectura administrativa debe validar el rol desde una fuente de autorización confiable. No usar `user_metadata` editable por el usuario.
- Revisar cómo se consulta actualmente `user_roles`: la inspección encontró dos registros administrativos y ninguna política RLS visible en esa tabla. No asumir que una consulta directa desde el cliente será segura.
- Preferir una función/RPC o backend con privilegios mínimos para las operaciones necesarias. Si se usa SECURITY DEFINER, debe residir en esquema no expuesto, comprobar explícitamente `auth.uid()` y restringir EXECUTE; nunca publicar una función privilegiada sin control.
- Los resultados agregados e individuales se exponen únicamente a administradores autorizados.

## Pendientes antes de implementar
1. Confirmar la regla de elegibilidad: la inspección no encontró roles `student`; decidir si toda cuenta autenticada habilitada puede responder o si se requiere validar perfil/semestre.
2. Confirmar identificador y periodo oficial de la encuesta, fecha de apertura y cierre.
3. Implementar migración versionada en la rama y revisar SQL/RLS.
4. Probar con dos cuentas de estudiante y una cuenta administradora: envío, duplicado, intento de lectura ajena, acceso a resultados y validación de respuestas.
5. Ejecutar la migración en producción solo con aprobación explícita.

## SMTP aplazado
No es un bloqueo para diseñar la encuesta. Antes de la prueba real de registro y recuperación con tráfico se retomará SMTP personalizado de Supabase Auth (Resend recomendado; Brevo alternativa), con SPF/DKIM y pruebas de confirmación y recuperación.


## Hallazgos de esquema verificados (lectura solamente)
- `public.user_roles` tiene columnas `user_id` y `role`; el rol admite `admin` y `student`, con `student` como valor por defecto. En la inspección actual aparecen dos registros administrativos y ningún registro estudiantil.
- Por lo anterior, no se debe implementar todavía una condición que exija una fila `role = 'student'`: bloquearía a las cuentas estudiantiles existentes que no tengan esa fila. La regla de elegibilidad debe resolverse explícitamente antes de activar la encuesta.
- La tabla `public.profiles` tiene 9 perfiles en la inspección; no todos tienen semestre informado, por lo que tampoco se debe usar el semestre como requisito implícito.
- Supabase anunció que las tablas nuevas de `public` dejaron de exponerse automáticamente a Data API en 2026. La futura migración debe declarar de forma explícita los privilegios necesarios y comprobar la configuración de esquemas expuestos; RLS por sí sola no habilita el acceso a Data API.
- No se ejecutó SQL, no se creó tabla ni se modificaron roles o permisos en el proyecto.


## Implementación propuesta en rama (no desplegada)
- El diseño de almacenamiento se ajustó a una tabla en `public` con RLS activado y privilegios revocados para `anon`, `authenticated` y `PUBLIC`; solo `service_role` tendrá permisos de tabla. Así la Edge Function puede consultarla mediante la API estándar sin exponer el esquema privado en Data API.
- La función `survey-submissions` valida el JWT con `auth.getUser(token)`, valida las 15 respuestas contra el catálogo del servidor, exige perfil existente, inserta con clave única por usuario/encuesta y devuelve resultados solo si `user_roles.role = 'admin'`.
- La consulta administrativa devuelve nombre, identificador público, semestre (si está informado), fecha y respuestas para atribución individual, según la decisión del propietario del proyecto.
- La función tiene `verify_jwt = false` para admitir la publishable key nueva; por eso valida obligatoriamente el token de sesión dentro del código antes de cualquier acción. La clave secreta solo se lee desde variables de entorno del servidor.
- La migración y la función son archivos de la rama; no se aplicaron ni desplegaron. Antes de activar: revisar permisos Data API, ejecutar migración en entorno controlado, desplegar función y probar con cuentas separadas.
