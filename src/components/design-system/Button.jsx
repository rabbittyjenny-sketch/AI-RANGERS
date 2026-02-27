import React from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

export const Button = React.forwardRef(({
  variant = 'primary',
  size = 'md',
  disabled = false,
  isLoading = false,
  children,
  className,
  ...props
}, ref) => {
  const baseClasses = 'font-semibold transition-all duration-300 inline-flex items-center justify-center gap-2 rounded-lg font-sarabun';

  const variants = {
    primary: 'bg-[#5E9BEB] text-white hover:bg-[#4A7BC9] shadow-lg hover:shadow-xl',
    secondary: 'bg-white border-2 border-black text-black hover:bg-gray-50 shadow-md',
    ghost: 'bg-transparent text-gray-700 hover:bg-gray-100',
    danger: 'bg-red-500 text-white hover:bg-red-600 shadow-lg',
    success: 'bg-green-500 text-white hover:bg-green-600 shadow-lg',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2.5 text-base',
    lg: 'px-6 py-3 text-lg',
    xl: 'px-8 py-4 text-xl',
  };

  const combinedClasses = clsx(
    baseClasses,
    variants[variant],
    sizes[size],
    disabled && 'opacity-50 cursor-not-allowed',
    className
  );

  return (
    <motion.button
      ref={ref}
      className={combinedClasses}
      disabled={disabled || isLoading}
      whileHover={!disabled ? { scale: 1.02 } : {}}
      whileTap={!disabled ? { scale: 0.98 } : {}}
      {...props}
    >
      {isLoading ? (
        <>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="w-4 h-4 border-2 border-current border-t-transparent rounded-full"
          />
          {children}
        </>
      ) : (
        children
      )}
    </motion.button>
  );
});

Button.displayName = 'Button';
export default Button;
