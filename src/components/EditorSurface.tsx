import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import * as monaco from "monaco-editor";
import { Editor } from "@monaco-editor/react";
import About from "./About";
import WelcomeScreen from "./WelcomeScreen";
import type { Tab } from "./EditorTabs";
import type { useSettings } from "../lib/useSettings";
import { editorOptions } from "../lib/settings";
import { attachModelSync } from "../lib/lsp";
import { ensureLanguageProviders } from "../lib/lspProviders";

type Settings = ReturnType<typeof useSettings>["settings"];
type Props = {
  showAbout: boolean; setShowAbout: Dispatch<SetStateAction<boolean>>;
  activeTab: Tab | undefined; isMarkdown: boolean; previewMode: "edit" | "preview" | "split";
  activeModelUri: string | null; editorTheme: string; settings: Settings;
  editorRef: MutableRefObject<any>; previewRef: MutableRefObject<HTMLDivElement | null>;
  setEditorInstance: Dispatch<SetStateAction<any>>;
  syncEditorScroll: (editor: any) => void; syncPreviewScroll: () => void;
  addFormatAction: (editor: any, monacoInstance: typeof monaco) => void;
  syncActiveModel: () => monaco.editor.ITextModel | null; updateContent: (value?: string) => void;
  openFile: () => Promise<void>; newFile: () => void; openFolder: () => Promise<void>;
  recentFolders: string[]; openRecentFolder: (dir: string) => void;
};

