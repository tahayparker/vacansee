import React from "react";
import styles from "./GradientBackground.module.css";

const GradientBackground: React.FC<{ children?: React.ReactNode }> = ({
  children,
}) => {
  return <div className={styles.gradientBg}>{children}</div>;
};

export default GradientBackground;
