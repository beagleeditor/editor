export function activate(api) {
  return api.registerCommand({
    id: "send-demo-notification",
    title: "Send Demo Notification",
    run: () => api.showNotification({
      title: "Hello from an extension",
      body: "This notification was sent through the permission-gated BeagleEditor notification API.",
    }),
  });
}
