import React from 'react';

const Button = ({ children, onClick, isActive }) => {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full transition-all duration-200 ease-in-out border-2 hover:border-[#006D5B] ${
        isActive ? 'border-[#006D5B] text-[#006D5B]' : 'border-[#482f1f] text-white'
      } hover:shadow-lg hover:shadow-[#006D5B]/50`}
    >
      <span className="text-sm font-semibold">{children}</span>
    </button>
  );
};

export default Button; 