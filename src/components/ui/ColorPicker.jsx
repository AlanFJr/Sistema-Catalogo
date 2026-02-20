import React from 'react';

const ColorPicker = ({ label, value, onChange }) => (
  <div>
    <label className="text-[10px] text-gray-500 font-semibold mb-1 block uppercase">{label}</label>
    <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded border border-gray-100">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-6 w-8 rounded cursor-pointer border-0 p-0 bg-transparent"
      />
      <span className="text-[10px] font-mono text-gray-500 flex-1">{value}</span>
    </div>
  </div>
);

export default React.memo(ColorPicker);
