import { invoke } from "@tauri-apps/api/core";
import { registerProviders } from "./lsp";

function registerHoverProvider(
  monaco: typeof import("monaco-editor"),
  language: string,
) {
  monaco.languages.registerHoverProvider(language, {
    async provideHover(model, position) {
      try {
        const response = await invoke<any>("lsp_hover", {
          path: model.uri.fsPath,
          line: position.lineNumber - 1,
          character: position.column - 1,
        });

        const result = response.result;

        if (!result || !result.contents) {
          return null;
        }

        const contents = Array.isArray(result.contents)
          ? result.contents
          : [result.contents];

        return {
          contents: contents.map((item: any) => {
            if (typeof item === "string") {
              return { value: item };
            }

            if (item.language && item.value) {
              return {
                value: `\`\`\`${item.language}\n${item.value}\n\`\`\``,
              };
            }

            return {
              value: item.value ?? "",
            };
          }),
        };
      } catch (error) {
        console.error("LSP hover failed:", error);
        return null;
      }
    },
  });
}

function registerDefinitionProvider(
  monaco: typeof import("monaco-editor"),
  language: string,
) {
  monaco.languages.registerDefinitionProvider(language, {
    async provideDefinition(model, position) {
      try {
        const response = await invoke<any>("lsp_definition", {
          path: model.uri.fsPath,
          line: position.lineNumber - 1,
          character: position.column - 1,
        });

        const result = response.result;

        if (!result) {
          return null;
        }

        const locations = Array.isArray(result) ? result : [result];

        return locations.map((location: any) => ({
          uri: monaco.Uri.parse(location.uri),
          range: {
            startLineNumber: location.range.start.line + 1,
            startColumn: location.range.start.character + 1,
            endLineNumber: location.range.end.line + 1,
            endColumn: location.range.end.character + 1,
          },
        }));
      } catch (error) {
        console.error("LSP definition failed:", error);
        return null;
      }
    },
  });
}

function registerSignatureHelpProvider(
  monaco: typeof import("monaco-editor"),
  language: string,
) {
  monaco.languages.registerSignatureHelpProvider(language, {
    signatureHelpTriggerCharacters: ["(", ","],

    async provideSignatureHelp(model, position) {
      try {
        const response = await invoke<any>("lsp_signature_help", {
          path: model.uri.fsPath,
          line: position.lineNumber - 1,
          character: position.column - 1,
        });

        console.log("Signature help response:", response);

        const result = response.result;

        if (!result || !result.signatures?.length) {
          return null;
        }

        return {
          value: {
            signatures: result.signatures.map((signature: any) => ({
              label: signature.label,
              documentation: signature.documentation,
              parameters: signature.parameters ?? [],
            })),
            activeSignature: result.activeSignature ?? 0,
            activeParameter: result.activeParameter ?? 0,
          },
          dispose() {},
        };
      } catch (error) {
        console.error("LSP signature help failed:", error);
        return null;
      }
    },
  });
}

const registeredLspLanguages = new Set<string>();

export function ensureLanguageProviders(monacoInstance: typeof import("monaco-editor"), language: string) {
  if (!language || language === "plaintext" || registeredLspLanguages.has(language)) return;
  registeredLspLanguages.add(language);
  registerProviders(monacoInstance, language);
  registerHoverProvider(monacoInstance, language);
  registerDefinitionProvider(monacoInstance, language);
  registerSignatureHelpProvider(monacoInstance, language);
}
