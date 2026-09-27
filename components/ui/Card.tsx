import { HTMLAttributes } from "react";

export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`bg-white border border-rule shadow-soft ${className}`}
      {...props}
    />
  );
                     }
