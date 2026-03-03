import { useState, useCallback, createContext, useContext, type ReactNode } from "react";

interface ToastMessage {
  id: number;
  text: string;
  type: "success" | "error" | "info";
}

interface ToastContextValue {
  toast: (text: string, type?: ToastMessage["type"]) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ToastMessage[]>([]);
  let nextId = 0;

  const toast = useCallback((text: string, type: ToastMessage["type"] = "info") => {
    const id = nextId++;
    setMessages((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setMessages((prev) => prev.filter((m) => m.id !== id));
    }, 4000);
  }, []);

  const colors = {
    success: "bg-green-600",
    error: "bg-red-600",
    info: "bg-shark",
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg ${colors[msg.type]} animate-[slideIn_0.2s_ease-out]`}
          >
            {msg.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
