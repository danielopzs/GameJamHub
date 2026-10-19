import { STATIC_MODE } from "./runtime";
import { useState } from "react";
import { Bell, Check } from "lucide-react";
export function PushControls({ notify }: { notify: (text: string) => void }) {
  const [role, setRole] = useState("Todos");
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState(false);
  async function enable() {
    if (
      !("Notification" in window) ||
      !("PushManager" in window) ||
      !("serviceWorker" in navigator)
    ) {
      notify("Web Push no está disponible en este navegador. Usa HTTPS.");
      return;
    }
    setBusy(true);
    try {
      if ((await Notification.requestPermission()) !== "granted") {
        notify("Permiso de notificaciones no concedido");
        return;
      }
      const response = await fetch("/api/push/key");
      if (!response.ok) throw Error("Inicia el servidor para habilitar push.");
      const { publicKey } = await response.json();
      const padded = publicKey.replace(/-/g, "+").replace(/_/g, "/");
      const key = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
      const registration = await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ||
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: key,
        }));
      const saved = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription, role }),
      });
      if (!saved.ok) throw Error("No se pudo registrar la suscripción push.");
      setActive(true);
      notify("Push programado activado para " + role);
    } catch (e) {
      notify(e instanceof Error ? e.message : "No se pudo activar Web Push");
    } finally {
      setBusy(false);
    }
  }
  async function disable() {
    try {
      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.getSubscription();
      if (subscription) {
        const response = await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        if (!response.ok) throw Error("No se pudo actualizar el servidor");
        await subscription.unsubscribe();
      }
      setActive(false);
      notify("Suscripción push cancelada");
    } catch {
      notify("Conéctate al servidor para cancelar la suscripción");
    }
  }
  if (STATIC_MODE)
    return (
      <p className="info-note">
        Modo de prueba gratuito: los recordatorios locales funcionan con la app
        abierta y permiso de notificaciones. Web Push con la app cerrada y la
        sincronización entre dispositivos requieren el servidor; no están
        activos en esta versión estática.
      </p>
    );
  return (
    <div className="push-controls">
      <label>
        Recibir avisos para
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          {[
            "Todos",
            "General",
            "Logística",
            "Catering",
            "Streaming",
            "Staff & Participantes",
          ].map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </label>
      <button className="button primary" disabled={busy} onClick={enable}>
        {active ? <Check size={15} /> : <Bell size={15} />}{" "}
        {busy
          ? "Conectando…"
          : active
            ? "Actualizar suscripción"
            : "Activar Web Push"}
      </button>
      {active && (
        <button className="text-button" onClick={disable}>
          Cancelar suscripción
        </button>
      )}
    </div>
  );
}
