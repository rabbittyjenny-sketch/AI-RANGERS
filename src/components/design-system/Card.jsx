import React from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

export const Card = React.forwardRef(({
  variant = 'default',
  interactive = false,
  className,
  children,
  ...props
}, ref) => {
  const variants = {
    default: 'bg-white border border-gray-200 rounded-2xl shadow-sm',
    elevated: 'bg-white border border-gray-100 rounded-2xl shadow-lg',
    outlined: 'bg-white border-2 border-black rounded-2xl',
    flat: 'bg-gray-50 rounded-2xl border border-gray-200',
  };

  const baseClasses = clsx(
    'p-6 transition-all duration-300',
    variants[variant],
    interactive && 'cursor-pointer hover:shadow-xl hover:border-[#5E9BEB]',
    className
  );

  const content = (
    <div className={baseClasses} {...props}>
      {children}
    </div>
  );

  if (interactive) {
    return (
      <motion.div
        ref={ref}
        whileHover={{ y: -4, boxShadow: '0 12px 24px rgba(0, 0, 0, 0.1)' }}
        whileTap={{ y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {content}
      </motion.div>
    );
  }

  return <div ref={ref}>{content}</div>;
});

Card.displayName = 'Card';
export default Card;
