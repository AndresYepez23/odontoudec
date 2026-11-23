# Auditoría de seguridad — OdontoUDEC

Fecha: 2026-11-23 UTC. Base: `5eab7073889649ee3a34194f1bdb48a8c43c61ee`.
Se revisaron rutas administrativas, proveedores, pacientes, mensajes, Storage,
roles/RLS, archivos publicados y credenciales. Se reutilizaron los criterios de la
auditoría Prisma; sus vulnerabilidades no se dieron por presentes sin comprobarlas.
Sin Codespaces, cambios de producción, registros de usuarios, consultas de pacientes,
mensajes reales, inferencias, envíos de notificaciones ni ataques de carga.

## Hallazgos

| Estado | Riesgo | Evidencia y alcance de la explotación |
| --- | --- | --- |
| Confirmado | Alto, condicionado a acceso SQL/RPC | `anon` y `authenticated` tienen TRUNCATE/TRIGGER/REFERENCES en 24 tablas públicas, incluidas perfiles, mensajes y roles. RLS no limita TRUNCATE. No se ejecutó TRUNCATE remoto ni se demostró una vía SQL arbitraria por REST. Migración preparada, no aplicada. |
| Confirmado | Alto | OdontoBot valida la sesión pero consume Groq sin presupuesto persistente propio. El código activo de la Edge Function v6 coincide con el repositorio. La zona Cloudflare no tiene reglas de rate limiting y las llamadas directas al dominio Supabase no dependen del WAF de `odontoudec.online`. Abuso reproducido mediante proveedores simulados; no se gastó cuota real. |
| Confirmado | Medio | Worker administrativo e intake/bot/encuestas almacenan cuerpos completos antes de validar límites. Se añaden límites por bytes y rechazo de JSON nulo/arrays; prueba local de cancelación de streams sobredimensionados. |
| Confirmado | Medio | Worker estático activo sin CSP ni protección de framing propias. Se prepara CSP parcial `base-uri 'self'; frame-ancestors 'self'` y SAMEORIGIN, también para respuestas previamente cacheadas. No es una CSP integral contra XSS. |
| Confirmado | Medio | Protección Supabase contra contraseñas filtradas desactivada. La organización compartida está en Free; requiere Pro o superior. No se cambió Auth ni el plan. |
| Confirmado | Operativo | Producción usa el Worker **odontoudec-staging**, versión `5519f354-72f8-4b0d-b43f-93c536419c6c` del 16 de noviembre. El Worker `odontoudec` no sirve el dominio principal. El código adaptador activo no estaba versionado en el repo; corregir sólo `netlify/functions` no actualiza Cloudflare. |
| Potencial | Alto | Reclamar pacientes exige una cuenta con perfil, pero la función no comprueba matrícula o autorización institucional independiente. El signup visible acepta email genérico y crea perfil. Verificar con el propietario quién puede acceder antes de añadir una restricción que bloquearía usuarios legítimos. No se crearon cuentas ni se accedió a contactos reales. |
| Potencial | Medio/alto | Intake público limita a tres envíos/hora por hash, pero prioriza `x-nf-client-connection-ip` en una Edge Function de Supabase. No se probó que la infraestructura elimine cabeceras suministradas por el cliente; verificar el origen fiable de IP y añadir CAPTCHA antes de considerar robusto ese límite. |
| Descartado en alcance probado | — | Tablas de pacientes/contactos y encuestas no tienen acceso directo para clientes. La ausencia de políticas con RLS activado es una denegación deliberada, no una invitación a abrirlas. `patient_bank_my_contact` comprueba responsable o administrador. Mensajes requieren participación. `is_admin` consulta `user_roles`, no metadata editable del usuario. |
| Descartado para el corpus probado | — | El chat usa nodos de texto y valida identificadores/rutas de GIF e imágenes. Pasaron pruebas XSS locales en Chromium; se conserva el renderizador. |

Los avisos del asesor sobre funciones SECURITY DEFINER no son por sí solos bypass:
`is_admin`, búsqueda de perfiles y contacto de pacientes contienen controles de identidad;
el resumen MCP anónimo devuelve sólo estadísticas/categorías de trivia. No se revocan
indiscriminadamente estos RPC necesarios. No equivale a una prueba exhaustiva de cada RPC.

## Correcciones y pruebas

- Migración `20261123163935_security_privileges_and_bot_quotas.sql`: revoca únicamente
  TRUNCATE/TRIGGER/REFERENCES en las 24 tablas, preservando DML y políticas. Aborta si
  permisos heredados o cambios de esquema dejan privilegios excesivos.
- Cuota PostgreSQL atómica para OdontoBot: 6/minuto/usuario, 40/día/usuario y 200/día global.
  RPC ejecutable sólo por service_role; el backend toma el usuario de `auth.getUser`,
  nunca del JSON. Los intentos fallidos consumen cuota; sin migración/cuota válida,
  responde 503 antes de Groq; cuota agotada devuelve 429 con Retry-After. Estas cifras
  son presupuestos iniciales de solicitudes, no una garantía de gasto monetario.
- Cuerpos máximos: bot 60.000 bytes, intake 12.000, encuesta y administración 32.000.
  Tiempo máximo de petición Groq: 30 segundos. Se eliminan logs de objetos de error
  completos en bot/encuestas; los errores de cliente siguen siendo genéricos.
