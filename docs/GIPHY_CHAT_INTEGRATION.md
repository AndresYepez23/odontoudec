# Integración GIPHY en los chats de OdontoUdeC

## Alcance
La integración se monta desde el compositor compartido de OdontoChatUI, por lo que funciona en Comunidad, Mensajes privados y Grupos sin alterar la navegación ni el centro de chat flotante.

- Botón GIF compacto (36–40 px) junto al botón de adjuntos.
- Selector flotante posicionado sobre el compositor y montado en body para evitar recortes por overflow.
- Tendencias al abrir y búsqueda manual en español; se consulta solo al pulsar Buscar/Enter.
- Filtro de contenido GIPHY rating=pg.
- 12 resultados por consulta. Límite preventivo de 75 solicitudes por hora por instancia del compositor; el límite beta de GIPHY es compartido por toda la API key y por todos los estudiantes.
- Usa MP4/WEBP en las miniaturas cuando la API los proporciona; el navegador solicita esos recursos directamente a GIPHY.
- No se cachean respuestas ni URLs de medios. Al cerrar el selector se descartan los resultados.
- Al enviar, el mensaje guarda solo el ID del GIF, título, autor/fuente y leyenda; no guarda URLs de medios ni copias del archivo.
- Los mensajes se muestran con el embed oficial de GIPHY (https://giphy.com/embed/{id}), con atribución del creador/fuente cuando está disponible y Powered by GIPHY.
- Se registran eventos onload/onclick/onsent de GIPHY cuando el payload los proporciona.
- No hay migración SQL ni cambios en la estructura de mensajes. Fotos, reacciones y handlers de envío se conservan.

## Activación requerida antes del despliegue
1. Crear una cuenta en https://developers.giphy.com/dashboard/ y generar una API key beta para plataforma Web y sección Chats.
2. Todas las claves beta están limitadas a 100 búsquedas/llamadas por hora. Ese límite se comparte entre todos los estudiantes que utilicen esta clave en Comunidad, Privados y Grupos.
3. Si se supera la cuota, GIPHY puede devolver 429 hasta que se libere el límite. Una clave Production requiere solicitud de upgrade; GIPHY revisa el proyecto y comunica precios personalizados. No solicitar upgrade sin revisar el costo.
4. En Netlify > Site configuration > Environment variables, agregar GIPHY_API_KEY como variable secreta con scope Functions y contexto Production. No pegar la clave en GitHub ni en el código.
5. La función /.netlify/functions/giphy-config valida la sesión de Supabase y entrega la clave a usuarios autenticados. GIPHY exige que las solicitudes Search/Trending y las cargas de medios se hagan directamente desde el cliente; por ello la clave será visible en las solicitudes de red de un usuario autenticado. Es una clave de API de aplicación, no una credencial privada de servidor.
6. La interfaz muestra Powered by GIPHY y la atribución del creador/fuente cuando está disponible. Antes de solicitar una clave Production, revisar el paquete oficial de attribution marks y asegurar que el logo aprobado esté visible también en el selector.
7. Una vez configurada la variable y revisada la atribución, integrar los cambios a main y hacer un solo despliegue de producción. No desplegar antes: sin GIPHY_API_KEY el selector mostrará que falta configuración.

## Pruebas de aceptación
- Comunidad, privado y grupos: botón GIF aparece en el compositor habilitado.
- El botón no desplaza ni oculta el campo de texto ni el botón Enviar en móvil.
- El selector se abre encima del compositor, no se recorta en el panel flotante, y cierra con Escape, botón cerrar o clic exterior.
- Buscar solo al pulsar Buscar/Enter; no enviar peticiones por cada tecla.
- Seleccionar un GIF muestra una vista previa; quitarlo restaura el estado normal.
- Enviar GIF funciona sin texto y con una leyenda breve.
- El mensaje se muestra animado mediante el embed oficial de GIPHY, con atribución de creador/fuente cuando exista.
- Fotos, reacciones, scroll, envío de texto, permisos y navegación siguen funcionando.
- Sesión no autenticada: la función de configuración responde 401.
- Sin clave configurada: respuesta 503 explicativa, sin filtrar errores internos.
