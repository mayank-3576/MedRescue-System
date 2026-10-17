import React from 'react';

export interface FilterOption {
  label: string;
  value: string;
}

interface FilterDropdownProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: FilterOption[];
  className?: string;
}

export const FilterDropdown: React.FC<FilterDropdownProps> = ({
  label,
  value,
  onChange,
  options,
  className = '',
}) => {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {label && (
        <span className="text-xs font-medium text-slate-500 whitespace-nowrap">
          {label}:
        </span>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-sm bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-colors shadow-2xs cursor-pointer"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
};

export default FilterDropdown;
