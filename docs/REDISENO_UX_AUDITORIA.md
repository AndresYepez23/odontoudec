# OdontoUdeC — auditoría inicial y arquitectura UX
Fecha: 2026-11-05
Rama: redesign/ux-audit-2026-11-05
Base auditada: main

## Dirección aprobada
- Personalidad: combinación institucional, moderna y comunitaria.
- Inicio: panel organizado (dashboard), no portada editorial.
- Preservar identidad existente: morado, dorado, escudo y lema «Empatía · Liderazgo · Sabiduría».
- Principio: evolución incremental; no reconstruir ni sustituir funcionalidades sin validar equivalencias.

## Inventario funcional observado
- index.html: inicio, autenticación, anuncios, recursos, biblioteca por semestres, tarifario, calendario, comunidad/publicaciones, memoria estudiantil, convivencia y onboarding.
- academia.html + academia-enhancements.js: pensum, OdontoBot, atlas dental, OdontoTrivia e historial/ranking.
- mi-espacio.html: apuntes, colecciones y recursos guardados.
- perfil-academico.html: perfil, privacidad, avance curricular y asignaturas.
- grupos-estudio.html: crear/explorar grupos y conversación.
- mensajes.html: búsqueda de estudiantes, bandeja y mensajes privados.
- chat.html: chat de comunidad.
- banco-pacientes.html + assets/patient-bank.js: recepción de casos, listado, gestión y consulta privada de contacto.
- estudiante.html: perfil público de estudiante.
- verificacion.html y restablecer-contrasena.html: flujos de autenticación.

## Hallazgos de UX y arquitectura
1. index.html tiene ~770 KB y concentra HTML, CSS extenso y ~40 KB de JavaScript inline. Hay estilos de distintas etapas acumulados y múltiples breakpoints. No dividir ni minificar masivamente antes de mapear dependencias.
2. La navegación varía entre páginas: inicio ofrece muchos enlaces y un desplegable «Más»; Academia y otras páginas usan subconjuntos distintos; Perfil y Banco de pacientes tienen encabezados de retorno más aislados. Se necesita un sistema compartido y coherente.
3. La navegación principal presenta destinos de distinto nivel mezclados (secciones de inicio, herramientas académicas, comunidad y cuenta). La jerarquía propuesta agrupa destinos por tareas.
4. En inicio hay cinco accesos rápidos en una cuadrícula configurada inicialmente para cuatro columnas; revisar orden, agrupación y adaptación móvil.
5. La sección «Oración» está en el menú y en el contenido principal, con un iframe de YouTube. El usuario pidió retirarla; eliminar también su enlace y reglas CSS asociadas cuando se implemente.
6. El onboarding de bienvenida es un diálogo modal con pasos sobre Academia, Calendario y Comunidad. Revisar frecuencia, cierre, accesibilidad de foco y pertinencia tras el rediseño.
7. El sistema de autenticación está integrado en la página principal. Ya contempla errores de rate limit para recuperación, pero el mensaje de registro/confirmación debe revisarse para contemplar límite de correo y asistencia administrativa.
8. assets/community-dock.js está incluido en varias páginas; tratarlo como funcionalidad transversal y verificar estado, contador de no leídos, posición y comportamiento móvil antes de modificar.
9. El Banco de pacientes tiene lógica y estilos propios. No mezclar su lógica de negocio con el rediseño de navegación.
10. La página principal contiene módulos informativos y operativos. El panel inicial debe priorizar contenido vivo (encuestas/anuncios) sin ocultar accesos de uso frecuente.

## Arquitectura de información propuesta (pendiente de validación visual)
### Navegación primaria
- Inicio
- Académico
- Comunidad
- Oportunidades
- Mi espacio
- Cuenta / Mi perfil (acción persistente, dependiente de sesión)

### Inicio — dashboard
1. Aviso prioritario/encuesta activa (configurable; visible a visitantes y estudiantes).
2. Resumen de novedades y avisos oficiales.
3. Accesos frecuentes: calendario, biblioteca, Academia, historias clínicas/Drive y tarifario.
4. Actividad de comunidad y grupos.
5. Oportunidades clínicas: Banco de pacientes.
6. Información institucional y convivencia, en un nivel secundario.

### Académico
- Calendario académico
- Biblioteca por semestres
- Centro de recursos
- Tarifario
- Academia (pensum, OdontoBot, atlas, trivia)
- Mi avance curricular y perfil académico

### Comunidad
- Novedades y anuncios
- Publicaciones estudiantiles
- Grupos de estudio
- Chat general
- Mensajes privados
- Convivencia y memoria estudiantil

### Oportunidades
- Banco de pacientes
- Futuras convocatorias u oportunidades, solo cuando existan y estén administradas.

### Mi espacio
- Apuntes
- Colecciones
- Recursos guardados
- Perfil y configuración como acciones de cuenta, no mezcladas con recursos.

## Principios de experiencia
- El visitante puede ver la convocatoria y los detalles de la encuesta estudiantil, pero debe iniciar sesión para responder.
- Si no tiene cuenta, ofrecer registro de forma explícita desde la misma invitación; después de confirmar el correo e iniciar sesión, devolverlo a la encuesta pendiente.
- Si ya tiene cuenta, ofrecer inicio de sesión y conservar igualmente el destino de retorno.
- No solicitar registro para navegar el resto del contenido público.
- En móvil: navegación corta, objetivos prioritarios visibles y acciones táctiles claras.
- Mantener estados vacíos, carga, éxito y error con lenguaje claro.
- No mostrar nombres/correos/teléfonos privados en áreas públicas.
- No usar color o tarjetas decorativas sin jerarquía funcional.

