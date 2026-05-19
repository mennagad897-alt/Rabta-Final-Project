import React, { forwardRef } from "react";
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string; // دي عشان لو فيه إيرور نعرضه تحت الحقل
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, id, error, ...props }, ref) => {
    return (
      <div className="mb-4 text-left">
        <label
          htmlFor={id}
          className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300"
        >
          {label}
        </label>
        <input
          ref={ref}
          id={id}
          // هنا بنضيف شرط بسيط: لو فيه error يخلي البوردر أحمر
          className={`w-full px-4 py-3 bg-[#FAFAFA] dark:bg-[#1f1f1f] border ${
            error ? "border-red-500" : "border-gray-300 dark:border-gray-600"
          } rounded-lg focus:outline-none focus:border-[#7C3AED] dark:focus:border-[#8B5CF6] focus:ring-1 focus:ring-[#7C3AED] dark:focus:ring-[#8B5CF6] transition-all placeholder-gray-400 dark:placeholder-gray-500`}
          {...props}
        />

        {/* 3. عرض رسالة الخطأ لو موجودة */}
        {error && (
          <span className="text-xs text-red-500 mt-1 block">{error}</span>
        )}
      </div>
    );
  },
);

// ضروري عشان TypeScript والـ DevTools
Input.displayName = "Input";
