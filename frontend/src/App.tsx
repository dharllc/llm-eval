import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ThemeProvider, createTheme, CssBaseline, Container, Typography, Paper, Grid, Box, LinearProgress } from '@mui/material';
import SystemPromptInput from './components/SystemPromptInput';

const theme = createTheme({
  palette: { 
    mode: 'light', 
    primary: { main: '#3b82f6' }
  },
});

const criteriaDisplayNames: { [key: string]: string } = {
  "retaining_key_information": "Retaining Key Information",
  "removing_filler_text": "Removing Filler Text",
  "improving_readability": "Improving Readability",
  "maintaining_original_tone": "Maintaining the Original Tone",
  "avoiding_misinterpretation": "Avoiding Misinterpretation of Statements as Commands"
};

const TOTAL_TEST_CASES = 25;

type TestCaseResult = 'pending' | 'pass' | 'fail';
type CriterionResults = TestCaseResult[];
type CriteriaResults = { [key: string]: CriterionResults };

function App() {
  const [evaluationStarted, setEvaluationStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backendPort, setBackendPort] = useState<number | null>(null);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [criteriaResults, setCriteriaResults] = useState<CriteriaResults>({});
  const [totalScore, setTotalScore] = useState<number>(0);
  const [evaluationComplete, setEvaluationComplete] = useState(false);
  const [processedTestCases, setProcessedTestCases] = useState<number>(0);
  const processedIds = useRef(new Set<number>());

  const initializeCriteriaResults = () => {
    const initialResults: CriteriaResults = {};
    Object.keys(criteriaDisplayNames).forEach(criterion => {
      initialResults[criterion] = Array(5).fill('pending');
    });
    return initialResults;
  };

  useEffect(() => {
    fetch(`http://localhost:${process.env.REACT_APP_BACKEND_PORT}/config`)
      .then(response => response.json())
      .then(data => {
        setBackendPort(data.backendPort);
        const socket = new WebSocket(`ws://localhost:${data.backendPort}/ws`);
        setWs(socket);

        socket.onopen = () => console.log('WebSocket connected');

        socket.onmessage = (event) => {
          const data = JSON.parse(event.data);
          if (data.current_result) {
            const { id, criterion, result } = data.current_result;
            setCriteriaResults(prevResults => {
              const newResults = { ...prevResults };
              if (!newResults[criterion]) {
                newResults[criterion] = Array(5).fill('pending');
              }
              const index = (id - 1) % 5;
              newResults[criterion][index] = result as TestCaseResult;
              return newResults;
            });

            if (!processedIds.current.has(id)) {
              processedIds.current.add(id);
              setProcessedTestCases(prev => Math.min(prev + 1, TOTAL_TEST_CASES));
              if (result === 'pass') {
                setTotalScore(prev => Math.min(prev + 1, TOTAL_TEST_CASES));
              }
            }
          }

          if (data.status === 'completed') {
            setEvaluationStarted(false);
            setEvaluationComplete(true);
            setProcessedTestCases(TOTAL_TEST_CASES);
          } else if (data.status === 'error') {
            setError(data.message);
            setEvaluationStarted(false);
          }
        };

        socket.onerror = (error) => {
          console.error('WebSocket error:', error);
          setError('WebSocket connection error');
        };

        return () => socket.close();
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

    setEvaluationStarted(true);
    setEvaluationComplete(false);
    setError(null);
    setCriteriaResults(initializeCriteriaResults());
    setTotalScore(0);
    setProcessedTestCases(0);
    processedIds.current.clear();

    try {
      const response = await fetch(`http://localhost:${backendPort}/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Evaluation failed: ${errorText}`);
      }

      await response.json();
    } catch (error) {
      setError(`An error occurred during evaluation: ${error instanceof Error ? error.message : String(error)}`);
      setEvaluationStarted(false);
    }
  }, [backendPort]);

  const renderProgressBar = (criterion: string) => {
    const results = criteriaResults[criterion] || Array(5).fill('pending');
    return (
      <div style={{ display: 'flex', marginTop: '5px', marginBottom: '5px' }}>
        {results.map((result, index) => (
          <div
            key={index}
            style={{
              flex: 1,
              height: '20px',
              backgroundColor: result === 'pass' ? '#22c55e' : result === 'fail' ? '#ef4444' : '#e5e7eb',
              margin: '0 1px',
              borderRadius: '2px'
            }}
          />
        ))}
      </div>
    );
  };

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
                Evaluation Progress
              </Typography>
              {(evaluationStarted || evaluationComplete) && (
                <>
                  <Box sx={{ mt: 2, mb: 2 }}>
                    <Typography variant="body2">
                      Processed test cases: {processedTestCases}/{TOTAL_TEST_CASES}
                    </Typography>
                    <LinearProgress 
                      variant="determinate" 
                      value={(processedTestCases / TOTAL_TEST_CASES) * 100} 
                      sx={{ mt: 1 }}
                    />
                  </Box>
                  {evaluationComplete && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="h6">Total Score</Typography>
                      <Typography variant="body1">
                        {totalScore}/{TOTAL_TEST_CASES} ({((totalScore / TOTAL_TEST_CASES) * 100).toFixed(2)}%)
                      </Typography>
                    </Box>
                  )}
                  <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
                    Evaluation Criteria
                  </Typography>
                  {Object.entries(criteriaDisplayNames).map(([criterion, displayName], index) => (
                    <Box key={index} sx={{ mb: 2 }}>
                      <Typography variant="body1">
                        {index + 1}. {displayName}
                      </Typography>
                      {renderProgressBar(criterion)}
                      <Typography variant="body2" color="text.secondary">
                        Pass: {criteriaResults[criterion]?.filter(r => r === 'pass').length || 0}/5
                      </Typography>
                    </Box>
                  ))}
                </>
              )}
            </Paper>
          </Grid>
        </Grid>
        
        {error && <Typography color="error">{error}</Typography>}
      </Container>
    </ThemeProvider>
  );
}

export default App;