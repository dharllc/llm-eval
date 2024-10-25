import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ThemeProvider, createTheme, CssBaseline, Container, Typography, Paper, Grid, Box, LinearProgress } from '@mui/material';
import SystemPromptInput from './components/SystemPromptInput';

const theme = createTheme({
  palette: { mode: 'light', primary: { main: '#1976d2' } },
});

type TestCaseResult = 'pending' | 'pass' | 'fail';
type TestResultMap = { [id: number]: TestCaseResult };
type CriteriaResults = { [criterion: string]: TestResultMap };
type TestCaseAnalysis = {
  criteria: { [key: string]: string };
  counts_per_criterion: { [key: string]: number };
  total_test_cases: number;
};

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
  const [testCaseAnalysis, setTestCaseAnalysis] = useState<TestCaseAnalysis | null>(null);

  useEffect(() => {
    const fetchAnalysis = async (port: number) => {
      try {
        const response = await fetch(`http://localhost:${port}/test-case-analysis`);
        const analysis = await response.json();
        setTestCaseAnalysis(analysis);
      } catch (error) {
        console.error('Error fetching test case analysis:', error);
      }
    };

    fetch(`http://localhost:${process.env.REACT_APP_BACKEND_PORT}/config`)
      .then(response => response.json())
      .then(data => {
        setBackendPort(data.backendPort);
        fetchAnalysis(data.backendPort);
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
                newResults[criterion] = {};
              }
              newResults[criterion][id] = result as TestCaseResult;
              return newResults;
            });

            if (!processedIds.current.has(id)) {
              processedIds.current.add(id);
              setProcessedTestCases(prev => prev + 1);
              if (result === 'pass') {
                setTotalScore(prev => prev + 1);
              }
            }
          }

          if (data.stage === 'completed') {
            setEvaluationStarted(false);
            setEvaluationComplete(true);
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
    setCriteriaResults({});
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
    const count = testCaseAnalysis?.counts_per_criterion[criterion] || 0;
    const results = criteriaResults[criterion] || {};
    
    // Find all IDs for this criterion and sort them
    const criterionIds = Object.keys(results)
      .map(Number)
      .filter(id => results[id] !== undefined)
      .sort((a, b) => a - b);
  
    // Create array of length count, mapping results to their correct positions
    const resultArray = Array.from({ length: count }, (_, index) => {
      const id = criterionIds[index];
      return id ? results[id] : 'pending';
    });
  
    return (
      <div style={{ display: 'flex', marginTop: '5px', marginBottom: '5px' }}>
        {resultArray.map((result, index) => (
          <div
            key={index}
            style={{
              flex: 1,
              height: '20px',
              backgroundColor: result === 'pass' ? '#90EE90' : result === 'fail' ? '#ffcccb' : '#e0e0e0',
              margin: '0 1px'
            }}
          />
        ))}
      </div>
    );
  };

  const getPassCountForCriterion = (criterion: string) => {
    const results = criteriaResults[criterion] || {};
    return Object.values(results).filter(result => result === 'pass').length;
  };

  const totalTestCases = testCaseAnalysis?.total_test_cases || 0;

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
              {(evaluationStarted || evaluationComplete) && testCaseAnalysis && (
                <>
                  <Box sx={{ mt: 2, mb: 2 }}>
                    <Typography variant="body2">
                      Processed test cases: {processedTestCases}/{totalTestCases}
                    </Typography>
                    <LinearProgress 
                      variant="determinate" 
                      value={(processedTestCases / totalTestCases) * 100} 
                      sx={{ mt: 1 }}
                    />
                  </Box>
                  {evaluationComplete && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="h6">Total Score</Typography>
                      <Typography variant="body1">
                        {totalScore}/{totalTestCases} ({((totalScore / totalTestCases) * 100).toFixed(2)}%)
                      </Typography>
                    </Box>
                  )}
                  <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
                    Evaluation Criteria
                  </Typography>
                  {Object.entries(testCaseAnalysis.criteria).map(([criterion, displayName], index) => (
                    <Box key={criterion} sx={{ mb: 2 }}>
                      <Typography variant="body1">
                        {index + 1}. {displayName}
                      </Typography>
                      {renderProgressBar(criterion)}
                      <Typography variant="body2" color="text.secondary">
                        Pass: {getPassCountForCriterion(criterion)}/{testCaseAnalysis.counts_per_criterion[criterion]}
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