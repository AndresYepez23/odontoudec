# Daily — videollamadas de OdontoUdeC

Preparado el 2026-11-07. Este cambio NO se publica automáticamente: el commit Git no está vinculado a main hasta que exista DAILY_API_KEY en Netlify. Esto permite un solo despliegue de producción.

## Diseño
- Chat comunitario: sala común para estudiantes autenticados.
- Chat privado: solo los dos participantes de private_conversations; no se muestra el botón hasta abrir una conversación.
- Grupos: solo los integrantes que consten en study_group_members.
- La mensajería de Supabase permanece intacta; no hay migraciones SQL.
- Botón Videollamada en encabezados y botón Video en panel flotante.
- Al pulsar desde el chat flotante, el iframe avisa por postMessage al contenedor; el modal ocupa la pantalla del contenedor, no el espacio del chat, y al salir restaura el chat.
- Daily Prebuilt integra micrófono/cámara/sala de espera; se desactiva el chat duplicado de Daily.
- Daily SDK se carga bajo demanda con una versión fijada.
- Salas privadas con tokens personales y temporales generados únicamente por netlify/functions/daily-call.js; jamás exponer DAILY_API_KEY al navegador.
- No se almacenan ni graban las llamadas desde OdontoUdeC. No compartir datos personales de pacientes durante sesiones.

## Activación sin desplegar todavía
1. Crear cuenta en https://dashboard.daily.co y obtener la Daily API key.
2. En Netlify (sitio odontoudec, dominio odontoudec.online) crear la variable de entorno secreta DAILY_API_KEY para producción, con alcance Functions. No almacenarla en GitHub ni en HTML.
3. Confirmar que Netlify mantiene SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY (ya configuradas).
4. Aplicar el commit integrado al main una sola vez; Netlify ejecutará entonces el único deploy de producción. Los cambios de variables de entorno en Functions necesitan desplegarse para aplicarse: por eso configurar la clave ANTES del commit principal.

## Pruebas de aceptación
- Comunitario (sesión iniciada): el botón abre modal; salir vuelve al chat sin perder la selección.
- Privados: el botón solo aparece dentro de un hilo; ambas cuentas pueden unirse; tercera recibe HTTP 403.
- Grupos: miembros pueden entrar; una cuenta ajena recibe 403.
- Desde el dock: el video se abre en el documento principal, no dentro del iframe; no tapa el campo de escritura.
- Móviles y PWA: modal a pantalla completa con botón Salir.
- Sin clave configurada: mensaje explicativo; no filtrar secretos al cliente.
- Sin sesión: HTTP 401.
- No romper adjuntos, reacciones, lectura de mensajes, pestañas, scroll ni burbuja flotante.

## Referencias
- https://docs.daily.co/guides/products/prebuilt/customizing-daily-prebuilt
- https://www.daily.co/products/prebuilt-video-call-app/quickstart/
- https://docs.netlify.com/build/functions/environment-variables/
