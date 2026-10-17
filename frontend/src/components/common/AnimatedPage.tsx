import React, { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

interface AnimatedPageProps {
  children: ReactNode;
  className?: string;
}

export const AnimatedPage: React.FC<AnimatedPageProps> = ({ children, className = '' }) => {
  const shouldReduceMotion = useReducedMotion();

  const pageVariants = {
    initial: {
      opacity: 0,
      y: shouldReduceMotion ? 0 : 8,
    },
    animate: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.3,
        ease: 'easeOut',
      },
    },
    exit: {
      opacity: 0,
      y: shouldReduceMotion ? 0 : -8,
      transition: {
        duration: 0.2,
      },
    },
  };

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className={`w-full max-w-7xl mx-auto ${className}`}
    >
      {children}
    </motion.div>
  );
};

export default AnimatedPage;
