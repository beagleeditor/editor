import { useEffect } from "react";
import type { MutableRefObject, Dispatch, SetStateAction } from "react";
import { fsAPI } from "./fs";
import { searchAPI } from "./search";
import * as monaco from "monaco-editor";
import type { Tab } from "../components/EditorTabs";
import type { PaletteCommand } from "../components/CommandPalette";

type Extension = { manifest: { id: string; name: string; version: string; description?: string; main?: string; type?: string; theme?: string }; entry: string; themeData?: unknown; path: string };
type Snapshot = { id: string; name: string; path: string | null; language: string; content: string; dirty: boolean } | null;
type Command = PaletteCommand & { extensionId: string };
export type ExtensionStatusItem = { id: string; extensionId: string; text: string; tooltip?: string; alignment: "left" | "right"; priority: number; run?: () => void | Promise<void> };
type Props = {
  extensions: Extension[];
  enabledExtensions: Record<string, boolean>;
  activeTabRef: MutableRefObject<Tab | undefined>;
  tabsRef: MutableRefObject<Tab[]>;
  workspaceDirRef: MutableRefObject<string | null>;
  editorRef: MutableRefObject<any>;
  setTabs: Dispatch<SetStateAction<Tab[]>>;
  setExtensionCommands: Dispatch<SetStateAction<Command[]>>;
  setExtensionStatusItems: Dispatch<SetStateAction<ExtensionStatusItem[]>>;
  setExtensionStatus: Dispatch<SetStateAction<string>>;
  activeDocumentListeners: MutableRefObject<Set<(document: Snapshot) => void>>;
};

function snapshot(tab: Tab | undefined): Snapshot {
  return tab ? { id: tab.id, name: tab.name, path: tab.path, language: tab.language, content: tab.content, dirty: tab.dirty } : null;
}

