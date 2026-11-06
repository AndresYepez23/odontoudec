// onesignal:managed v1
// Toda interacción con el SDK pasa por este controlador.
(function () {
  const deferred = window.OneSignalDeferred =
    window.OneSignalDeferred || [];

  let desiredId = null;
  // null significa que todavía no hay ningún usuario asociado.
  // No llamar logout() en una sesión anónima: el SDK puede fallar
  // si nunca se ejecutó login() en esta instancia.
  let appliedId = null;
  let scheduled = false;

  function syncUser(user) {
    desiredId = typeof user?.id === "string" ? user.id : null;

    if (scheduled) return;
    scheduled = true;

    deferred.push(async function (OneSignal) {
      try {
        while (appliedId !== desiredId) {
          const target = desiredId;

          if (target) {
            await OneSignal.login(target);
          } else if (appliedId !== null) {
            await OneSignal.logout();
          }

          appliedId = target;
        }
      } catch (error) {
        console.warn("[OneSignal] No se pudo sincronizar la sesión:", error);
      } finally {
        scheduled = false;
        // Si llegó un cambio de sesión durante una operación fallida,
        // vuelve a programar la sincronización con el estado más reciente.
        if (appliedId !== desiredId) syncUser({ id: desiredId });
      }
    });
  }

  window.OdontoOneSignal = Object.freeze({ syncUser });
})();
