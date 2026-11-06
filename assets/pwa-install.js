(() => {
  "use strict";
  const button = document.getElementById("installPwaButton");
  const help = document.getElementById("pwaInstallHelp");
  if (!button || !help || window.top !== window.self) return;

  const standalone = window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    window.navigator.standalone === true;
  if (standalone) {
    button.hidden = true;
    return;
  }

  const ua = navigator.userAgent || "";
  const isIOS = /iPhone|iPad|iPod/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  let installPrompt = null;

  if (isIOS || isAndroid) button.hidden = false;

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    installPrompt = event;
    button.hidden = false;
    button.textContent = "📲 Instalar aplicación";
  });

  button.addEventListener("click", async () => {
    if (installPrompt) {
      const promptEvent = installPrompt;
      installPrompt = null;
      try {
        await promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        if (choice?.outcome === "accepted") {
          button.hidden = true;
          help.hidden = true;
        } else {
          button.textContent = "Intentar instalar de nuevo";
        }
      } catch (error) {
        console.warn("[OdontoUdeC PWA] No se pudo abrir el diálogo de instalación:", error);
        help.textContent = "Abre el menú de tu navegador y selecciona «Instalar aplicación» o «Añadir a pantalla de inicio».";
        help.hidden = false;
      }
      return;
    }

    if (isIOS) {
      help.textContent = "En iPhone o iPad: toca Compartir en el navegador, selecciona «Añadir a pantalla de inicio» y confirma con «Añadir». Después abre OdontoUdeC desde el nuevo icono para usarla sin las barras de Safari.";
    } else if (isAndroid) {
      help.textContent = "En Android: abre el menú ⋮ de Chrome y elige «Instalar aplicación» o «Añadir a pantalla de inicio». Después abre OdontoUdeC desde el icono para usarla sin la barra de direcciones.";
    } else {
      help.textContent = "Abre el menú de tu navegador y selecciona «Instalar aplicación» o «Añadir a pantalla de inicio».";
    }
    help.hidden = false;
    button.setAttribute("aria-expanded", "true");
  });

  window.addEventListener("appinstalled", () => {
    button.hidden = true;
    help.hidden = true;
  });
})();
