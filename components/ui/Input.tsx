import { InputHTMLAttributes, forwardRef } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, className = "", id, ...props }, ref) => {
    return (
      <div>
        {label && (
          <label htmlFor={id} className="block text-sm text-ink/70 mb-1.5">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={`w-full border border-rule px-4 py-2.5 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-vault/25 focus:border-vault transition-shadow ${className}`}
          {...props}
        />
      </div>
    );
  }
);
Input.displayName = "Input";
