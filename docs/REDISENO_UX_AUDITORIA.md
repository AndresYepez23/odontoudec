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
- El visitante debe entender qué ofrece la plataforma y llegar a encuestas públicas sin registrarse si la encuesta no exige identidad.
- Si una encuesta requiere identidad, mostrar claramente iniciar sesión/crear cuenta y conservar el retorno a la encuesta.
- No solicitar registro para navegar contenido público.
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
