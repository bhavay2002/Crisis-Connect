import { createContext, useContext, useState, useEffect } from "react";

interface LowBandwidthContextType {
  isLowBandwidth: boolean;
  toggle: () => void;
  showMaps: boolean;
  showImages: boolean;
  showVideos: boolean;
}

const LowBandwidthContext = createContext<LowBandwidthContextType>({
  isLowBandwidth: false,
  toggle: () => {},
  showMaps: true,
  showImages: true,
  showVideos: true,
});

export function LowBandwidthProvider({ children }: { children: React.ReactNode }) {
  const [isLowBandwidth, setIsLowBandwidth] = useState(() => {
    return localStorage.getItem("lowBandwidth") === "true";
  });

  useEffect(() => {
    localStorage.setItem("lowBandwidth", String(isLowBandwidth));
  }, [isLowBandwidth]);

  const toggle = () => setIsLowBandwidth(prev => !prev);

  return (
    <LowBandwidthContext.Provider
      value={{
        isLowBandwidth,
        toggle,
        showMaps: !isLowBandwidth,
        showImages: !isLowBandwidth,
        showVideos: !isLowBandwidth,
      }}
    >
      {children}
    </LowBandwidthContext.Provider>
  );
}

export function useLowBandwidth() {
  return useContext(LowBandwidthContext);
}
