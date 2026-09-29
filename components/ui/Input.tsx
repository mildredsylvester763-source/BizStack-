import { InputHTMLAttributes, forwardRef } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, className = "", id, ...props }, ref) => {
    return (
      <div>
        {label && (
          <label htmlFor={id} className="block text-sm text-textMuted mb-1.5">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={`w-full rounded-lg border border-line px-4 py-2.5 bg-surface text-sm text-text placeholder:text-textMuted/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-shadow ${className}`}
          {...props}
        />
      </div>
    );
  }
);
Input.displayName = "Input";
