# OdontoUdeC MCP — versión final 0.5.0

Endpoint: `https://jqbrheonqqsiijrprsqs.supabase.co/functions/v1/odontoudec-mcp-cuentas`

El servidor requiere OAuth de Supabase y ejecuta operaciones con el JWT de la cuenta conectada. Utiliza las políticas RLS y las funciones de autorización del proyecto. No utiliza `service_role` para las operaciones normales del MCP.

## Identidad y permisos por rol

- En cada solicitud, el servidor consulta `public.is_admin()` con la sesión OAuth actual.
- Las cuentas administradoras reciben las herramientas administrativas.
- Las cuentas estudiantiles no reciben en su catálogo MCP las herramientas de panel, tráfico, resultados de encuestas ni carga de archivos administrativos.
- La herramienta `mi_cuenta_odontoudec` identifica el rol real y el perfil propio.
- La ruta `admin` tampoco aparece entre las opciones de navegación de estudiantes.
- Las herramientas de escritura mantienen confirmación explícita y verificaciones de permisos en el servidor.
- Las instrucciones MCP presentan el servicio como el asistente oficial de OdontoUdeC, con respuestas institucionales y naturales.

## Literatura científica

La herramienta `buscar_literatura_cientifica` reutiliza las cuatro fuentes de la sección pública `/literatura-cientifica.html`:
- PubMed / NCBI (E-utilities).
- Europe PMC.
- OpenAlex.
- Crossref.

Permite buscar en una fuente o en todas, filtrar por fecha y ordenar por relevancia o recencia. Los tipos de publicación (revisión sistemática, metaanálisis, ensayo, revisión, reporte de caso y guía clínica) se aplican a PubMed, como en el buscador web. Los resultados incluyen metadatos, autores, revista, año, DOI/PMID, resúmenes cuando la fuente los proporciona y enlaces de texto completo de acceso abierto cuando están identificados.

`consultar_articulo_cientifico` permite recuperar una ficha y el resumen disponible mediante DOI o PMID. El servidor no descarga ni presenta como abierto un texto completo que no esté disponible en la fuente.

## Herramientas de comunidad

- Publicaciones y comentarios.
- Chat general.
- Grupos de estudio: consulta, creación y unión a grupos abiertos.
- Mensajes grupales.
- Conversaciones privadas y mensajería privada.
- Biblioteca: búsqueda de recursos y registro de enlaces HTTPS.
- Notificaciones: publicaciones y mensajes invocan `onesignal-push` con el JWT del usuario; el registro principal no falla si no hay destinatarios suscritos.

## Biblioteca: carga de archivos

El bucket `academic-library` tiene lectura pública para materiales publicados y escritura reservada a administradores.
- Tipos: PDF, DOCX, PPTX, XLSX, JPEG, PNG y WebP.
- Tamaño máximo: 15 MiB.
- `preparar_subida_archivo_biblioteca` crea un enlace firmado temporal (2 horas) y una página segura de carga.
- `confirmar_subida_archivo_biblioteca` comprueba existencia, tamaño y firma del archivo, muestra vista previa y publica la ficha solo con `confirmar=true`.
- Los archivos se almacenan en un bucket público; no se deben subir historiales clínicos, datos de pacientes ni documentos personales.

## Encuestas

- `analizar_resultados_encuesta` está disponible solo para administradores.
- Consulta la Edge Function existente `survey-submissions` y devuelve conteos y porcentajes agregados de la encuesta `reconocimientos-2026`.
- No devuelve nombres, identificadores ni respuestas individuales. Para las preguntas abiertas solo devuelve conteo de respuestas y longitud media.
- La publicación de encuestas nuevas todavía no es dinámica: el formulario y sus reglas actuales están definidos en archivos estáticos y en la función de envío. Para crear encuestas desde ChatGPT sin despliegues futuros se necesitaría una única actualización de arquitectura: catálogo/configuración de encuestas en base de datos, validación genérica en backend y formulario web que consuma esa configuración. Después de esa actualización, las encuestas futuras podrían crearse y publicarse mediante operaciones MCP sin volver a desplegar el frontend.

## Seguridad y auditoría

- La identidad se obtiene de Supabase Auth.
- Los permisos administrativos se verifican con `public.is_admin()`, no con metadatos editables por el usuario.
- Los mensajes, publicaciones, grupos y recursos utilizan el cliente Supabase asociado al usuario y las políticas RLS existentes.
- La bitácora `private.mcp_action_audit` registra actor, acción y destino; no almacena el texto de los mensajes.
- Las herramientas de escritura muestran vista previa y requieren aprobación explícita.
- Los resultados de encuestas que entrega el MCP son agregados y no contienen identidades.

## Versión

- Versión del servidor: `0.5.0`.
- Herramientas para administradores: 25.
- Herramientas para estudiantes: 20; no se listan herramientas administrativas.
- No se requieren cambios de esquema ni despliegues de Netlify para esta versión. Se despliega únicamente la Edge Function MCP.
