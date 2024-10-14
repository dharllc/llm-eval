import React, { useState } from 'react';
import { ThemeProvider, createTheme, CssBaseline, Container, Typography, Paper, Grid, Box } from '@mui/material';
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

  const handleSystemPromptSubmit = (prompt: string) => {
    console.log('System prompt submitted:', prompt);
    setEvaluationStarted(true);
    // TODO: Implement the logic to start the evaluation
  };

  const evaluationCriteria = [
    "Retaining Key Information",
    "Removing Filler Text",
    "Improving Readability",
    "Maintaining the Original Tone",
    "Avoiding Misinterpretation of Statements as Commands"
  ];

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
                Current model: GPT-4 mini (default)
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
              {evaluationCriteria.map((criterion, index) => (
                <Box key={index} sx={{ mb: 1 }}>
                  <Typography variant="body1">
                    {index + 1}. {criterion}
                  </Typography>
                  {evaluationStarted && (
                    <Typography variant="body2" color="text.secondary">
                      Status: {index === 0 ? 'In progress' : 'Pending'}
                    </Typography>
                  )}
                </Box>
              ))}
            </Paper>
          </Grid>
        </Grid>
      </Container>
    </ThemeProvider>
  );
}

export default App;