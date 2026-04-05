import type { JSX } from "solid-js";
import styles from "./Badge.module.css";

export type BadgeColor = "green" | "blue" | "purple" | "orange";

interface Props {
  color: BadgeColor;
  pill?: boolean;
  children: JSX.Element;
}

export default function Badge(props: Props) {
  return (
    <span class={`${styles.badge} ${styles[props.color]} ${props.pill ? styles.pill : ""}`}>
      {props.children}
    </span>
  );
}
