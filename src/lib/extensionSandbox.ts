export type SandboxCommand = { id: string; title: string; run: () => Promise<void> };
export type SandboxStatusItem = { id: string; text: string; tooltip?: string; alignment: "left" | "right"; priority: number; run?: () => Promise<void> };
export type ExtensionPermission = "notifications";

type SandboxCallbacks = {
  onCommand(command: { id: string; title: string }, run: () => Promise<void>): () => void;
  onStatusItem(item: Omit<SandboxStatusItem, "run">, run?: () => Promise<void>): () => void;
  onMessage(message: string): void;
  onNotification(title: string, body: string): void;
  onError(error: string): void;
};

/**
 * Execute extension code in an opaque-origin iframe, never in the app's WebView
 * realm. The iframe has no same-origin permission, no network connections, and
 * no Tauri bridge. Only validated, structured messages cross the boundary.
 */
export function startExtensionSandbox(
  extension: { manifest: { id: string; name: string; version: string }; entry: string; permissions?: ExtensionPermission[] },
  callbacks: SandboxCallbacks,
): () => void {
  const frame = document.createElement("iframe");
  frame.title = `Sandbox: ${extension.manifest.name}`;
  frame.setAttribute("sandbox", "allow-scripts");
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  Object.assign(frame.style, { position: "fixed", width: "1px", height: "1px", opacity: "0", pointerEvents: "none", border: "0", left: "-10px", bottom: "0" });

  const boot = `
    const extension = ${JSON.stringify(extension.manifest)};
    const grantedPermissions = new Set(${JSON.stringify(extension.permissions ?? [])});
    const send = (type, payload = {}) => parent.postMessage({ __beagleExtensionSandbox: true, type, extensionId: extension.id, ...payload }, '*');
    const commands = new Map();
    const statusItems = new Map();
    const disposers = [];
    let nextId = 0;
    addEventListener('message', async (event) => {
      const message = event.data;
      if (!message || message.__beagleExtensionHost !== true || message.extensionId !== extension.id) return;
      if (message.type === 'invoke') {
        try { await commands.get(message.id)?.(); }
        catch (error) { send('error', { message: String(error) }); }
      }
    });
    const api = Object.freeze({
      extension,
      registerCommand(command) {
        if (!command || typeof command.id !== 'string' || !command.id.trim() || typeof command.title !== 'string' || typeof command.run !== 'function') return () => {};
        const id = command.id;
        if (commands.has(id)) return () => {};
        commands.set(id, command.run);
        send('register-command', { id, title: command.title });
        let disposed = false;
        return () => { if (disposed) return; disposed = true; commands.delete(id); send('unregister-command', { id }); };
      },
      registerStatusBarItem(item) {
        if (!item || typeof item.id !== 'string' || !item.id.trim() || typeof item.text !== 'string') return () => {};
        const id = item.id;
        if (statusItems.has(id)) return () => {};
        if (typeof item.run === 'function') statusItems.set(id, item.run);
        send('register-status', { id, text: item.text, tooltip: typeof item.tooltip === 'string' ? item.tooltip : undefined, alignment: item.alignment === 'right' ? 'right' : 'left', priority: Number.isFinite(item.priority) ? item.priority : 0, hasRun: typeof item.run === 'function' });
        let disposed = false;
        return () => { if (disposed) return; disposed = true; statusItems.delete(id); send('unregister-status', { id }); };
      },
      showMessage(message) { send('show-message', { message: String(message) }); },
      showNotification(notification) {
        if (!grantedPermissions.has('notifications')) throw new Error('Permission denied: notifications. Enable it in Extensions settings.');
        if (!notification || typeof notification.title !== 'string' || !notification.title.trim()) throw new TypeError('Notification title is required.');
        send('notification', { title: notification.title.slice(0, 120), body: typeof notification.body === 'string' ? notification.body.slice(0, 1000) : '' });
      },
    });
    addEventListener('message', async (event) => {
      const message = event.data;
      if (!message || message.__beagleExtensionHost !== true || message.extensionId !== extension.id || message.type !== 'invoke-status') return;
      try { await statusItems.get(message.id)?.(); } catch (error) { send('error', { message: String(error) }); }
    });
    try {
      const module = await import('data:text/javascript;charset=utf-8,' + encodeURIComponent(${JSON.stringify(extension.entry)}));
      const result = await module.activate?.(api);
      if (typeof result === 'function') disposers.push(result);
      else if (result && typeof result.dispose === 'function') disposers.push(() => result.dispose());
      send('ready');
    } catch (error) { send('error', { message: String(error?.stack || error) }); }
    addEventListener('unload', () => { for (const dispose of disposers.reverse()) { try { dispose(); } catch {} } });
  `;
  // The CSP prevents network, navigation, form submission, and external assets.
  // The extension source is JSON-encoded into a module import, not HTML markup.
  const srcdoc = `<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' data:; connect-src 'none'; img-src data:; style-src 'unsafe-inline'; form-action 'none'; base-uri 'none'; navigate-to 'none'"><script type="module">${boot.replace(/<\/script/gi, "<\\/script")}</script>`;
  frame.srcdoc = srcdoc;

  const registeredCommands = new Map<string, () => void>();
  const registeredStatuses = new Map<string, () => void>();
  let disposed = false;
  const onMessage = (event: MessageEvent) => {
    if (disposed || event.source !== frame.contentWindow) return;
    const data = event.data;
    if (!data || data.__beagleExtensionSandbox !== true || data.extensionId !== extension.manifest.id || typeof data.type !== "string") return;
    const send = (type: string, id: string) => frame.contentWindow?.postMessage({ __beagleExtensionHost: true, type, extensionId: extension.manifest.id, id }, "*");
    if (data.type === "register-command" && typeof data.id === "string" && typeof data.title === "string" && !registeredCommands.has(data.id)) {
      const dispose = callbacks.onCommand({ id: data.id, title: data.title }, async () => send("invoke", data.id));
      registeredCommands.set(data.id, dispose);
    } else if (data.type === "unregister-command" && typeof data.id === "string") {
      registeredCommands.get(data.id)?.(); registeredCommands.delete(data.id);
    } else if (data.type === "register-status" && typeof data.id === "string" && typeof data.text === "string" && !registeredStatuses.has(data.id)) {
      const item = { id: data.id, text: data.text, ...(typeof data.tooltip === "string" ? { tooltip: data.tooltip } : {}), alignment: data.alignment === "right" ? "right" as const : "left" as const, priority: Number.isFinite(data.priority) ? data.priority : 0 };
      const dispose = callbacks.onStatusItem(item, data.hasRun === true ? async () => send("invoke-status", data.id) : undefined);
      registeredStatuses.set(data.id, dispose);
    } else if (data.type === "unregister-status" && typeof data.id === "string") {
      registeredStatuses.get(data.id)?.(); registeredStatuses.delete(data.id);
    } else if (data.type === "show-message") {
      callbacks.onMessage(String(data.message ?? ""));
    } else if (data.type === "notification") {
      if (!(extension.permissions ?? []).includes("notifications")) return;
      callbacks.onNotification(String(data.title ?? "Extension notification").slice(0, 120), String(data.body ?? "").slice(0, 1000));
    } else if (data.type === "error") {
      callbacks.onError(String(data.message ?? "Extension sandbox error"));
    }
  };
  window.addEventListener("message", onMessage);
  document.body.appendChild(frame);

  return () => {
    disposed = true;
    window.removeEventListener("message", onMessage);
    for (const dispose of registeredCommands.values()) dispose();
    for (const dispose of registeredStatuses.values()) dispose();
    registeredCommands.clear(); registeredStatuses.clear();
    frame.remove();
  };
}
