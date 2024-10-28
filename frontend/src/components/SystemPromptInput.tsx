// frontend/src/components/SystemPromptInput.tsx
import React, { useState, useEffect } from 'react';
import { TextField, Button, Box, Typography, CircularProgress } from '@mui/material';

interface SystemPromptInputProps {
  onSubmit: (prompt: string) => void;
  disabled: boolean;
  defaultValue?: string;
}

export const SystemPromptInput: React.FC<SystemPromptInputProps> = ({ 
  onSubmit, 
  disabled,
  defaultValue 
}) => {
  const [prompt, setPrompt] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (defaultValue) {
      setPrompt(defaultValue);
    }
  }, [defaultValue]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim() === '') {
      setError('System prompt cannot be empty');
      return;
    }
    
    setError('');
    setIsSubmitting(true);
    try {
      await onSubmit(prompt);
    } catch (err) {
      setError('Failed to submit prompt. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ width: '100%', maxWidth: 600, mx: 'auto', mt: 4 }}>
      <Typography variant="h5" component="h2" gutterBottom>
        Input System Prompt
      </Typography>
      <TextField
        fullWidth
        multiline
        rows={4}
        value={prompt}
        onChange={(e) => {
          setPrompt(e.target.value);
          setError('');
        }}
        error={!!error}
        helperText={error}
        placeholder="Enter your system prompt here..."
        sx={{ mb: 2 }}
        disabled={disabled || isSubmitting}
      />
      <Button
        type="submit"
        variant="contained"
        color="primary"
        disabled={disabled || prompt.trim() === '' || isSubmitting}
        sx={{ position: 'relative' }}
      >
        {isSubmitting ? (
          <>
            Submitting
            <CircularProgress
              size={24}
              sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                marginTop: '-12px',
                marginLeft: '-12px',
              }}
            />
          </>
        ) : (
          'Start Evaluation'
        )}
      </Button>
    </Box>
  );
};