## Riesgos y pruebas de regresión
- Auth: registro, confirmación, login, recuperación, reenvío y rate limit; preservar redirects y manejo de OTP expirado.
- Perfil: completar datos, visibilidad, cambio de contraseña, avance curricular.
- Calendario: navegación mensual, filtros, eventos y recordatorios.
- Biblioteca/recursos: búsqueda, filtros, lectura/guardado.
- Academia: pensum, OdontoBot, atlas, trivia, historial y ranking.
- Comunidad: crear publicación, comentarios/acciones, chat, mensajes, grupos y contador de no leídos.
- Banco de pacientes: envío, lista, reclamar/liberar/finalizar y privacidad del contacto.
- Responsive: móvil pequeño, móvil grande, tablet y escritorio.
- Accesibilidad: foco visible, labels, estados ARIA, contraste, navegación por teclado y modal.

## Plan de ejecución
1. Completar inventario de dependencias y navegación compartida.
2. Acordar mapa de navegación y wireframe del dashboard.
3. Diseñar tokens/componentes compartidos sin cambiar lógica.
4. Implementar por etapas en esta rama.
5. Ejecutar revisión estática y pruebas manuales de regresión.
6. Comparar rama con main y revisar preview antes de cualquier publicación.
7. Un único despliegue de producción aprobado explícitamente.

## Restricciones operativas
- No modificar main durante el rediseño.
- No publicar deploy de producción desde esta rama.
- No alterar esquema, RLS, funciones SQL ni credenciales de Supabase como parte del rediseño visual.
- No retirar funcionalidades sin decisión explícita y alternativa definida.


## Hallazgos de segunda pasada — autenticación y páginas internas

### Encuesta estudiantil: requisito confirmado por el usuario
- Responder la encuesta requiere una sesión autenticada. No debe existir envío anónimo.
- La convocatoria debe poder verse desde el dashboard incluso antes de iniciar sesión: título, propósito, plazo/estado y CTA claro.
- Visitante sin cuenta: CTA principal «Regístrate para responder» y alternativa «Ya tengo cuenta · Iniciar sesión».
- Visitante con cuenta: al intentar responder, dirigir al acceso y luego regresar a la encuesta.
- Usuario autenticado: CTA «Responder encuesta» abre el formulario.
- El retorno debe sobrevivir tanto al login como al flujo de registro + confirmación de correo. La página actual `verificacion.html` termina en el inicio; habrá que admitir un destino interno de retorno validado y no una URL externa arbitraria.
- Evitar formularios duplicados: la encuesta debe tener un único punto de entrada y comprobar sesión también en el lado servidor/RLS o en el mecanismo de persistencia, no solo ocultar el botón.
- En la inspección de `index.html` no se encontró todavía una implementación funcional de encuesta; por ahora se trata como módulo nuevo del dashboard, pendiente de identificar dónde se administrarán preguntas, vigencia y respuestas. No inventar una tabla ni alterar Supabase dentro de la etapa visual.

### Flujo de autenticación actual observado
- El registro solicita nombre, correo y contraseña, y usa `signUp` con redirección a `verificacion.html`.
- Cuando Supabase no crea sesión inmediata, la interfaz indica revisar el correo y cambia al modo de inicio de sesión.
- `verificacion.html` verifica sesión y confirmación, pero su CTA conduce al inicio; no conserva contexto de una tarea pendiente.
- `restablecer-contrasena.html` ya maneja sesión de recuperación, OTP expirado y reenvío; sus mensajes y límites de correo deben mantenerse y probarse.
- El formulario de registro conserva texto heredado que pide «nombre o alias»; alinear el lenguaje con el criterio vigente de nombre real/visible definido para el perfil, sin crear un campo de apodo.
- No exponer errores internos crudos de Supabase al usuario cuando se traduzcan a mensajes comprensibles; mantener detalle técnico solo en consola/logs seguros.

### Banco de pacientes y acceso
- La pestaña de estudiantes ya muestra una puerta de acceso cuando no hay sesión; la carga de casos se activa al iniciar sesión.
- La recepción de solicitudes de pacientes permanece separada de la zona privada de gestión estudiantil.
- `assets/patient-bank.js` usa RPC para listar, reclamar, liberar y finalizar casos; el contacto privado se consulta solo para el caso gestionado por la cuenta actual. No modificar esa lógica al unificar encabezados.

### Comunidad y navegación transversal
- `assets/community-dock.js` crea un chat flotante compartido con pestañas Comunidad/Privados/Grupos y un contador de mensajes privados no leídos.
- Para visitantes, el dock sustituye el iframe por una invitación a iniciar sesión o registrarse. Mantener esa puerta de acceso.
- El contador consulta conversaciones y mensajes periódicamente; conservar la lógica y probar que no se duplique el dock al navegar/embeber páginas.
- Academia tiene cabecera con varios enlaces; Mi espacio tiene navegación de seis destinos y Perfil/Banco de pacientes tienen cabeceras reducidas. La unificación debe hacerse como componente/fragmento compartido o patrón equivalente, sin romper rutas relativas ni anchors.

### Decisiones de implementación pendientes
1. Definir si la encuesta tendrá una página propia (recomendado: `encuesta-estudiantil.html`) o un formulario expandible dentro del inicio. La página propia facilita conservar el destino de retorno y evita saturar el dashboard.
2. Definir el origen de preguntas, fechas de apertura/cierre y respuestas (administración actual o futura). Requiere revisión separada de Supabase antes de diseñar persistencia.
3. Validar el flujo exacto de confirmación de correo y el retorno a encuesta en preview, antes de producción.
