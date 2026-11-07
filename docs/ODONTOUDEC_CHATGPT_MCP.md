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
