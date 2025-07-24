import { memo } from "react";
import { ToastContainer } from "./ToastContainer";
import { useToast } from "../contexts/ToastContext";

export const GlobalToastManager = memo(function GlobalToastManager() {
  const { toasts, dismissToast } = useToast();

  return <ToastContainer toasts={toasts} onDismiss={dismissToast} />;
}); 