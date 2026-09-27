import { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "outline";
};

const VARIANT_STYLES: Record<string, string> = {
  primary: "bg-ink text-mist hover:bg-vaultDeep",
  secondary: "bg-vault text-mist hover:bg-vaultDeep",
  outline: "border border-rule text-ink hover:bg-mist"
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`px-5 py-2.5 text-sm font-medium transition-colors disabled:opacity-50 ${VARIANT_STYLES[variant]} ${className}`}
      {...props}
    />
  );
                       }
