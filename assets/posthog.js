// OdontoUdeC · PostHog
// Analítica agregada y respetuosa con la privacidad.
// No captura formularios, texto escrito, identificadores personales ni grabaciones.
(function () {
  if (window.__ODONTO_POSTHOG_INITIALIZED) return;
  window.__ODONTO_POSTHOG_INITIALIZED = true;

  !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],Object.defineProperty(u,"toString",{configurable:!0,enumerable:!0,writable:!0,value:function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e}}),Object.defineProperty(u.people,"toString",{configurable:!0,enumerable:!0,writable:!0,value:function(){return u.toString(1)+" (stub)"}}),o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagResult isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags resetPersonProperties get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);

  const pageNames = {
    "/": "Inicio", "/index.html": "Inicio",
    "/academia.html": "Academia",
    "/banco-pacientes.html": "Banco de pacientes",
    "/chat.html": "Chat comunitario",
    "/encuesta-estudiantil.html": "Encuesta estudiantil",
    "/estudiante.html": "Perfil de estudiante",
    "/grupos-estudio.html": "Grupos de estudio",
    "/mensajes.html": "Mensajes privados",
    "/mi-espacio.html": "Mi espacio",
    "/perfil-academico.html": "Perfil académico"
  };
  const pathFeatures = {
    "/academia.html": "Academia",
    "/banco-pacientes.html": "Banco de pacientes",
    "/chat.html": "Chat comunitario",
    "/encuesta-estudiantil.html": "Encuesta estudiantil",
    "/grupos-estudio.html": "Grupos de estudio",
    "/mensajes.html": "Mensajes privados",
    "/mi-espacio.html": "Mi espacio",
    "/perfil-academico.html": "Perfil académico"
  };
  const hashFeatures = {
    "#comunidad": "Comunidad", "#academia": "Academia",
    "#recursos": "Biblioteca académica", "#calendario": "Calendario académico",
    "#odonto-bot": "OdontoBot", "#trivia": "OdontoTrivia",
    "#atlas": "Atlas dental", "#pensum": "Pensum interactivo",
    "#acceso": "Acceso y registro", "#memoria-estudiantil": "Memoria estudiantil"
  };
  const allowedFeatures = new Set([...Object.values(pathFeatures), ...Object.values(hashFeatures)]);
  const pathname = window.location.pathname.replace(/\/+$/, "") || "/";
  const pageName = pageNames[pathname] || "Otra página";
  const environment = /(^|\.)odontoudec\.online$/i.test(window.location.hostname) ? "production" : "preview";

  window.posthog.init("phc_yW6VUSFfzqUnwFetjmcooH9qNUcdm3wRMBPkHypEuiAK", {
    api_host: "https://us.i.posthog.com",
    defaults: "2026-08-30",
    autocapture: false,
    disable_session_recording: true,
    capture_pageview: false,
    capture_pageleave: false,
    person_profiles: "identified_only",
    loaded: function (ph) {
      ph.register({ environment: environment });
      const cleanUrl = window.location.origin + pathname;
      let cleanReferrer = "";
      try {
        if (document.referrer) {
          const ref = new URL(document.referrer);
          cleanReferrer = ref.origin + ref.pathname;
        }
      } catch (_) {}
      ph.capture("$pageview", {
        "$current_url": cleanUrl,
        "$pathname": pathname,
        "$referrer": cleanReferrer,
        "page_name": pageName,
        "environment": environment
      });
    }
  });

  window.OdontoAnalytics = Object.freeze({
    trackFeature: function (feature) {
      if (allowedFeatures.has(feature) && window.posthog && window.posthog.capture) {
        window.posthog.capture("ou_feature_opened", { feature: feature, environment: environment });
      }
    }
  });

  document.addEventListener("click", function (event) {
    const target = event.target instanceof Element
      ? event.target.closest("a[href], [data-ph-feature]")
      : null;
    if (!target) return;
    const explicitFeature = target.getAttribute("data-ph-feature");
    if (explicitFeature && allowedFeatures.has(explicitFeature)) {
      window.OdontoAnalytics.trackFeature(explicitFeature);
      return;
    }
    const href = target.getAttribute("href");
    if (!href || href.startsWith("mailto:") || href.startsWith("tel:")) return;
    try {
      const url = new URL(href, window.location.href);
      if (url.origin !== window.location.origin) return;
      const feature = hashFeatures[url.hash] || pathFeatures[url.pathname];
      if (feature) window.OdontoAnalytics.trackFeature(feature);
    } catch (_) {}
  }, true);
})();