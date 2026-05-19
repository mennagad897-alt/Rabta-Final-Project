import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
}

export const Button = ({ children, variant = 'primary', ...props }: ButtonProps) => {
  const baseStyle = "px-4 py-2 rounded font-semibold transition-colors duration-200";
  const styles = variant === 'primary' 
    ? "bg-blue-600 text-white hover:bg-blue-700" 
    : "bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-white";

  return (
    <button className={`${baseStyle} ${styles}`} {...props}>
      {children}
    </button>
  );
};
