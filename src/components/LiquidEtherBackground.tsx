import React from "react";
import LiquidEther from "./LiquidEther";

const LiquidEtherBackground: React.FC<{ children?: React.ReactNode }> = ({
  children,
}) => {
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        position: "fixed",
        top: 0,
        left: 0,
        zIndex: -1,
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      <LiquidEther
        colors={['#5227FF', '#FF9FFC', '#B19EEF']}
        mouseForce={20}
        cursorSize={100}
          isViscous={true}
        viscous={30}
        iterationsViscous={32}
        iterationsPoisson={32}
        resolution={0.5}
          isBounce={true}
        autoDemo={true}
        autoSpeed={0.5}
        autoIntensity={2.2}
        takeoverDuration={0.25}
        autoResumeDelay={3000}
        autoRampDuration={0.6}
        style={{
          width: "100%",
          height: "100%",
          pointerEvents: "auto"
        }}
      />
      {children}
    </div>
  );
};

export default LiquidEtherBackground;