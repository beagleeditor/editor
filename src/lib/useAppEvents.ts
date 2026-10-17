import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { listen } from "@tauri-apps/api/event";

type Options = {
  openFile: () => void | Promise<void>;
  openFolder: () => void | Promise<void>;
  closeFolder: () => void | Promise<void>;
  saveFile: () => void | Promise<void>;
  openSettings: () => void;
  openAbout: () => void;
  resizingRef: MutableRefObject<boolean>;
  startX: MutableRefObject<number>;
  startWidth: MutableRefObject<number>;
  sidebarWidthRef: MutableRefObject<number>;
  sidebarWidth: number;
  setSidebarWidth: Dispatch<SetStateAction<number>>;
  update: (key: "sidebarWidth", value: number) => void;
  editorInstance: any;
  setQuickOpenVisible: Dispatch<SetStateAction<boolean>>;
  setSidebarVisible: Dispatch<SetStateAction<boolean>>;
  setCommandPaletteVisible: Dispatch<SetStateAction<boolean>>;
  setCommandPaletteQuery: Dispatch<SetStateAction<string>>;
  setBottomPanel: Dispatch<SetStateAction<"problems" | "terminal" | null>>;
  setTerminalPanelCreated: Dispatch<SetStateAction<boolean>>;
};

export function useAppEvents(options: Options) {
  const {
    openFile, openFolder, closeFolder, saveFile, openSettings, openAbout,
    resizingRef, startX, startWidth, sidebarWidthRef, setSidebarWidth, update,
    editorInstance, setQuickOpenVisible, setSidebarVisible, setCommandPaletteVisible,
    setCommandPaletteQuery, setBottomPanel, setTerminalPanelCreated,
  } = options;

  useEffect(() => {
    let cancelled = false;
    const unlisten: Array<() => void> = [];
    const register = async (event: string, handler: () => void | Promise<void>) => {
      const stop = await listen(event, () => { void handler(); });
      if (cancelled) stop();
      else unlisten.push(stop);
    };
    void Promise.all([
      register("menu-open", openFile), register("menu-open-folder", openFolder),
      register("menu-close-folder", closeFolder), register("menu-save", saveFile),
      register("menu-settings", openSettings), register("menu-about", openAbout),
    ]).catch((error) => console.error("Could not register application menu events:", error));
    return () => { cancelled = true; unlisten.forEach((stop) => stop()); };
  }, [openFile, openFolder, closeFolder, saveFile, openSettings, openAbout]);

  useEffect(() => {
    const move = (event: MouseEvent) => {
      if (!resizingRef.current) return;
      const nextWidth = Math.max(180, Math.min(500, startWidth.current + event.clientX - startX.current));
      sidebarWidthRef.current = nextWidth;
      setSidebarWidth(nextWidth);
    };
    const up = () => {
      if (resizingRef.current) update("sidebarWidth", sidebarWidthRef.current);
      resizingRef.current = false;
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
  }, [resizingRef, startX, startWidth, sidebarWidthRef, setSidebarWidth, update]);

  useEffect(() => {
    const container = editorInstance?.getDomNode()?.parentElement;
    if (!editorInstance || !container) return;
    const observer = new ResizeObserver(() => editorInstance.layout());
    observer.observe(container);
    return () => observer.disconnect();
  }, [editorInstance]);

  useEffect(() => {
    let frame = 0;
    const resize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
    };
    window.addEventListener("resize", resize);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("resize", resize); };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "p") {
        event.preventDefault();
        setQuickOpenVisible(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setQuickOpenVisible]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === "b") {
        event.preventDefault(); setSidebarVisible((visible) => !visible); return;
      }
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "p") {
        event.preventDefault();
        setCommandPaletteVisible((visible) => { setCommandPaletteQuery(""); return !visible; });
        setQuickOpenVisible(false);
      }
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "m") {
        event.preventDefault(); setBottomPanel((panel) => panel === "problems" ? null : "problems");
      }
      if (event.ctrlKey && event.key === "`") {
        event.preventDefault(); setTerminalPanelCreated(true);
        setBottomPanel((panel) => panel === "terminal" ? null : "terminal");
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [setSidebarVisible, setCommandPaletteVisible, setCommandPaletteQuery, setQuickOpenVisible, setBottomPanel, setTerminalPanelCreated]);
}
