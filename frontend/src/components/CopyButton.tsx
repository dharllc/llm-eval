// frontend/src/components/CopyButton.tsx
import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface CopyButtonProps {
  textToCopy: string;
  className?: string;
}

export const CopyButton: React.FC<CopyButtonProps> = ({ textToCopy, className }) => {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <button
      onClick={copyToClipboard}
      className={`p-1 rounded text-xs transition-colors duration-200 ${className}`}
      title={copied ? "Copied!" : "Copy to clipboard"}
    >
      {copied ? <Check size={16} /> : <Copy size={16} />}
    </button>
  );
};