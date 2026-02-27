import React from 'react';
import clsx from 'clsx';

export const Input = React.forwardRef(({
  type = 'text',
  size = 'md',
  disabled = false,
  error = false,
  label,
  helperText,
  placeholder,
  className,
  ...props
}, ref) => {
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2.5 text-base',
    lg: 'px-5 py-3 text-lg',
  };

  const inputClasses = clsx(
    'w-full rounded-lg border-2 transition-colors duration-200 font-sarabun',
    'focus:outline-none focus:ring-2 focus:ring-[#5E9BEB] focus:border-[#5E9BEB]',
    error ? 'border-red-500 focus:ring-red-500' : 'border-gray-300',
    disabled && 'bg-gray-100 cursor-not-allowed opacity-60',
    sizes[size],
    className
  );

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-semibold text-gray-700 mb-2 font-sarabun">
          {label}
        </label>
      )}
      <input
        ref={ref}
        type={type}
        disabled={disabled}
        placeholder={placeholder}
        className={inputClasses}
        {...props}
      />
      {helperText && (
        <p className={clsx(
          'text-xs mt-2 font-sarabun',
          error ? 'text-red-500' : 'text-gray-500'
        )}>
          {helperText}
        </p>
      )}
    </div>
  );
});

Input.displayName = 'Input';
export default Input;
