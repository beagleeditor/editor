export function activate(api) {
  return api.registerStatusBarItem({
    id: "notify",
    text: "Notify me",
    tooltip: "Send an example notification",
    alignment: "right",
    priority: 5,
    run: () => api.showNotification({
      title: "BeagleEditor is ready",
      body: "The notification status-bar example is working.",
    }),
  });
}