export function useExtensionRuntime({ extensions, enabledExtensions, activeTabRef, tabsRef, workspaceDirRef, editorRef, setTabs, setExtensionCommands, setExtensionStatusItems, setExtensionStatus, activeDocumentListeners }: Props) {
  useEffect(() => {
    let cancelled = false;
    const disposers = new Map<string, () => void>();
    const commands: Command[] = [];
    const statusItems: ExtensionStatusItem[] = [];

    const activate = async () => {
      for (const extension of extensions) {
        const id = extension.manifest.id;
        if (enabledExtensions[id] === false || extension.manifest.type === "theme") continue;
        const apiDisposers: Array<() => void> = [];
        const trackDisposable = (dispose: () => void) => {
          let disposed = false;
          const once = () => { if (disposed) return; disposed = true; dispose(); };
          apiDisposers.push(once);
          return once;
        };
        try {
          const moduleUrl = `data:text/javascript;charset=utf-8,${encodeURIComponent(extension.entry)}`;
          const module = await import(/* @vite-ignore */ moduleUrl) as { activate?: (api: any) => unknown | Promise<unknown> };
          if (cancelled) break;
          const registered = new Map<string, Command>();
          const registeredStatusItems = new Map<string, ExtensionStatusItem>();
          const result = await module.activate?.({
            extension: extension.manifest,
            registerCommand: (command: { id: string; title: string; run: () => void | Promise<void> }) => {
              if (!command?.id || !command.title || typeof command.run !== "function") return () => {};
              const fullId = `${id}.${command.id}`;
              if (registered.has(fullId)) return () => {};
              const item: Command = {
                id: fullId, label: command.title, category: extension.manifest.name, extensionId: id,
                run: async () => {
                  try { await command.run(); }
                  catch (error) { console.error(`Extension ${id} command "${command.title}" failed:`, error); setExtensionStatus(`${extension.manifest.name}: “${command.title}” failed; see developer console`); }
                },
              };
              registered.set(fullId, item); commands.push(item); setExtensionCommands([...commands]);
              return () => { registered.delete(fullId); const index = commands.findIndex((entry) => entry.id === fullId); if (index !== -1) commands.splice(index, 1); setExtensionCommands([...commands]); };
            },
            registerStatusBarItem: (item: { id: string; text: string; tooltip?: string; alignment?: "left" | "right"; priority?: number; run?: () => void | Promise<void> }) => {
              if (!item || typeof item.id !== "string" || !item.id.trim() || typeof item.text !== "string") return () => {};
              const fullId = `${id}.${item.id}`;
              if (registeredStatusItems.has(fullId)) return () => {};
              const statusItem: ExtensionStatusItem = {
                id: fullId, extensionId: id, text: item.text,
                ...(typeof item.tooltip === "string" ? { tooltip: item.tooltip } : {}),
                alignment: item.alignment === "right" ? "right" : "left",
                priority: Number.isFinite(item.priority) ? Number(item.priority) : 0,
                ...(typeof item.run === "function" ? { run: async () => {
                  try { await item.run?.(); }
                  catch (error) { console.error(`Extension ${id} status item failed:`, error); setExtensionStatus(`${extension.manifest.name}: status item failed; see developer console`); }
                } } : {}),
              };
              registeredStatusItems.set(fullId, statusItem);
              statusItems.push(statusItem);
              setExtensionStatusItems([...statusItems]);
              return () => {
                registeredStatusItems.delete(fullId);
                const index = statusItems.findIndex((entry) => entry.id === fullId);
                if (index !== -1) statusItems.splice(index, 1);
                setExtensionStatusItems([...statusItems]);
              };
            },
            showMessage: (message: unknown) => window.alert(`[${extension.manifest.name}] ${String(message)}`),
            getActiveDocument: () => snapshot(activeTabRef.current),
            getOpenDocuments: () => tabsRef.current.map(snapshot),
            getWorkspaceDirectory: () => workspaceDirRef.current,
            readFile: (path: string) => fsAPI.readFile(path),
            readDirectory: (path: string) => fsAPI.readDir(path),
            pathExists: (path: string) => fsAPI.exists(path),
            createFile: (path: string) => fsAPI.createFile(path),
            createDirectory: (path: string) => fsAPI.createDir(path),
            renamePath: (oldPath: string, newPath: string) => fsAPI.renamePath(oldPath, newPath),
            deletePath: (path: string) => fsAPI.deletePath(path),
            revealPath: (path: string) => fsAPI.revealInFinder(path),
            writeFile: async (path: string, content: string) => {
              if (typeof path !== "string" || !path.trim()) throw new TypeError("A file path is required.");
              if (typeof content !== "string") throw new TypeError("File content must be a string.");
              await fsAPI.writeFile(path, content);
              const active = activeTabRef.current; const model = editorRef.current?.getModel?.();
              if (active?.path === path && model && model.getValue() !== content) model.setValue(content);
              setTabs((previous) => previous.map((tab) => tab.path === path ? { ...tab, content, dirty: false } : tab));
            },
            searchWorkspace: async (query: string) => {
              const root = workspaceDirRef.current;
              if (!root) throw new Error("Open a workspace before searching it.");
              if (typeof query !== "string" || !query.trim()) return [];
              return searchAPI.searchWorkspace(root, query);
            },
            getEditorSelection: () => {
              const editor = editorRef.current; const model = editor?.getModel?.(); const selection = editor?.getSelection?.();
              if (!model || !selection) return null;
              return { text: model.getValueInRange(selection), startLineNumber: selection.startLineNumber, startColumn: selection.startColumn, endLineNumber: selection.endLineNumber, endColumn: selection.endColumn, isEmpty: selection.isEmpty() };
            },
            replaceEditorSelection: (text: string) => {
              if (typeof text !== "string") throw new TypeError("Replacement text must be a string.");
              const editor = editorRef.current; const model = editor?.getModel?.(); const selection = editor?.getSelection?.();
              if (!editor || !model || !selection) return false;
              editor.executeEdits(`extension:${id}`, [{ range: selection, text, forceMoveMarkers: true }]); editor.focus(); return true;
            },
            getEditorPosition: () => {
              const position = editorRef.current?.getPosition?.();
              return position ? { lineNumber: position.lineNumber, column: position.column } : null;
            },
            getEditorLanguage: () => editorRef.current?.getModel?.()?.getLanguageId?.() ?? null,
            setEditorLanguage: (language: string) => {
              if (typeof language !== "string" || !language.trim()) return false;
              const editor = editorRef.current;
              const model = editor?.getModel?.();
              const tab = activeTabRef.current;
              if (!editor || !model || !tab) return false;
              monaco.editor.setModelLanguage(model, language.trim());
              setTabs((previous) => previous.map((item) => item.id === tab.id ? { ...item, language: language.trim() } : item));
              return true;
            },
            getEditorLineCount: () => editorRef.current?.getModel?.()?.getLineCount?.() ?? null,
            getEditorLineContent: (lineNumber: number) => {
              const model = editorRef.current?.getModel?.();
              if (!model || !Number.isInteger(lineNumber) || lineNumber < 1 || lineNumber > model.getLineCount()) return null;
              return model.getLineContent(lineNumber);
            },
            setEditorDecorations: (decorations: Array<{ lineNumber: number; className?: string; glyphMarginClassName?: string; hoverMessage?: string; isWholeLine?: boolean }>) => {
              const model = editorRef.current?.getModel?.();
              if (!model || !Array.isArray(decorations)) return () => {};
              const valid = decorations.filter((decoration) => decoration && Number.isInteger(decoration.lineNumber) && decoration.lineNumber >= 1 && decoration.lineNumber <= model.getLineCount()).map((decoration) => ({
                range: { startLineNumber: decoration.lineNumber, startColumn: 1, endLineNumber: decoration.lineNumber, endColumn: model.getLineMaxColumn(decoration.lineNumber) },
                options: {
                  ...(typeof decoration.className === "string" ? { className: decoration.className } : {}),
                  ...(typeof decoration.glyphMarginClassName === "string" ? { glyphMarginClassName: decoration.glyphMarginClassName } : {}),
                  ...(typeof decoration.hoverMessage === "string" ? { hoverMessage: { value: decoration.hoverMessage } } : {}),
                  ...(decoration.isWholeLine ? { isWholeLine: true } : {}),
                },
              }));
              const ids = model.deltaDecorations([], valid);
              let disposed = false;
              return () => {
                if (disposed) return;
                disposed = true;
                if (!model.isDisposed()) model.deltaDecorations(ids, []);
              };
            },
            setEditorPosition: (lineNumber: number, column: number) => {
              const editor = editorRef.current;
              if (!editor || !Number.isInteger(lineNumber) || !Number.isInteger(column) || lineNumber < 1 || column < 1) return false;
              const model = editor.getModel();
              if (!model) return false;
              const line = Math.min(lineNumber, model.getLineCount());
              editor.setPosition({ lineNumber: line, column: Math.min(column, model.getLineMaxColumn(line)) }); editor.revealPositionInCenter(editor.getPosition()); editor.focus(); return true;
            },
            insertTextAtCursor: (text: string) => {
              if (typeof text !== "string") throw new TypeError("Inserted text must be a string.");
              const editor = editorRef.current; const model = editor?.getModel?.(); const position = editor?.getPosition?.();
              if (!editor || !model || !position) return false;
              editor.executeEdits(`extension:${id}`, [{ range: { startLineNumber: position.lineNumber, startColumn: position.column, endLineNumber: position.lineNumber, endColumn: position.column }, text, forceMoveMarkers: true }]); editor.focus(); return true;
            },
            updateActiveDocument: (content: string) => {
              if (typeof content !== "string") throw new TypeError("Document content must be a string.");
              const tab = activeTabRef.current; if (!tab) return false;
              const model = editorRef.current?.getModel?.(); if (model && model.getValue() !== content) model.setValue(content);
              setTabs((previous) => previous.map((item) => item.id === tab.id ? { ...item, content, dirty: true } : item)); return true;
            },
            onDidChangeActiveDocument: (listener: (document: Snapshot) => void) => {
              if (typeof listener !== "function") return () => {};
              activeDocumentListeners.current.add(listener);
              try { listener(snapshot(activeTabRef.current)); } catch (error) { console.error(`Extension ${id} active-document listener failed:`, error); }
              return trackDisposable(() => activeDocumentListeners.current.delete(listener));
            },
            onDidChangeEditorSelection: (listener: (event: { text: string; startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number; isEmpty: boolean } | null) => void) => {
              const editor = editorRef.current;
              if (typeof listener !== "function" || !editor?.onDidChangeCursorSelection) return () => {};
              const subscription = editor.onDidChangeCursorSelection(() => {
                try {
                  const model = editor.getModel?.();
                  const selection = editor.getSelection?.();
                  listener(!model || !selection ? null : {
                    text: model.getValueInRange(selection),
                    startLineNumber: selection.startLineNumber,
                    startColumn: selection.startColumn,
                    endLineNumber: selection.endLineNumber,
                    endColumn: selection.endColumn,
                    isEmpty: selection.isEmpty(),
                  });
                } catch (error) { console.error(`Extension ${id} selection listener failed:`, error); }
              });
              return trackDisposable(() => subscription.dispose());
            },
            onDidChangeTextDocument: (listener: (event: { document: Snapshot; changes: Array<{ range: unknown; rangeOffset: number; rangeLength: number; text: string }>; versionId: number; isUndoing: boolean; isRedoing: boolean }) => void) => {
              const editor = editorRef.current;
              if (typeof listener !== "function" || !editor?.onDidChangeModelContent) return () => {};
              const subscription = editor.onDidChangeModelContent((event: any) => {
                try {
                  const document = snapshot(activeTabRef.current);
                  if (!document) return;
                  listener({ document, changes: event.changes, versionId: event.versionId, isUndoing: event.isUndoing, isRedoing: event.isRedoing });
                } catch (error) { console.error(`Extension ${id} document-change listener failed:`, error); }
              });
              return trackDisposable(() => subscription.dispose());
            },
          });
          disposers.set(id, () => {
            for (const dispose of apiDisposers.splice(0).reverse()) {
              try { dispose(); } catch (error) { console.error(`Extension ${id} API cleanup failed:`, error); }
            }
            for (const item of registeredStatusItems.values()) {
              const index = statusItems.findIndex((entry) => entry.id === item.id);
              if (index !== -1) statusItems.splice(index, 1);
            }
            setExtensionStatusItems([...statusItems]);
            if (typeof result === "function") (result as () => void)();
            else if (result && typeof (result as { dispose?: unknown }).dispose === "function") (result as { dispose: () => void }).dispose();
          });
        } catch (error) {
          for (const dispose of apiDisposers.splice(0).reverse()) {
            try { dispose(); } catch (cleanupError) { console.error(`Extension ${id} API cleanup failed:`, cleanupError); }
          }
          console.error(`Extension ${id} failed to activate:`, error);
          setExtensionStatus(`${extension.manifest.name} failed to activate; see console`);
        }
      }
      if (!cancelled) setExtensionCommands([...commands]);
    };
    setExtensionCommands([]); setExtensionStatusItems([]); void activate();
    return () => { cancelled = true; for (const dispose of disposers.values()) { try { dispose(); } catch (error) { console.error("Extension cleanup failed:", error); } } };
  }, [extensions, enabledExtensions, activeTabRef, tabsRef, workspaceDirRef, editorRef, setTabs, setExtensionCommands, setExtensionStatusItems, setExtensionStatus, activeDocumentListeners]);
}
