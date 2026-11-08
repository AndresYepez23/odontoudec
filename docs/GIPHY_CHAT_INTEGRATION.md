# Integración GIPHY y experiencia posterior a encuesta en OdontoUdeC

## GIPHY en los tres chats
La integración utiliza la API REST de GIPHY y el compositor compartido de OdontoChatUI.

- Comunidad, mensajes privados y grupos tienen un botón GIF compacto junto a los adjuntos.
- El selector flotante se monta en body para evitar recortes en paneles estrechos y en la burbuja de chat.
- Tendencias al abrir y búsqueda manual en español; búsqueda solo al pulsar Buscar/Enter.
- Contenido rating=pg, 12 resultados por consulta.
- MP4/WEBP para miniaturas cuando GIPHY los entrega; no se cachean respuestas ni URLs de medios.
- Los mensajes guardan el ID, título, autor/fuente y leyenda; la reproducción usa el embed oficial de GIPHY.
- Incluye Powered by GIPHY, atribución del creador/fuente cuando está disponible y analítica onload/onclick/onsent.
- No requiere migración SQL. Se conservan fotos, reacciones, permisos, navegación y burbuja flotante.

## Claves requeridas por GIPHY
GIPHY exige una API key distinta por sección y plataforma. OdontoUdeC usa tres secciones web:

| Sección | Variable Netlify |
|---|---|
| Comunidad | `GIPHY_API_KEY` (ya creada) |
| Mensajes privados | `GIPHY_API_KEY_PRIVATE` |
| Grupos | `GIPHY_API_KEY_GROUPS` |

Las tres claves deben ser del tipo API y plataforma Web. Las claves beta tienen un límite de 100 solicitudes por hora por clave. La variable de cada clave debe estar disponible para Functions en Production. No guardar claves en GitHub.

El endpoint `/.netlify/functions/giphy-config?scope=...` valida la sesión Supabase y devuelve únicamente la clave correspondiente a la sección solicitada. GIPHY requiere que las llamadas Search/Trending y las cargas multimedia se realicen directamente desde el cliente; por eso la API key se verá en las solicitudes del navegador de usuarios autenticados.

## Experiencia después de la encuesta
Después de enviar la encuesta (o al volver a entrar si ya estaba completada), el formulario se oculta y aparece la tarjeta “Tu experiencia en OdontoUdeC no termina aquí”, con accesos a Academia, Mi espacio, Grupos de estudio y Banco de pacientes. No hay redirección automática ni ventana invasiva. El cambio se integra directamente sobre la versión actual de `main`, sin fusionar el PR #24 completo porque está muy desactualizado.

## Pruebas de aceptación
- GIPHY: clave independiente resuelta para cada sección; sesión no autenticada devuelve 401; clave faltante devuelve 503 explicativo.
- Los tres chats conservan el diseño compacto en móvil y escritorio.
- Seleccionar, retirar y enviar GIF con/sin leyenda funciona.
- Los GIF se renderizan con embed oficial y atribución.
- Fotos, reacciones, scroll, envío de texto, permisos y navegación siguen funcionando.
- Encuesta: el formulario queda bloqueado tras participar; aparece la tarjeta con los cuatro accesos; no se redirige automáticamente; la tarjeta también aparece si el estudiante vuelve a entrar después de haber participado.
