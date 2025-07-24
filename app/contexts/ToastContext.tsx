import { createContext, useContext, useState, useCallback, useMemo } from "react";
// eslint-disable-next-line import/namespace
import type { Toast } from "../components/Toast";

interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => string;
  dismissToast: (id: string) => void;
  clearAllToasts: () => void;
  toast: {
    success: (title: string, message?: string, duration?: number) => string;
    error: (title: string, message?: string, duration?: number) => string;
    warning: (title: string, message?: string, duration?: number) => string;
    info: (title: string, message?: string, duration?: number) => string;
  };
}

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: Toast = { ...toast, id };
    
    setToasts(current => [...current, newToast]);
    
    return id;
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(current => current.filter(toast => toast.id !== id));
  }, []);

  const clearAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  // Memoize convenience methods to prevent re-creation on every render
  const toastMethods = useMemo(() => ({
    success: (title: string, message?: string, duration?: number) =>
      addToast({ type: "success" as const, title, message, duration }),
    
    error: (title: string, message?: string, duration?: number) =>
      addToast({ type: "error" as const, title, message, duration }),
    
    warning: (title: string, message?: string, duration?: number) =>
      addToast({ type: "warning" as const, title, message, duration }),
    
    info: (title: string, message?: string, duration?: number) =>
      addToast({ type: "info" as const, title, message, duration }),
  }), [addToast]);

  // Memoize the entire context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    toasts,
    addToast,
    dismissToast,
    clearAllToasts,
    toast: toastMethods,
  }), [toasts, addToast, dismissToast, clearAllToasts, toastMethods]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
} 