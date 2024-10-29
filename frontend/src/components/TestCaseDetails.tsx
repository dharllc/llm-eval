import React from 'react';
import { Box, Typography, Paper, IconButton } from '@mui/material';
import { Bot, X, ClipboardCheck } from 'lucide-react';
import { CopyButton } from './CopyButton';
import { TestCaseDetails as TestCaseDetailsType } from '../types';

interface TestCaseDetailsProps {
  details: TestCaseDetailsType;
  onClose: () => void;
}

export const TestCaseDetails: React.FC<TestCaseDetailsProps> = ({ details, onClose }) => {
  const detailsJson = JSON.stringify(details, null, 2);

  return (
    <Paper elevation={3} sx={{ 
      position: 'absolute',
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)',
      width: '90%',
      maxWidth: '600px',
      maxHeight: '90vh',
      overflowY: 'auto',
      bgcolor: 'background.paper',
      borderRadius: 2,
      p: 3
    }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h6">Test Case Details</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <CopyButton textToCopy={detailsJson} />
          <IconButton size="small" onClick={onClose}>
            <X size={20} />
          </IconButton>
        </Box>
      </Box>

      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="subtitle2" color="text.secondary">
            Input:
          </Typography>
        </Box>
        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
          {details.input}
        </Typography>
      </Box>

      <Box sx={{ 
        mb: 3, 
        p: 2, 
        bgcolor: 'grey.50', 
        borderRadius: 1,
        border: '1px solid',
        borderColor: 'grey.200'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Bot size={16} />
            <Typography variant="subtitle2" color="text.secondary">
              Model Output
            </Typography>
          </Box>
          {details.input_model && (
            <Typography variant="caption" sx={{ 
              color: 'primary.main',
              bgcolor: 'primary.50',
              px: 1,
              py: 0.5,
              borderRadius: 1
            }}>
              {details.input_model}
            </Typography>
          )}
        </Box>
        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
          {details.output}
        </Typography>
      </Box>

      <Box sx={{ 
        p: 2, 
        bgcolor: details.result === 'pass' ? 'success.50' : 'error.50',
        borderRadius: 1,
        mb: 3
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ClipboardCheck size={16} />
            <Typography
              variant="subtitle1"
              sx={{
                color: details.result === 'pass' ? 'success.main' : 'error.main',
                fontWeight: 600
              }}
            >
              {details.result.toUpperCase()}
            </Typography>
          </Box>
          {details.output_model && (
            <Typography variant="caption" sx={{ 
              color: 'primary.main',
              bgcolor: 'primary.50',
              px: 1,
              py: 0.5,
              borderRadius: 1
            }}>
              {details.output_model}
            </Typography>
          )}
        </Box>
        <Typography variant="body2">{details.explanation}</Typography>
      </Box>

      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Description:
        </Typography>
        <Typography variant="body2">{details.description}</Typography>
      </Box>
    </Paper>
  );
};

export default TestCaseDetails;