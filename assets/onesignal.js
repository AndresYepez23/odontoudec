// onesignal:managed v1
// Toda interacción con el SDK pasa por este controlador.
(function () {
  const deferred = window.OneSignalDeferred =
    window.OneSignalDeferred || [];

  let desiredId = null;
  let appliedId = undefined;
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
          } else {
            await OneSignal.logout();
          }

          appliedId = target;
        }
      } catch (error) {
        console.warn("[OneSignal] No se pudo sincronizar la sesión:", error);
      } finally {
        scheduled = false;
      }
    });
  }

  window.OdontoOneSignal = Object.freeze({ syncUser });
})();
