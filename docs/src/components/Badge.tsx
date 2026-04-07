import type { JSX } from "solid-js";
import styles from "./Badge.module.css";

export type BadgeColor = "green" | "blue" | "purple" | "orange";

interface Props {
  color: BadgeColor;
  pill?: boolean;
  icon?: string;
  children: JSX.Element;
}

export default function Badge(props: Props) {
  return (
    <span class={`${styles.badge} ${styles[props.color]} ${props.pill ? styles.pill : ""}`}>
      {props.icon && <i class={`${props.icon} inline-block`} />}
      {props.children}
    </span>
  );
}

export function LayerBadge(props: { color: BadgeColor; pill?: boolean; children: JSX.Element }) {
  return (
    <Badge color={props.color} pill={props.pill} icon="i-ph:stack">
      {props.children}
    </Badge>
  );
}

export function ScopeBadge(props: { color?: BadgeColor; children: JSX.Element }) {
  return (
    <Badge color={props.color ?? "green"} icon="i-ph:target">
      {props.children}
    </Badge>
  );
}
