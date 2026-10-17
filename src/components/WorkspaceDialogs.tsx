import type { Dispatch, SetStateAction } from "react";
import type { Tab } from "./EditorTabs";
import Dialog from "./Dialog";

type Props = {
  tabToClose: Tab | null;
  setTabToClose: Dispatch<SetStateAction<Tab | null>>;
  closeTab: (id: string) => void;
  renameTarget: string | null;
  setRenameTarget: Dispatch<SetStateAction<string | null>>;
  renamePath: string;
  setRenamePath: Dispatch<SetStateAction<string>>;
  renameError: string | null;
  setRenameError: Dispatch<SetStateAction<string | null>>;
  renameItem: () => void | Promise<void>;
  deleteTarget: string | null;
  setDeleteTarget: Dispatch<SetStateAction<string | null>>;
  deleteError: string | null;
  setDeleteError: Dispatch<SetStateAction<string | null>>;
  deleteItem: () => void | Promise<void>;
  saveError: string | null;
  setSaveError: Dispatch<SetStateAction<string | null>>;
};

export default function WorkspaceDialogs({
  tabToClose, setTabToClose, closeTab, renameTarget, setRenameTarget, renamePath,
  setRenamePath, renameError, setRenameError, renameItem, deleteTarget, setDeleteTarget,
  deleteError, setDeleteError, deleteItem, saveError, setSaveError,
}: Props) {
  return (
    <>
      {tabToClose && <Dialog
        title="You didn't save the file"
        message="Are you sure you wanna close the tab?"
        onCancel={() => setTabToClose(null)}
        onConfirm={() => { if (tabToClose) closeTab(tabToClose.id); setTabToClose(null); }}
      />}
      {renameTarget && <Dialog
        title="Rename"
        message={<>
          <input
            autoFocus
            value={renamePath}
            onChange={(event) => { setRenamePath(event.target.value); setRenameError(null); }}
            onKeyDown={(event) => { if (event.key === "Enter") void renameItem(); }}
            style={{ width: "100%" }}
          />
          {renameError && <p role="alert" className="dialog-error">{renameError}</p>}
        </>}
        onCancel={() => { setRenameTarget(null); setRenamePath(""); setRenameError(null); }}
        onConfirm={renameItem}
      />}
      {deleteTarget && <Dialog
        title="Delete"
        message={<>
          <p>Delete {deleteTarget.split(/[/\\]/).pop()}?</p>
          {deleteError && <p role="alert" className="dialog-error">{deleteError}</p>}
        </>}
        onCancel={() => { setDeleteTarget(null); setDeleteError(null); }}
        onConfirm={deleteItem}
      />}
      {saveError && <Dialog
        title="File operation notice"
        message={saveError}
        onCancel={() => setSaveError(null)}
        onConfirm={() => setSaveError(null)}
        confirmText="OK"
        cancelText="Close"
      />}
    </>
  );
}
