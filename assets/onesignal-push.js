/* OdontoUdeC · puente seguro hacia las notificaciones push de OneSignal */
(() => {
  "use strict";
  window.OdontoPush = Object.freeze({
    async notify(client, eventType, recordId) {
      if (!client?.functions || !eventType || recordId == null) return null;
      try {
        const { data, error } = await client.functions.invoke("onesignal-push", {
          body: { event_type: eventType, record_id: String(recordId) }
        });
        if (error) {
          console.warn("[OdontoUdeC push] No se pudo solicitar la notificación:", error.message || error);
          return null;
        }
        if (data?.error) {
          console.warn("[OdontoUdeC push] El servidor no envió la notificación:", data.error);
          return null;
        }
        return data;
      } catch (error) {
        console.warn("[OdontoUdeC push] Error de conexión:", error);
        return null;
      }
    }
  });
})();
