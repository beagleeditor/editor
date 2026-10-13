export function activate(api) {
  const unregister = api.registerCommand({
    id: 'count-words',
    title: 'Count Words',
    run: () => {
      const document = api.getActiveDocument();

      if (!document) {
        api.showMessage('Open a document first.');
        return;
      }

      const words = document.content.trim()
        ? document.content.trim().split(/\s+/).length
        : 0;

      api.showMessage(`Word count: ${words}`);
    },
  });

  return () => unregister();
}
