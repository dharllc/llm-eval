// frontend/src/components/AppLayout.tsx
import React from 'react';
import { ThemeProvider, createTheme, CssBaseline, Container, Typography } from '@mui/material';

const theme = createTheme({
  palette: { mode: 'light', primary: { main: '#1976d2' } },
});

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => (
  <ThemeProvider theme={theme}>
    <CssBaseline />
    <Container maxWidth="lg">
      <Typography variant="h4" component="h1" gutterBottom sx={{ mt: 4, mb: 4 }}>
        LLM Evaluation Tool
      </Typography>
      {children}
    </Container>
  </ThemeProvider>
);