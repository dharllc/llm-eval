import React, { useState } from 'react';
import { TextField, Button, Box, Typography } from '@mui/material';

interface SystemPromptInputProps {
  onSubmit: (prompt: string) => void;
}

const SystemPromptInput: React.FC<SystemPromptInputProps> = ({ onSubmit }) => {
  const [prompt, setPrompt] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim() === '') {
      setError('System prompt cannot be empty');
    } else {
      setError('');
      onSubmit(prompt);
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
        onChange={(e) => setPrompt(e.target.value)}
        error={!!error}
        helperText={error}
        placeholder="Enter your system prompt here..."
        sx={{ mb: 2 }}
      />
      <Button
        type="submit"
        variant="contained"
        color="primary"
        disabled={prompt.trim() === ''}
      >
        Start Evaluation
      </Button>
    </Box>
  );
};

export default SystemPromptInput;