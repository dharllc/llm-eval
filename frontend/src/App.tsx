import React from 'react';
import { ThemeProvider, createTheme, CssBaseline, Container, Typography } from '@mui/material';
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
  const handleSystemPromptSubmit = (prompt: string) => {
    console.log('System prompt submitted:', prompt);
    // TODO: Implement the logic to start the evaluation
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container>
        <Typography variant="h4" component="h1" gutterBottom sx={{ mt: 4 }}>
          LLM Evaluation Tool
        </Typography>
        <SystemPromptInput onSubmit={handleSystemPromptSubmit} />
      </Container>
    </ThemeProvider>
  );
}

export default App;