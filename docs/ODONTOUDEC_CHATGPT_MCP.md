# OdontoUdeC · Conector ChatGPT (MCP v0.1)

Servidor MCP desplegado en Supabase Edge Functions, **solo lectura pública**.

**Endpoint:** https://jqbrheonqqsiijrprsqs.supabase.co/functions/v1/odontoudec-mcp

**Salud:** https://jqbrheonqqsiijrprsqs.supabase.co/functions/v1/odontoudec-mcp/health

## Qué puede hacer

- `explorar_odontoudec`: devuelve los enlaces oficiales a módulos de la plataforma.
- `estado_publico_odontoudec`: consulta datos públicos actuales de OdontoTrivia (cantidad de preguntas activas y áreas).
- `comprobar_pagina_odontoudec`: verifica si una de las páginas públicas responde por HTTP.

## Conexión en ChatGPT

Si tu cuenta o espacio de trabajo ofrece servidores MCP personalizados: entra a ChatGPT **web** > **Plugins** > **+** > **Add custom MCP server**. Nombre **OdontoUdeC**, URL del endpoint anterior, opción **No authentication** para esta versión pública, acepta la advertencia de riesgos, crea e instala el plugin. Después elige `@OdontoUdeC` en ChatGPT (o en Work, según disponibilidad).

Si no aparece **Add custom MCP server**, puede ser una restricción de plan o espacio de trabajo. No es un problema del endpoint. La documentación actual de OpenAI sobre cuentas Business, Enterprise y Edu especifica los permisos de los servidores personalizados.

## Seguridad y evolución

- No expone nombres, correos, contraseñas, historiales de pacientes, mensajes privados ni métricas administrativas.
- No admite crear, editar o borrar datos.
- No incorpora claves service-role de Supabase.
- La consulta PostgreSQL para datos públicos se llama `public.odontoudec_mcp_public_summary()` y únicamente devuelve conteos y categorías de OdontoTrivia.
- **Siguiente fase:** habilitar un flujo OAuth 2.1 con Supabase Auth, verificar el rol administrativo del usuario en cada petición y crear herramientas de métricas privadas (perfiles, verificaciones, tráfico, correos), siempre sin exponer datos de pacientes.
- Mantener el código en una rama separada evita un despliegue adicional de Netlify hasta que se decida fusionar.

## Pruebas realizadas

- HTTP health devolvió 200.
- JSON-RPC MCP `initialize` devolvió versión de protocolo y metadata correctos.
- `tools/list` devolvió tres herramientas.
- `tools/call` para las tres herramientas respondió 200 con datos válidos.

**Referencias:** https://supabase.com/docs/guides/ai-tools/byo-mcp y https://developers.openai.com/plugins/quickstart

## v0.2 — Navegación y roles

**Plugin público:** https://jqbrheonqqsiijrprsqs.supabase.co/functions/v1/odontoudec-mcp
- Herramientas actuales: enlaces a módulos, estado de OdontoTrivia, comprobación HTTP, inspección de encabezados y enlaces de páginas públicas.
- No ejecuta JavaScript, no reproduce la sesión privada del navegador ni hace clic en los controles de la web.

**Plugin con cuentas:** https://jqbrheonqqsiijrprsqs.supabase.co/functions/v1/odontoudec-mcp-cuentas
- Requiere OAuth 2.1 con la cuenta existente de OdontoUdeC.
- mi_cuenta_odontoudec: perfil propio y rol real.
- navegar_odontoudec: enlaces a secciones permitidas; el panel admin exige rol admin.
- resumen_administrativo_odontoudec: estadísticas agregadas bajo control de user_roles e is_admin.
- trafico_administrativo_odontoudec: tráfico PostHog del panel actual, con autorización real.

### Configuración OAuth en Supabase — requiere acceso al Dashboard

1. Authentication > OAuth Server: habilitar OAuth 2.1, y Dynamic Client Registration con políticas de consentimiento adecuadas.
2. Authorization Path: /oauth/consent; en Authentication > URL Configuration, Site URL: https://odontoudec.online.
3. Publicar la página de consentimiento preparada en oauth/consent/index.html. Pide inicio de sesión, muestra el cliente y permisos solicitados y permite aceptar o rechazar.
4. Comprobar que la metadata en https://jqbrheonqqsiijrprsqs.supabase.co/.well-known/oauth-authorization-server/auth/v1 responde y anuncia code_challenge_methods_supported S256.
5. ChatGPT web > Plugins > + > Add custom MCP server. Crear OdontoUdeC Cuentas con la URL del endpoint autenticado, seleccionar OAuth y completar el consentimiento.
6. Verificar perfil y roles con estudiante y administrador. Las herramientas administrativas deben rechazar cuentas sin rol.

### Protección de datos

- El MCP público sigue funcionando de forma independiente.
- En el nuevo MCP, Supabase verifica JWT y aplica RLS. La consulta administrativa comprueba rol en SQL.
- No exponer service_role, contraseñas, datos clínicos, pacientes, chats ni reportes privados.
- No activar acciones de modificación o eliminación hasta tener confirmación explícita, autorizaciones por acción y registros de auditoría.
- ChatGPT no hereda una sesión del navegador. Para navegar y hacer clic visualmente sobre una web hace falta una herramienta de navegador; MCP da acceso mediante herramientas específicas.

### Estado verificado

- Metadata OAuth Protected Resource del endpoint nuevo: HTTP 200.
- Peticiones sin token al endpoint nuevo: HTTP 401.
- Función SQL administrativa: anon sin permiso, sin rol admin denegado.
- JWKS del proyecto tiene clave ES256.
- **OAuth 2.1 del proyecto sigue desactivado**: falta habilitarlo y verificar la autorización completa.
