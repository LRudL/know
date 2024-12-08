import { createContext, useContext, useState, ReactNode } from "react";

type RenderLevel = "raw" | "debug";

interface RenderLevelContextType {
  level: RenderLevel;
  setLevel: (level: RenderLevel) => void;
}

const RenderLevelContext = createContext<RenderLevelContextType | undefined>(
  undefined
);

export function RenderLevelProvider({ children }: { children: ReactNode }) {
  const [level, setLevel] = useState<RenderLevel>("debug");

  return (
    <RenderLevelContext.Provider value={{ level, setLevel }}>
      {children}
    </RenderLevelContext.Provider>
  );
}

export function useRenderLevel() {
  const context = useContext(RenderLevelContext);
  if (context === undefined) {
    throw new Error("useRenderLevel must be used within a RenderLevelProvider");
  }
  return context;
}

export const RenderLevelSelector = () => {
  const { level, setLevel } = useRenderLevel();

  return (
    <select
      value={level}
      onChange={(e) => setLevel(e.target.value as RenderLevel)}
      className="px-2 py-1 border rounded text-sm"
    >
      <option value="debug">Debug View</option>
      <option value="raw">Raw JSON</option>
    </select>
  );
};
