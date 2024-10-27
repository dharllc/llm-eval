// frontend/src/components/TestCaseDetails.tsx
import React from 'react';
import { Box, Paper, Typography, IconButton } from '@mui/material';
import { CopyButton } from './CopyButton';
import { X } from 'lucide-react';
import { TestCaseDetails as TestCaseDetailsType } from '../types';

interface TestCaseDetailsProps {
  details: TestCaseDetailsType;
  onClose: () => void;
}

export const TestCaseDetails: React.FC<TestCaseDetailsProps> = ({ details, onClose }) => {
  const detailsJson = JSON.stringify(details, null, 2);

  return (
    <Paper 
      elevation={3} 
      sx={{ 
        position: 'absolute',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        width: '90%',
        maxWidth: '500px',
        maxHeight: '80vh',
        overflowY: 'auto',
        bgcolor: 'background.paper',
        zIndex: 1000,
        borderRadius: 2,
        boxShadow: 3,
        p: 2
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Test Case Details</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <CopyButton textToCopy={detailsJson} className="text-gray-500 hover:text-gray-700" />
          <IconButton size="small" onClick={onClose} sx={{ color: 'text.secondary' }}>
            <X size={20} />
          </IconButton>
        </Box>
      </Box>

      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" color="text.secondary">Input:</Typography>
        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{details.input}</Typography>
      </Box>

      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" color="text.secondary">Description:</Typography>
        <Typography variant="body2">{details.description}</Typography>
      </Box>

      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" color="text.secondary">Output:</Typography>
        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{details.output}</Typography>
      </Box>

      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" color="text.secondary">Result:</Typography>
        <Typography 
          variant="body2" 
          sx={{ 
            color: details.result === 'pass' ? 'success.main' : 'error.main',
            fontWeight: 'bold'
          }}
        >
          {details.result.toUpperCase()}
        </Typography>
      </Box>

      <Box>
        <Typography variant="subtitle2" color="text.secondary">Explanation:</Typography>
        <Typography variant="body2">{details.explanation}</Typography>
      </Box>
    </Paper>
  );
};