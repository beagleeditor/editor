export function activate(api) {
  const unregister = api.registerCommand({
    id: "hello",
    title: "Say Hello",
    run: () => api.showMessage("Hello from your first BeagleEditor extension!")
  });

  return () => unregister();
}
