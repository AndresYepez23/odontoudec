# Laboratorio IA y Driver.js

Implementación 2026-11-08. 

- Laboratorio IA en `laboratorio-ia.html`, accesible desde el inicio y Academia. Ocho categorías de acción con un Space predeterminado: textos/resúmenes, generar imágenes, eliminar fondo, transcribir, OCR, traducir, texto a voz y aumentar resolución. No se obliga a conocer los nombres de modelos.
- Demos de terceros gratuitas en modalidad pública al momento de la consulta, con posibles colas, login, cuotas y cierres. No se garantiza gratuidad ilimitada. Cada herramienta se carga únicamente a petición explícita; si falla, enlace a la página del Space.
- Aviso visible: no enviar historias clínicas, datos de pacientes o contenido sensible a terceros.
- Driver.js v1.10.2, con carga bajo demanda y estilos morado/dorado. La guía usa los elementos reales de Inicio y sustituye el modal antiguo. Conserva el campo `profiles.onboarding_completed`; solo aparece automáticamente para cuentas no completadas, con disparador manual permanente en Más.
- Sin SQL, API keys nuevas ni cambios de chat o PWA. Verificar la UX desde iPhone y Android, disponibilidad de Spaces y que la cuenta completada no vuelva a ver el recorrido automáticamente.
