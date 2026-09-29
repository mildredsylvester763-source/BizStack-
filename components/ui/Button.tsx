import { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "outline";
};

const VARIANT_STYLES: Record<string, string> = {
  primary: "bg-primary text-white hover:bg-primaryDeep",
  secondary: "bg-surfaceAlt text-text hover:bg-line",
  outline: "border border-line text-text hover:bg-surfaceAlt"
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${VARIANT_STYLES[variant]} ${className}`}
      {...props}
    />
  );
}
