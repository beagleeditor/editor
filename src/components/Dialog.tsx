type DialogProps = {
  title: string;
  message: string;

  confirmText?: string;
  cancelText?: string;

  onConfirm: () => void;
  onCancel: () => void;
};

export default function Dialog({
  title,
  message,
  confirmText = "OK",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
}: DialogProps) {
  console.log("I'm dialog. I'm called now")
  return (
    <div className="dialog-backdrop">
      <div className="dialog">
        <h3>{title}</h3>

        <p>{message}</p>

        <div className="dialog-actions">
          <button onClick={onCancel}>{cancelText}</button>

          <button className="dialog-primary" onClick={onConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
