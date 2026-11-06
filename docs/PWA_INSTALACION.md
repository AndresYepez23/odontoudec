# OdontoUdeC · PWA

## Configuración
- Manifest: `/manifest.webmanifest`
- Modo de apertura: `standalone` para ocultar la interfaz del navegador al abrir desde el icono instalado.
- Icono vectorial autocontenido: `/assets/pwa-icon.svg`.
- Icono raster de respaldo y Apple Touch Icon: `/assets/download-removebg-preview (2).png`.
- Metadatos PWA/iOS aplicados a todas las páginas HTML.
- Botón de instalación contextual en la página principal: Android usa `beforeinstallprompt`; iPhone/iPad muestra las instrucciones de «Añadir a pantalla de inicio».

## Service Worker y OneSignal
OdontoUdeC ya utiliza `/OneSignalSDKWorker.js` en el ámbito raíz para las notificaciones push. No se registra un segundo service worker raíz, porque reemplazaría el worker que necesita OneSignal. La instalación PWA se configura mediante el manifiesto y los metadatos. La caché offline deberá añadirse posteriormente al worker existente, con estrategias que no almacenen datos privados ni respuestas autenticadas de Supabase.

## Comportamiento esperado
- Al abrir `odontoudec.online` como pestaña normal, se siguen mostrando los controles del navegador.
- Al instalar y abrir desde el icono, Android y iOS usan una ventana independiente en modo standalone, sin barra de URL ni barra inferior de Safari.
- En iOS permanece la barra de estado del sistema; no se fuerza el modo fullscreen para conservar reloj, batería y estado de conexión.

## Instalación de prueba
- Android: abrir con Chrome y usar el botón «Instalar aplicación» o el menú ⋮ → «Instalar aplicación».
- iPhone/iPad: abrir la web y usar Compartir → «Añadir a pantalla de inicio» → «Añadir». Abrir desde el icono recién creado.
- Probar inicio de sesión, navegación, chat, enlaces externos, OneSignal y diseño con las barras del navegador ausentes.
