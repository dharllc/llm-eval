// frontend/src/App.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Grid, Paper, Typography, Alert, Snackbar } from '@mui/material';
import { AppLayout } from './components/AppLayout';
import { SystemPromptInput } from './components/SystemPromptInput';
import { EvaluationProgress } from './components/EvaluationProgress';
import { PreviousEvaluations } from './components/PreviousEvaluations';
import { TestCaseAnalysis, TestCaseResult, WebSocketMessage, Evaluation } from './types';

const RECONNECT_INTERVAL = 3000;
const MAX_RECONNECT_ATTEMPTS = 5;

function App() {
  const [evaluationStarted, setEvaluationStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backendPort, setBackendPort] = useState<number | null>(null);
  const [modelName, setModelName] = useState<string>('');
  const [scoringModel, setScoringModel] = useState<string>('');
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [criteriaResults, setCriteriaResults] = useState<{[criterion: string]: {[id: number]: TestCaseResult}}>({});
  const [totalScore, setTotalScore] = useState<number>(0);
  const [evaluationComplete, setEvaluationComplete] = useState(false);
  const [processedTestCases, setProcessedTestCases] = useState<number>(0);
  const [activeCriterion, setActiveCriterion] = useState<string | undefined>();
  const processedIds = useRef(new Set<number>());
  const [testCaseAnalysis, setTestCaseAnalysis] = useState<TestCaseAnalysis | null>(null);
  const reconnectAttempts = useRef(0);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const wsRef = useRef<WebSocket | null>(null);
  const [currentEvaluationId, setCurrentEvaluationId] = useState<number | undefined>();
  const [selectedEvaluation, setSelectedEvaluation] = useState<Evaluation | null>(null);

  const setupWebSocket = useCallback((port: number) => {
    const socket = new WebSocket(`ws://localhost:${port}/ws`);
    wsRef.current = socket;
    setWs(socket);

    socket.onopen = () => {
      console.log('WebSocket connected');
      reconnectAttempts.current = 0;
      setError(null);
    };

    socket.onclose = () => {
      console.log('WebSocket disconnected');
      if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
        setTimeout(() => {
          reconnectAttempts.current += 1;
          setupWebSocket(port);
        }, RECONNECT_INTERVAL);
      } else {
        setError('Connection lost. Please refresh the page.');
      }
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as WebSocketMessage;
        if (data.type === 'ping') {
          socket.send(JSON.stringify({ type: 'pong' }));
          return;
        }

        console.log('WebSocket received data:', data);
        
        if (data.current_result) {
          const { id, criterion, result, evaluation_id } = data.current_result;
          if (evaluation_id) {
            setCurrentEvaluationId(evaluation_id);
          }
          console.log('Processing result:', { id, criterion, result });
          
          setActiveCriterion(criterion);
          setCriteriaResults(prevResults => {
            const newResults = { ...prevResults };
            if (!newResults[criterion]) newResults[criterion] = {};
            newResults[criterion][id] = result as TestCaseResult;
            return newResults;
          });

          if (!processedIds.current.has(id)) {
            processedIds.current.add(id);
            setProcessedTestCases(prev => prev + 1);
            if (result === 'pass') setTotalScore(prev => prev + 1);
          }
        }

        if (data.stage === 'completed') {
          setEvaluationStarted(false);
          setEvaluationComplete(true);
          setActiveCriterion(undefined);
          setSnackbarMessage('Evaluation completed successfully');
          setSnackbarOpen(true);
          setSelectedEvaluation(null); // Clear any selected evaluation
        } else if (data.stage === 'error') {
          setError(data.error || 'An unknown error occurred');
          setEvaluationStarted(false);
          setActiveCriterion(undefined);
          setSnackbarMessage('Evaluation failed');
          setSnackbarOpen(true);
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      setError('Connection error. Attempting to reconnect...');
    };

    return socket;
  }, []);

  const fetchAnalysis = useCallback(async (port: number) => {
    try {
      const response = await fetch(`http://localhost:${port}/test-case-analysis`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const analysis = await response.json();
      console.log('Analysis response:', analysis);
      setTestCaseAnalysis(analysis);
    } catch (error) {
      console.error('Error fetching test case analysis:', error);
      setError('Failed to load test case analysis. Please refresh the page.');
      setSnackbarMessage('Failed to load analysis');
      setSnackbarOpen(true);
    }
  }, []);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        const response = await fetch(`http://localhost:${process.env.REACT_APP_BACKEND_PORT}/config`);
        const data = await response.json();
        setBackendPort(data.backendPort);
        setModelName(data.model);
        setScoringModel(data.scoringModel);
        await fetchAnalysis(data.backendPort);
        setupWebSocket(data.backendPort);
      } catch (error) {
        console.error('Error initializing app:', error);
        setError('Failed to initialize application. Please check if the backend is running.');
        setSnackbarMessage('Failed to initialize');
        setSnackbarOpen(true);
      }
    };

    initializeApp();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [setupWebSocket, fetchAnalysis]);

  const handleSystemPromptSubmit = useCallback(async (prompt: string) => {
    if (!backendPort) {
      setError('Backend port not configured');
      return;
    }

    setEvaluationStarted(true);
    setEvaluationComplete(false);
    setError(null);
    setCriteriaResults({});
    setTotalScore(0);
    setProcessedTestCases(0);
    setActiveCriterion(undefined);
    setCurrentEvaluationId(undefined);
    setSelectedEvaluation(null);
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
      const errorMessage = error instanceof Error ? error.message : String(error);
      setError(`Evaluation failed: ${errorMessage}`);
      setEvaluationStarted(false);
      setSnackbarMessage('Evaluation failed');
      setSnackbarOpen(true);
    }
  }, [backendPort]);

  const handleSnackbarClose = () => setSnackbarOpen(false);

  const handleEvaluationSelect = useCallback((evaluation: Evaluation) => {
    setSelectedEvaluation(evaluation);
    // Reset current evaluation state
    setEvaluationStarted(false);
    setEvaluationComplete(true);
    
    // Transform test_case_results into criteriaResults format
    const formattedResults: { [criterion: string]: { [id: number]: TestCaseResult } } = {};
    
    // If we have test_case_results, use that to build the criteria results
    if (evaluation.test_case_results) {
      Object.values(evaluation.test_case_results).forEach(testCase => {
        if (!formattedResults[testCase.criterion]) {
          formattedResults[testCase.criterion] = {};
        }
        formattedResults[testCase.criterion][testCase.id] = testCase.result;
      });
    }
    // If no test_case_results but have scores_by_criteria, use that as fallback
    else if (evaluation.scores_by_criteria) {
      Object.entries(evaluation.scores_by_criteria).forEach(([criterion, results]) => {
        formattedResults[criterion] = {};
        results.forEach((result, index) => {
          formattedResults[criterion][index] = result;
        });
      });
    }
    
    setCriteriaResults(formattedResults);
    setTotalScore(evaluation.total_score);
    setCurrentEvaluationId(evaluation.id);
    setProcessedTestCases(evaluation.total_score); // Set processed cases to match total score
  }, []);

  return (
    <AppLayout>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Language Model
            </Typography>
            <Typography variant="body1">
              Current model: {modelName} {modelName === 'gpt-4o-mini' && '(default)'}
            </Typography>
          </Paper>
          <Paper elevation={3} sx={{ p: 3 }}>
            <SystemPromptInput 
              onSubmit={handleSystemPromptSubmit}
              disabled={evaluationStarted || !ws}
              defaultValue={selectedEvaluation?.system_prompt}
            />
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <EvaluationProgress
            evaluationStarted={evaluationStarted}
            evaluationComplete={evaluationComplete}
            processedTestCases={processedTestCases}
            totalScore={totalScore}
            testCaseAnalysis={testCaseAnalysis}
            criteriaResults={criteriaResults}
            error={error}
            activeCriterion={activeCriterion}
            scoringModel={scoringModel}
            evaluationId={currentEvaluationId}
          />
        </Grid>
      </Grid>
      <PreviousEvaluations 
        backendPort={backendPort}
        onEvaluationSelect={handleEvaluationSelect}
      />
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
      >
        <Alert 
          onClose={handleSnackbarClose} 
          severity={error ? "error" : "success"}
          sx={{ width: '100%' }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </AppLayout>
  );
}

export default App;