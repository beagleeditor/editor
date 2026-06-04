type Props = {
  onOpen: () => void;
  onNewFile: () => void;
  onOpenFolder: () => void;
};

export default function WelcomeScreen({ onOpen, onNewFile, onOpenFolder }: Props) {
  return (
    <div className="welcome">
      <h1>🐾 BeagleEditor</h1>

      <p>A "beagleful" editor</p>

      <div className="welcome-actions">
        <button className="newfile" onClick={onNewFile}>New File</button>
        <button className="openfile" onClick={onOpen}>Open File</button>
        <button className="openfolder" onClick={onOpenFolder}>Open Folder</button>
      </div>
    </div>
  );
}
