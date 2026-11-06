// onesignal:managed v1
// Toda interacción con el SDK pasa por este controlador.
(function () {
  const deferred = window.OneSignalDeferred =
    window.OneSignalDeferred || [];

  let sdkInstance = null;
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
      sdkInstance = OneSignal;
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

  async function requestPermission() {
    const run = async OneSignal => {
      try {
        sdkInstance = OneSignal;
        await OneSignal.Notifications.requestPermission();
        if (OneSignal.Notifications.permission) {
          await OneSignal.User.PushSubscription.optIn();
        }
        return {
          permission: Boolean(OneSignal.Notifications.permission),
          optedIn: Boolean(OneSignal.User.PushSubscription.optedIn)
        };
      } catch (error) {
        console.warn("[OneSignal] No se pudo activar la suscripción push:", error);
        return { permission: false, optedIn: false, error: String(error?.message || error) };
      }
    };
    if (sdkInstance) return run(sdkInstance);
    return new Promise(resolve => deferred.push(async OneSignal => resolve(await run(OneSignal))));
  }

  window.OdontoOneSignal = Object.freeze({ syncUser, requestPermission });
})();
