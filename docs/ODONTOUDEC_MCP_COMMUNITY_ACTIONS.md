# OdontoUdeC MCP Cuentas — acciones de comunidad v0.3

Endpoint: `https://jqbrheonqqsiijrprsqs.supabase.co/functions/v1/odontoudec-mcp-cuentas`

El servidor requiere OAuth de Supabase y ejecuta operaciones con el JWT de la cuenta conectada. No usa una clave service-role en el MCP.

## Herramientas de lectura
- `mi_cuenta_odontoudec`: perfil propio y rol real.
- `navegar_odontoudec`: rutas conocidas; panel de administración solo para admins.
- `resumen_administrativo_odontoudec`: contadores agregados solo para admins.
- `trafico_administrativo_odontoudec`: resumen PostHog solo para admins.
- `listar_publicaciones`, `listar_chat_general`, `listar_grupos_estudio`.
- `listar_mensajes_grupo`: RLS comprueba que el usuario pertenezca al grupo.
- `listar_conversaciones_privadas` y `leer_mensajes_privados`: RLS comprueba que el usuario sea participante.
- `listar_recursos_biblioteca`: recursos académicos públicos.

## Herramientas de escritura con confirmación
Las herramientas de escritura devuelven una vista previa y no escriben nada mientras `confirmar=false`. El cliente debe volver a invocarlas con `confirmar=true` tras la aprobación explícita del usuario.
- `crear_publicacion`, `comentar_publicacion`.
- `enviar_mensaje_chat_general`, `enviar_mensaje_grupo`, `enviar_mensaje_privado`.
- `crear_grupo_estudio` (el trigger existente registra al creador como propietario).
- `unirse_grupo_estudio` (solo grupos abiertos, de acuerdo con RLS).
- `iniciar_conversacion_privada` (solo perfiles públicos identificados por ID público).
- `agregar_recurso_biblioteca` (enlace HTTPS; la ficha será pública).

## Subida de archivos a Biblioteca
Se creó el bucket público `academic-library`.
- Lectura de archivos: pública, para que los materiales publicados sean accesibles desde la Biblioteca.
- Escritura, actualización y eliminación: solo cuentas con `public.is_admin()`.
- Tipos: PDF, DOCX, PPTX, XLSX, JPEG, PNG y WebP.
- Tamaño máximo: 15 MiB.
- `preparar_subida_archivo_biblioteca`: genera un enlace temporal de carga firmado (válido por 2 horas) y una página de selección de archivo en `/biblioteca-upload.html`. El token se conserva en el fragmento de la URL, no se envía al servidor web.
- `confirmar_subida_archivo_biblioteca`: verifica que el objeto exista, comprueba tamaño y firma del contenido, muestra una vista previa y registra el recurso en `academic_resources` solo con `confirmar=true`.
- El archivo queda en el bucket público, pero no aparece en el catálogo hasta que se confirme su ficha.
- Los enlaces HTTPS externos pueden añadirse por cualquier usuario autenticado conforme a la política RLS preexistente; los archivos binarios se reservan a administradores.
- El flujo evita enviar el archivo en base64 a través de MCP, lo que sería demasiado pesado para documentos habituales.

## Seguridad y auditoría
- Todas las herramientas autenticadas requieren un usuario OAuth válido.
- La identidad se obtiene de Supabase Auth; el rol admin se valida con `public.is_admin()` en cada herramienta administrativa.
- Las lecturas y escrituras de mensajes, grupos, publicaciones y recursos usan el cliente Supabase ligado al usuario, por lo que se mantienen las políticas RLS existentes.
- Nunca se usa el rol service-role en el MCP.
- Se creó `private.mcp_action_audit`, sin acceso directo de anon/authenticated, y una función acotada `public.mcp_log_action` (EXECUTE solo para authenticated) que registra actor, acción y destino; no almacena texto de mensajes.
- El bucket de Biblioteca es público por diseño: no subir historiales clínicos, datos de pacientes, documentos personales ni material con derechos no autorizados.
- Las acciones de escritura no se ejecutan sin la confirmación booleana explícita.
- La subida de archivos requiere rol administrador; los estudiantes pueden añadir enlaces HTTPS con las reglas existentes.

## Migraciones aplicadas en Supabase
- `20261107062958_odontoudec_mcp_community_actions_and_library_storage`
- `20261107063014_expose_authenticated_mcp_audit_wrapper`

## Actualización del conector ChatGPT
Tras desplegar nuevas herramientas, ChatGPT puede mantener en caché la lista anterior. Actualiza/reconecta el servidor **OdontoUdeC Cuentas** para que vuelva a ejecutar `tools/list` y descubra las nuevas operaciones. No elimines el plugin público **OdontoUdeC**.