- `cloudflare/worker.mjs` recupera el adaptador activo y añade lectura acotada y cabeceras.
  `scripts/build-cloudflare.mjs` genera un artefacto desde los handlers compartidos;
  **no despliega ni sube archivos**. Se alinea el mapeo GIPHY privado/grupos con `_2`/`_3`,
  que ya usa producción; no se añade una clave nueva ni se copia un secreto.
- 9 pruebas de handlers aprobadas: autenticación/admin, no consumir proveedores ante
  denegación, identidad verificada, cuota fallida, éxito legítimo, tamaños y cabeceras.
  Supabase/Groq están simulados en estas pruebas.
- 369 aserciones PostgreSQL local aprobadas: privilegios antes/después, migración
  idempotente, políticas intactas, notas por propietario, aislamiento de mensajes y
  contacto de paciente, rechazo de autoasignación de admin y cuota por usuario/global.
  Datos sintéticos; esquema mínimo más migraciones relevantes, no clon de datos reales.
- Chromium: texto/GIF malicioso no ejecuta HTML; rutas inválidas rechazadas.
- Build de adaptadores aprobado; dependencias de pruebas fijadas y lockfile incluido.
  GitHub Actions separa seguridad del contrato de encuesta para no ocultar un fallo previo.

## Bloqueo preexistente de la encuesta

`node scripts/validate-survey-contract.mjs` falla por opciones distintas en `ortodoncista`.
Se reprodujo también sobre los archivos originales del commit base `5eab707`, antes de
las correcciones de seguridad. El catálogo frontend/backend requiere reconciliación con
la fuente oficial. No se cambiaron nombres ni opciones en esta auditoría; no fusionar
mientras este check falle. Los mensajes del validador se refieren a un catálogo público,
no a respuestas de encuestados consultadas en producción.

## Infraestructura, datos y credenciales

- Los dominios principal, www y `cf-test` apuntan al mismo Worker productivo: `cf-test`
  **no es un entorno aislado**. Ambos Workers mantienen acceso workers.dev habilitado;
  el Worker antiguo también tiene previews. Restringirlos requiere validación/autorización.
- Se inspeccionaron sólo nombres/tipos de bindings: Supabase service-role y PostHog
  personal están en secretos del servidor. No se leyeron ni publicaron sus valores.
- GIPHY entrega por diseño una clave de cliente tras validar sesión; no debe confundirse
  con service-role/PostHog personal. Revisar restricciones de dominio/cuota del proveedor;
  no se declara secreto un valor que el contrato de GIPHY exige usar en el cliente.
- Inventario de las 85 claves KV publicadas: sin rutas `.env`, `.git`, `netlify`,
  `supabase`, SQL, PEM o claves por nombre. El listado no demuestra el contenido de cada
  archivo. No se exportaron valores KV ni datos de usuarios.
- 757 blobs de texto del historial Git accesible revisados por patrones de claves
  privadas, tokens GitHub/proveedores, JWT service-role, PostHog personal y OneSignal REST;
  sin coincidencias. No es una revisión exhaustiva de PII o logs productivos.
- Storage: `chat-media` privado, 1.536.000 bytes, JPEG/WebP y políticas por participantes;
  `academic-library` público, 15 MiB y tipos de documentos/imágenes restringidos, escritura
  administrativa. La biblioteca no debe contener pacientes ni documentos privados. Las
  URLs firmadas de chat duran una hora; su posesión permite acceso durante esa vigencia.
- Dos peticiones de lectura a raíz y API admin sin sesión recibieron 403 del borde.
  No se atribuye ese rechazo al handler ni se afirma explotación remota comprobada.

## Acciones pendientes de autorización

1. Revisar/aplicar la migración en Supabase y validar permisos efectivos; después probar
   y desplegar las Edge Functions. **Desplegar el bot antes de la migración lo dejaría
   respondiendo 503**. No aplicar el conjunto histórico de migraciones a ciegas.
2. Validar el artefacto Cloudflare con bindings aislados y pruebas de login/admin/GIPHY,
   después autorizar su publicación. Mantener nombres/secretos actuales. Ni el PR ni el
   build modifican el Worker activo, el KV o los destinos antiguos automáticamente.
3. Decidir elegibilidad estudiantil para el banco de pacientes, protección del intake,
   CAPTCHA y verificación de IP. No confiar en CORS como autenticación o anti-bot.
4. Revisar configuración real de Auth para registro, login, recuperación y contraseñas.
   La UI acepta seis caracteres; elevar sólo la UI no impone una política del servidor.
   Integrar `captchaToken` antes de habilitar CAPTCHA para no bloquear formularios.
   Si se autoriza Pro, activar protección de contraseñas filtradas en Auth → Email.
   Ver [remediación oficial](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection),
   [CAPTCHA](https://supabase.com/docs/guides/auth/auth-captcha) y
   [límites Auth](https://supabase.com/docs/guides/auth/rate-limits).
5. Reconciliar el catálogo de encuesta y obtener checks verdes antes de fusionar.
6. Revisar cuotas de notificaciones/MCP y dependencias CDN sin versión exacta. OneSignal
   activo valida autor/participación y usa clave de idempotencia, pero su fuente no está
   en este repo. Mantenerlo versionado en un cambio posterior. La CSP parcial no aísla
   tokens persistidos del navegador de un script tercero comprometido.

No se identificó una credencial real cuya rotación esté justificada por una filtración
comprobada aquí. Si una revisión posterior de logs/despliegues la confirma, rotarla sin
publicar su valor. La auditoría reduce riesgos dentro de este alcance; no certifica
invulnerabilidad ni reemplaza la validación del despliegue.
