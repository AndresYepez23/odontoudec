# SEO técnico de OdontoUdeC — 11 de noviembre de 2026

Dominio canónico: https://odontoudec.online/

## Páginas públicas indexables
- / — comunidad estudiantil independiente, recursos y agenda.
- /academia.html — recorrido curricular de referencia y módulos de estudio.
- /literatura-cientifica.html — búsquedas académicas en PubMed, Europe PMC, OpenAlex y Crossref.
- /laboratorio-ia.html — herramientas web de apoyo para texto, documentos, audio, imágenes, vídeo y 3D.
- /banco-pacientes.html — página informativa de contacto entre pacientes y estudiantes; no publica datos enviados por usuarios.
- /grupos-estudio.html — presentación pública de aprendizaje colaborativo; los grupos y conversaciones requieren sesión.
- /privacidad.html — política de privacidad.
- /terminos.html — términos y condiciones.

Estas páginas reciben title, description, canonical absoluto, Open Graph, Twitter Cards y JSON-LD WebPage/WebSite/Organization/BreadcrumbList según corresponda. El marcado describe OdontoUdeC como proyecto estudiantil independiente; no afirma que sea un sitio oficial de la Universidad de Cartagena.

## Rutas excluidas del índice
Las páginas siguientes reciben `noindex,follow` porque contienen o habilitan sesiones, datos personales, operaciones autenticadas o flujos transaccionales:
- /chat.html
- /mensajes.html
- /mi-espacio.html
- /perfil-academico.html
- /estudiante.html
- /encuesta-estudiantil.html
- /verificacion.html
- /restablecer-contrasena.html
- /docs/ATLAS_DENTAL_ARCHIVO.html (archivo legado)
- /biblioteca-upload.html ya tenía noindex,nofollow.
- /oauth/consent/ ya tenía noindex,nofollow.

No bloquear estas rutas mediante robots.txt: el rastreador necesita poder leer la meta noindex. La aplicación, los permisos de Supabase, los datos y el flujo de autenticación no se alteran.

## Sitemap y rastreo
- Sitemap: https://odontoudec.online/sitemap.xml
- Robots: https://odontoudec.online/robots.txt
- El sitemap enumera solo las ocho páginas públicas canónicas. No enumera fragmentos (#agenda, #biblioteca, #tarifario), rutas privadas, archivos internos, previews ni el dominio netlify.app.
- El calendario y las secciones de biblioteca/recursos que viven como bloques dentro de la portada siguen siendo secciones de /, no páginas independientes; no se crean URLs artificiales ni páginas delgadas para ellas.

## Criterios
- Sin keyword stuffing, contenido oculto, páginas duplicadas ni promesas clínicas/institucionales no verificadas.
- No se agregan nuevas dependencias ni cambios de JavaScript, estilos o comportamiento de la aplicación.
- Los cambios visibles se limitan a dos enlaces discretos de Privacidad y Términos dentro del footer ya existente.
- En Search Console, enviar sitemap.xml una vez y supervisar indexación; enviar sitemap es una señal de rastreo, no garantía de indexación.
