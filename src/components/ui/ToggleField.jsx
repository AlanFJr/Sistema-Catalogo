import React from 'react';
import { Eye, EyeOff } from 'lucide-react';

const ToggleField = ({ label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`flex items-center justify-between w-full p-2 text-xs rounded border transition-all ${
      active
        ? 'bg-blue-50 border-blue-200 text-blue-700'
        : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
    }`}
    type="button"
  >
    <span className="font-medium">{label}</span>
    {active ? <Eye size={14} /> : <EyeOff size={14} />}
  </button>
);

export default React.memo(ToggleField);
