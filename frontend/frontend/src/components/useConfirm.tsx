import { useRef, useState } from "react";
import { Button, Modal } from "./ui";

type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel: string;
  // Red button, for actions that cannot be undone (delete, replace).
  danger?: boolean;
};

// Omnes' own confirmation window, replacing the browser's grey window.confirm: it animates in
// like every other window and uses the app's colors. Usage:
//   const { confirm, confirmDialog } = useConfirm();
//   if (!(await confirm({ title, message, confirmLabel }))) return;
//   ...and render {confirmDialog} once in the component.
export function useConfirm() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolveRef = useRef<((ok: boolean) => void) | null>(null);

  const confirm = (next: ConfirmOptions) =>
    new Promise<boolean>((resolve) => {
      resolveRef.current?.(false);
      resolveRef.current = resolve;
      setOptions(next);
    });

  const close = (ok: boolean) => {
    resolveRef.current?.(ok);
    resolveRef.current = null;
    setOptions(null);
  };

  const confirmDialog = (
    <Modal open={options !== null} onClose={() => close(false)} title={options?.title ?? ""}>
      <p className="text-sm text-ink-soft whitespace-pre-line">{options?.message}</p>
      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <Button variant="secondary" onClick={() => close(false)}>
          Cancelar
        </Button>
        <Button variant={options?.danger ? "danger" : "primary"} onClick={() => close(true)}>
          {options?.confirmLabel ?? "Aceptar"}
        </Button>
      </div>
    </Modal>
  );

  return { confirm, confirmDialog };
}
