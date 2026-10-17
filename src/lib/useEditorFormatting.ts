import { useCallback, type MutableRefObject } from "react";
import * as monaco from "monaco-editor";
import type { Tab } from "../components/EditorTabs";
import { formatDocument } from "./lsp";

export function useEditorFormatting(
  editorRef: MutableRefObject<any>,
  activeTabRef: MutableRefObject<Tab | undefined>,
) {
  const formatActiveDocument = useCallback(async () => {
    const editor = editorRef.current;
    const tab = activeTabRef.current;
    if (!tab?.path || !editor) return;
    try {
      const response = await formatDocument(tab.path);
      const edits = response.result;
      if (!Array.isArray(edits) || edits.length === 0) return;
      editor.executeEdits("format-document", edits.map((edit: any) => ({
        range: new monaco.Range(
          edit.range.start.line + 1,
          edit.range.start.character + 1,
          edit.range.end.line + 1,
          edit.range.end.character + 1,
        ),
        text: edit.newText,
        forceMoveMarkers: true,
      })));
    } catch (error) {
      console.error("Document formatting failed:", error);
    }
  }, [editorRef, activeTabRef]);

  const addFormatAction = useCallback((editor: any, monacoInstance: typeof monaco) => {
    editor.addAction({
      id: "beagle.format-document",
      label: "Format Document",
      keybindings: [monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyMod.Shift | monacoInstance.KeyCode.KeyI],
      contextMenuGroupId: "1_modification",
      contextMenuOrder: 1,
      run: () => formatActiveDocument(),
    });
  }, [formatActiveDocument]);

  return { formatActiveDocument, addFormatAction };
}
