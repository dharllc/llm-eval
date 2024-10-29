// frontend/src/components/SystemPromptInput.tsx
import React, { useState, useEffect } from 'react';
import { TextField, Button, Box, Typography, CircularProgress, Select, MenuItem, FormControl, InputLabel, ListSubheader } from '@mui/material';
import { ModelConfig } from '../types';

interface SystemPromptInputProps {
  onSubmit: (prompt: string, evaluationModel: string, scoringModel: string) => void;
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
  const [modelConfig, setModelConfig] = useState<ModelConfig | null>(null);
  const [evaluationModel, setEvaluationModel] = useState('');
  const [scoringModel, setScoringModel] = useState('');

  useEffect(() => {
    if (defaultValue) setPrompt(defaultValue);
  }, [defaultValue]);

  useEffect(() => {
    const fetchModelConfig = async () => {
      try {
        const response = await fetch(`http://localhost:${process.env.REACT_APP_BACKEND_PORT}/models`);
        if (!response.ok) throw new Error('Failed to fetch model configuration');
        const config = await response.json();
        setModelConfig(config);
        setEvaluationModel(config.default.evaluation_model);
        setScoringModel(config.default.scoring_model);
      } catch (err) {
        setError('Failed to load model configuration');
        console.error('Error fetching model config:', err);
      }
    };
    fetchModelConfig();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim() === '') {
      setError('System prompt cannot be empty');
      return;
    }
    
    setError('');
    setIsSubmitting(true);
    try {
      await onSubmit(prompt, evaluationModel, scoringModel);
    } catch (err) {
      setError('Failed to submit prompt. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderModelMenuItems = () => {
    if (!modelConfig) return null;

    return Object.entries(modelConfig.models).map(([provider, models]) => [
      <ListSubheader key={provider}>{provider}</ListSubheader>,
      ...Object.keys(models).map(model => (
        <MenuItem key={model} value={model} sx={{ pl: 4 }}>
          {model} {model === modelConfig.default.evaluation_model && '(default)'}
        </MenuItem>
      ))
    ]);
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ width: '100%', maxWidth: 600, mx: 'auto', mt: 4 }}>
      <Typography variant="h5" component="h2" gutterBottom>
        Input System Prompt
      </Typography>
      
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <FormControl fullWidth>
          <InputLabel>Evaluation Model</InputLabel>
          <Select
            value={evaluationModel}
            onChange={(e) => setEvaluationModel(e.target.value)}
            label="Evaluation Model"
            disabled={disabled || isSubmitting}
          >
            {renderModelMenuItems()}
          </Select>
        </FormControl>
        
        <FormControl fullWidth>
          <InputLabel>Scoring Model</InputLabel>
          <Select
            value={scoringModel}
            onChange={(e) => setScoringModel(e.target.value)}
            label="Scoring Model"
            disabled={disabled || isSubmitting}
          >
            {renderModelMenuItems()}
          </Select>
        </FormControl>
      </Box>

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
        disabled={disabled || prompt.trim() === '' || isSubmitting || !modelConfig}
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