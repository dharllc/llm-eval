import React, { useState, useEffect, useCallback } from 'react';
import { ThemeProvider, createTheme, CssBaseline, Container, Typography, Paper, Grid, Box, LinearProgress } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import SystemPromptInput from './components/SystemPromptInput';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
  },
});

function App() {
  const [evaluationStarted, setEvaluationStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [backendPort, setBackendPort] = useState<number | null>(null);
  const [progress, setProgress] = useState<{ [key: string]: { total: number; processed: number } }>({});
  const [totalProgress, setTotalProgress] = useState<string>('0/25');
  const [ws, setWs] = useState<WebSocket | null>(null);

  const criteriaDisplayNames: { [key: string]: string } = {
    "retaining_key_information": "Retaining Key Information",
    "removing_filler_text": "Removing Filler Text",
    "improving_readability": "Improving Readability",
    "maintaining_original_tone": "Maintaining the Original Tone",
    "avoiding_misinterpretation": "Avoiding Misinterpretation of Statements as Commands"
  };

  useEffect(() => {
    // Initialize progress with 5 total and 0 processed for each criterion
    const initialProgress = Object.keys(criteriaDisplayNames).reduce((acc, key) => {
      acc[key] = { total: 5, processed: 0 };
      return acc;
    }, {} as { [key: string]: { total: number; processed: number } });
    setProgress(initialProgress);

    fetch(`http://localhost:${process.env.REACT_APP_BACKEND_PORT}/config`)
      .then(response => response.json())
      .then(data => {
        setBackendPort(data.backendPort);
        const socket = new WebSocket(`ws://localhost:${data.backendPort}/ws`);
        setWs(socket);

        socket.onopen = () => {
          console.log('WebSocket connected');
        };

        socket.onmessage = (event) => {
          console.log('Received WebSocket message:', event.data);
          try {
            const data = JSON.parse(event.data);
            console.log('Parsed WebSocket data:', data);
            if (data.total_progress) {
              console.log('Updating progress:', data);
              setTotalProgress(data.total_progress);
              setProgress(prevProgress => {
                const newProgress = { ...prevProgress };
                Object.keys(data.criteria_progress).forEach(criterion => {
                  newProgress[criterion] = {
                    ...newProgress[criterion],
                    processed: data.criteria_progress[criterion].processed
                  };
                });
                return newProgress;
              });
            } else if (data.status === 'completed') {
              setIsLoading(false);
              setEvaluationStarted(false);
            } else if (data.status === 'error') {
              setError(data.message);
              setIsLoading(false);
              setEvaluationStarted(false);
            }
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        socket.onerror = (error) => {
          console.error('WebSocket error:', error);
          setError('WebSocket connection error');
        };

        return () => {
          socket.close();
        };
      })
      .catch(error => {
        console.error('Error loading configuration:', error);
        setError('Failed to load configuration. Please check if the backend is running.');
      });
  }, []);

  const handleSystemPromptSubmit = useCallback(async (prompt: string) => {
    if (!backendPort) {
      setError('Backend port not configured. Please check your setup.');
      return;
    }

    console.log('System prompt submitted:', prompt);
    setEvaluationStarted(true);
    setIsLoading(true);
    setError(null);
    setProgress(prevProgress => {
      const resetProgress = { ...prevProgress };
      Object.keys(resetProgress).forEach(key => {
        resetProgress[key] = { ...resetProgress[key], processed: 0 };
      });
      return resetProgress;
    });
    setTotalProgress('0/25');
  
    try {
      console.log('Sending request to backend...');
      const response = await fetch(`http://localhost:${backendPort}/evaluate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ prompt }),
      });
  
      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);
  
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Response not OK. Error:', errorText);
        throw new Error(`Evaluation failed: ${errorText}`);
      }
  
      const data = await response.json();
      console.log('Evaluation completed:', data);
    } catch (error) {
      console.error('Error during evaluation:', error);
      setError(`An error occurred during evaluation: ${error instanceof Error ? error.message : String(error)}`);
      setIsLoading(false);
      setEvaluationStarted(false);
    }
  }, [backendPort]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container maxWidth="lg">
        <Typography variant="h4" component="h1" gutterBottom sx={{ mt: 4, mb: 4 }}>
          LLM Evaluation Tool
        </Typography>
        
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Language Model
              </Typography>
              <Typography variant="body1">
                Current model: GPT-4o-mini (default)
              </Typography>
            </Paper>
            
            <Paper elevation={3} sx={{ p: 3 }}>
              <SystemPromptInput onSubmit={handleSystemPromptSubmit} />
            </Paper>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Paper elevation={3} sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Evaluation Criteria
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                This evaluation assesses the language model's performance across five key areas:
              </Typography>
              {Object.entries(criteriaDisplayNames).map(([criterion, displayName], index) => (
                <Box key={index} sx={{ mb: 2 }}>
                  <Box display="flex" alignItems="center">
                    <Typography variant="body1" sx={{ flexGrow: 1 }}>
                      {index + 1}. {displayName}
                    </Typography>
                    {progress[criterion] && progress[criterion].processed === progress[criterion].total && (
                      <CheckCircleOutlineIcon color="success" />
                    )}
                  </Box>
                  {evaluationStarted && (
                    <>
                      <LinearProgress
                        variant="determinate"
                        value={(progress[criterion]?.processed || 0) / 5 * 100}
                        sx={{ mt: 1, mb: 1 }}
                      />
                      <Typography variant="body2" color="text.secondary">
                        Progress: {progress[criterion]?.processed || 0}/5
                      </Typography>
                    </>
                  )}
                </Box>
              ))}
              {evaluationStarted && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body1">Total Progress: {totalProgress}</Typography>
                  <LinearProgress 
                    variant="determinate" 
                    value={Number(totalProgress.split('/')[0]) / 25 * 100}
                    sx={{ mt: 1 }}
                  />
                </Box>
              )}
            </Paper>
          </Grid>
        </Grid>
        
        {isLoading && <Typography>Evaluation in progress...</Typography>}
        {error && <Typography color="error">{error}</Typography>}
      </Container>
    </ThemeProvider>
  );
}

export default App;