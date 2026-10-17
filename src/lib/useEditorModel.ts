import { useCallback, useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import * as monaco from "monaco-editor";
import type { Tab } from "../components/EditorTabs";
import type { EditorProblem } from "../components/ProblemsPanel";
import { attachModelSync, listenDiagnostics } from "./lsp";
import { editorOptions } from "./settings";
import { getModelUriForTab } from "./editorUtils";

type Settings = Parameters<typeof editorOptions>[0];

type UseEditorModelOptions = {
  activeTab: Tab | undefined;
  activeTabId: string | null;
  editorRef: MutableRefObject<any>;
  settings: Settings;
  setDiagnosticsByPath: Dispatch<SetStateAction<Record<string, EditorProblem[]>>>;
  setPreviewMode: Dispatch<SetStateAction<"edit" | "preview" | "split">>;
};

export function useEditorModel({
  activeTab,
  activeTabId,
  editorRef,
  settings,
  setDiagnosticsByPath,
  setPreviewMode,
}: UseEditorModelOptions) {
  const activeModelRef = useRef<monaco.editor.ITextModel | null>(null);

  const syncActiveModel = useCallback(() => {
    if (!activeTab) {
      activeModelRef.current = null;
      return null;
    }

    const uri = getModelUriForTab(activeTab);
    let model = monaco.editor.getModel(uri);

    if (!model) {
      model = monaco.editor.createModel(activeTab.content, activeTab.language, uri);
    } else {
      if (model.getValue() !== activeTab.content) model.setValue(activeTab.content);
      monaco.editor.setModelLanguage(model, activeTab.language);
    }

    activeModelRef.current = model;
    if (activeTab.language) void attachModelSync(model, activeTab.language);
    return model;
  }, [activeTab]);

  useEffect(() => {
    if (activeTab) syncActiveModel();
  }, [activeTab, syncActiveModel]);

  useEffect(() => {
    if (!editorRef.current || !settings) return;
    editorRef.current.updateOptions(editorOptions(settings));
    const model = editorRef.current.getModel();
    if (!model) return;
    if (settings.detectIndentation) model.detectIndentation(settings.insertSpaces, settings.tabSize);
    else model.updateOptions({ insertSpaces: settings.insertSpaces, tabSize: settings.tabSize });
  }, [editorRef, settings]);

  useEffect(() => {
    let dispose: (() => void) | undefined;
    let cancelled = false;

    void listenDiagnostics((payload) => {
      const uri = monaco.Uri.parse(payload.uri);
      const path = payload.path ?? (uri.scheme === "file" ? uri.fsPath : payload.uri);
      const diagnostics = (payload.diagnostics ?? []).map((diagnostic: any) => ({
        path,
        line: diagnostic.range.start.line + 1,
        column: diagnostic.range.start.character + 1,
        endLine: diagnostic.range.end.line + 1,
        endColumn: diagnostic.range.end.character + 1,
        message: diagnostic.message,
        severity: diagnostic.severity ?? 3,
        source: diagnostic.source,
        code: typeof diagnostic.code === "string" || typeof diagnostic.code === "number" ? String(diagnostic.code) : undefined,
      } satisfies EditorProblem));

      setDiagnosticsByPath((current) => {
        const next = { ...current };
        if (diagnostics.length) next[path] = diagnostics;
        else delete next[path];
        return next;
      });

      const model = monaco.editor.getModel(uri);
      if (model) monaco.editor.setModelMarkers(model, "lsp", diagnostics.map((diagnostic) => ({
        startLineNumber: diagnostic.line,
        startColumn: diagnostic.column,
        endLineNumber: diagnostic.endLine,
        endColumn: diagnostic.endColumn,
        message: diagnostic.message,
        severity: diagnostic.severity === 1 ? monaco.MarkerSeverity.Error : diagnostic.severity === 2 ? monaco.MarkerSeverity.Warning : monaco.MarkerSeverity.Info,
      })));
    }).then((cleanup) => {
      if (cancelled) cleanup();
      else dispose = cleanup;
    }).catch((error) => console.error("Could not subscribe to diagnostics:", error));

    return () => {
      cancelled = true;
      dispose?.();
    };
  }, [setDiagnosticsByPath]);

  useEffect(() => {
    setPreviewMode(activeTab?.language === "markdown" ? "split" : "edit");
  }, [activeTabId, activeTab?.language, setPreviewMode]);

  return { activeModelRef, syncActiveModel };
}