export default function EditorSurface(props: Props) {
  const { showAbout, setShowAbout, activeTab, isMarkdown, previewMode, activeModelUri, editorTheme, settings,
    editorRef, previewRef, setEditorInstance, syncEditorScroll, syncPreviewScroll,
    addFormatAction, syncActiveModel, updateContent, openFile, newFile, openFolder, recentFolders, openRecentFolder } = props;
  return (
    <>
            {showAbout ? (
              <About onBack={() => setShowAbout(false)} />
            ) : !activeTab ? (
              <WelcomeScreen
                onOpen={openFile}
                onNewFile={newFile}
                onOpenFolder={openFolder}
                recentFolders={recentFolders}
                onOpenRecentFolder={openRecentFolder}
              />
            ) : isMarkdown && previewMode !== "edit" ? (
              <div
                className="markdown-split"
                style={{ display: "flex", height: "100%" }}
              >
                {isMarkdown &&
                  (previewMode === "preview" || previewMode === "split") && (
                    <div style={{ flex: 1 }}>
                      <Editor
                        className="editor-host"
                        path={activeModelUri ?? undefined}
                        saveViewState={true}
                        keepCurrentModel={true}
                        defaultLanguage={activeTab?.language ?? "plaintext"}
                        defaultValue={activeTab?.content ?? ""}
                        onChange={updateContent}
                        onMount={(editor, monaco) => {
                          editorRef.current = editor;
                          setEditorInstance(editor);
                          addFormatAction(editor, monaco);
                          registerQuickFixAction(editor, monaco);
                          if (activeTab?.language) {
                            ensureLanguageProviders(monaco, activeTab.language);
                          }
                          const model = syncActiveModel();
                          if (model && editor.getModel() !== model) {
                            editor.setModel(model);
                          }
                          editor.onDidChangeModel(() => {
                            const m = editor.getModel();
                            if (m) {
                              ensureLanguageProviders(monaco, m.getLanguageId());
                              void attachModelSync(m, m.getLanguageId());
                            }
                          });

                          editor.onDidScrollChange(() => {
                            syncEditorScroll(editor);
                          });
                        }}
                        theme={editorTheme}
                        options={{
                          automaticLayout: true,
                          ...editorOptions(settings),
                          scrollBeyondLastLine: false,
                        }}
                      />
                    </div>
                  )}

                {(previewMode === "split" || previewMode === "preview") && (
                  <div
                    ref={previewRef}
                    onScroll={syncPreviewScroll}
                    style={{ flex: 1, padding: 16, overflow: "auto" }}
                  >
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {activeTab?.content ?? ""}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            ) : (
              <Editor
                className="editor-host"
                path={activeModelUri ?? undefined}
                saveViewState={true}
                keepCurrentModel={true}
                defaultLanguage={activeTab?.language ?? "plaintext"}
                defaultValue={activeTab?.content ?? ""}
                onChange={updateContent}
                onMount={(editor, monaco) => {
                  editorRef.current = editor;
                  setEditorInstance(editor);
                  addFormatAction(editor, monaco);
                  registerQuickFixAction(editor, monaco);
                  if (activeTab?.language) {
                    ensureLanguageProviders(monaco, activeTab.language);
                  }
                  const model = syncActiveModel();
                  if (model && editor.getModel() !== model) {
                    editor.setModel(model);
                  }
                  editor.onDidChangeModel(() => {
                    const m = editor.getModel();
                    if (m) {
                      ensureLanguageProviders(monaco, m.getLanguageId());
                      void attachModelSync(m, m.getLanguageId());
                    }
                  });

                  const KM = monaco.KeyMod;
                  const KC = monaco.KeyCode;

                  // -------------------------
                  // COPY (Ctrl/Cmd + C)
                  // -------------------------
                  editor.addCommand(KM.CtrlCmd | KC.KeyC, async () => {
                    const selection =
                      editor.getSelection() ||
                      editor.getModel()?.getFullModelRange();
                    const model = editor.getModel();

                    if (!selection || !model) return;

                    const text = model.getValueInRange(selection);

                    try {
                      await navigator.clipboard.writeText(text);
                    } catch {
                      const textarea = document.createElement("textarea");
                      textarea.value = text;
                      textarea.style.position = "fixed";
                      textarea.style.opacity = "0";
                      document.body.appendChild(textarea);
                      textarea.select();
                      document.execCommand("copy");
                      textarea.remove();
                    }
                  });

                  // -------------------------
                  // PASTE (Ctrl/Cmd + V)
                  // -------------------------
                  editor.addCommand(KM.CtrlCmd | KC.KeyV, async () => {
                    let text = "";

                    try {
                      text = await navigator.clipboard.readText();
                    } catch {
                      return;
                    }

                    editor.executeEdits("clipboard", [
                      {
                        range: editor.getSelection()!,
                        text,
                        forceMoveMarkers: true,
                      },
                    ]);
                  });

                  // -------------------------
                  // CUT (Ctrl/Cmd + X)
                  // -------------------------
                  editor.addCommand(KM.CtrlCmd | KC.KeyX, async () => {
                    const selection = editor.getSelection();
                    const model = editor.getModel();

                    if (!selection || !model) return;

                    const text = model.getValueInRange(selection);

                    try {
                      await navigator.clipboard.writeText(text);
                    } catch {
                      const textarea = document.createElement("textarea");
                      textarea.value = text;
                      textarea.style.position = "fixed";
                      textarea.style.opacity = "0";
                      document.body.appendChild(textarea);
                      textarea.select();
                      document.execCommand("copy");
                      textarea.remove();
                    }

                    editor.executeEdits("cut", [
                      {
                        range: selection,
                        text: "",
                        forceMoveMarkers: true,
                      },
                    ]);
                  });
                }}
                theme={editorTheme}
                options={{
                  automaticLayout: true,
                  ...editorOptions(settings),
                  scrollBeyondLastLine: false,
                  tabCompletion: "on",
                  contextmenu: true,
                  copyWithSyntaxHighlighting: true,
                }}
              />
            )}
    </>
  );
}

function registerQuickFixAction(editor: any, monacoInstance: typeof monaco) {
  editor.addAction({
    id: "beagle.quickFix",
    label: "Quick Fix…",
    keybindings: [monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.Period],
    contextMenuGroupId: "navigation",
    run: () => editor.trigger("keyboard", "editor.action.quickFix", {}),
  });
}
