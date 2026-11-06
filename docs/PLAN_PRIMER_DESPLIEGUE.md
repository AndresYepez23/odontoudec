# Plan de publicación y validación — OdontoUdeC

Estado: preparación; no ejecutar hasta que el propietario confirme la ventana de publicación.
Rama: `redesign/ux-audit-2026-11-05`
Objetivo: resolver el mayor número de verificaciones antes de publicar y evitar un segundo deploy de Netlify.

## Estrategia de un solo deploy de sitio

El primer deploy debe contener el paquete final completo: portada revisada, formulario listo y correcciones encontradas durante QA. No publicar una versión incompleta para después volver a desplegar lo que ya se sabía que faltaba.

La migración SQL y el despliegue de la Edge Function son operaciones de backend de Supabase; no son deploys de Netlify. Deben ejecutarse antes de publicar la interfaz que habilita el envío.

### Secuencia propuesta

1. Congelar cambios funcionales y revisar el diff completo contra `main`.
2. Verificar variables/secretos de Edge Functions en Supabase sin imprimir ni guardar sus valores.
3. Aplicar la migración en el proyecto Supabase correcto y comprobar tabla, RLS, grants, índice y restricción única.
4. Desplegar `survey-submissions` y comprobar logs de arranque y CORS.
5. Preparar el HTML final con el envío habilitado solo cuando los pasos 3 y 4 estén confirmados.
6. Hacer un único deploy de producción de Netlify desde la rama aprobada.
7. Ejecutar inmediatamente las pruebas reales descritas abajo.
8. Solo si aparece un defecto que requiera cambio de código, corregir y hacer el segundo deploy. Si todo pasa, no gastar el segundo deploy.

## Pruebas reales inmediatamente después del primer deploy

Usar cuentas de prueba controladas y eliminar sus envíos de prueba antes de anunciar la encuesta, conservando la auditoría de que se ejecutaron las pruebas. No usar respuestas inventadas atribuidas a estudiantes reales.

| Caso | Resultado esperado |
|---|---|
| Visitante sin sesión intenta enviar | Bloqueado; no se crea fila |
| Cuenta con perfil inicia sesión | Puede completar y enviar |
| Envío correcto | HTTP 201 y una fila atribuida al UID autenticado |
| Misma cuenta envía de nuevo | HTTP 409; permanece una sola fila |
| Payload incompleto o con candidato manipulado | HTTP 400; no se crea fila |
| Texto libre menor de 2 o mayor de 500 caracteres | HTTP 400 |
| Estudiante solicita resultados administrativos | HTTP 403; no recibe respuestas |
| Administrador solicita resultados | HTTP 200; ve atribución y respuestas |
| Navegador consulta directamente la tabla | Sin permisos para leer/escribir |
| Origen de producción y preview autorizado | CORS correcto |
| Origen externo no autorizado | No recibe autorización CORS |

## Criterios de no publicación

No hacer el primer deploy si:
- La migración no aparece aplicada en el proyecto correcto.
- La función no responde correctamente a autenticación, envío y autorización administrativa.
- La clave secreta del servidor no está configurada.
- El botón de envío está habilitado antes de que backend y permisos estén listos.
- La URL de producción, el proyecto Supabase o la cuenta Netlify no coinciden con los confirmados.

## Control de cambios

- No tocar `main` durante la preparación.
- No desplegar a producción ni ejecutar SQL sin confirmación explícita de la ventana de publicación.
- Registrar aquí el SHA del commit publicado, ID del deploy Netlify, resultado de cada prueba y cualquier segundo deploy.
- Mantener SMTP como tarea aparte: antes de pruebas de registro/recuperación con tráfico real, configurar proveedor SMTP y verificar SPF/DKIM/DMARC.

## Verificación automática antes del deploy

Desde la raíz del repositorio, ejecutar:

```bash
node scripts/validate-survey-contract.mjs
```

El validador comprueba que el frontend y la Edge Function mantengan los mismos 15 campos, las ocho listas de candidatos y los siete campos abiertos, además de detectar la ausencia de validación JWT, control administrativo o manejo de duplicados. Debe ejecutarse después de cualquier cambio al formulario o al catálogo del servidor.


## Estado comprobado antes de la ventana de publicación — 2026-11-05
- Netlify site: `odontoudec`; dominio primario: `https://odontoudec.online`.
- Último deploy de producción revisado: rama `main`, estado `ready`. La rama de preparación aún no está publicada.
- Variables Netlify comprobadas por nombre y contexto, sin exponer valores: `SUPABASE_URL` y `SUPABASE_ANON_KEY` en contexto all; `SUPABASE_SERVICE_ROLE_KEY` secreta en production, deploy-preview, branch-deploy y dev-server.
- Supabase correcto: `jqbrheonqqsiijrprsqs`, estado ACTIVE_HEALTHY.
- Migraciones remotas: última `20261103141223`. La migración de encuesta `20261105230000` sigue pendiente.
- Edge Functions activas: `odonto-bot`, `patient-bank-intake`. La función `survey-submissions` sigue pendiente de despliegue.
- La encuesta continúa protegida: aviso de validación técnica y botón deshabilitado. No enlazarla desde la portada ni habilitar envíos hasta que tabla y función estén verificadas.
- QA estática de portada: 100 IDs sin duplicados; 9 anclas internas sin destinos faltantes; los ocho destinos HTML internos revisados existen.
- La revisión de seguridad de Supabase detecta alertas preexistentes (8 tablas RLS sin políticas, 12 funciones SECURITY DEFINER ejecutables por authenticated y protección contra contraseñas filtradas desactivada). No son cambios de esta entrega; no hacer cambios masivos de permisos como parte del deploy de UX.
- Comparación actual: rama 47 commits ahead / 0 behind de `main`, 12 archivos modificados. No se ha abierto PR ni se ha iniciado un deploy desde esta rama.
- No se ejecutaron operaciones remotas de escritura. La activación de la migración, el despliegue de la función y el primer deploy de producción requieren confirmación explícita de la ventana.
