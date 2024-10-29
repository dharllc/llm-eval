import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Grid, Paper, Typography, Alert, Snackbar } from '@mui/material';
import { AppLayout } from './components/AppLayout';
import { SystemPromptInput } from './components/SystemPromptInput';
import { EvaluationProgress } from './components/EvaluationProgress';
import { PreviousEvaluations } from './components/PreviousEvaluations';
import { TrendChart } from './components/TrendChart';
import { TestCaseAnalysis, TestCaseResult, WebSocketMessage, Evaluation, TestCaseDetails } from './types';

function App() {
  const [evaluationStarted, setEvaluationStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backendPort, setBackendPort] = useState<number | null>(null);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [modelName, setModelName] = useState('');
  const [scoringModel, setScoringModel] = useState('');
  const reconnectAttempts = useRef(0);
  const processedIds = useRef(new Set<number>());
  const [criteriaResults, setCriteriaResults] = useState<{[criterion: string]: {[id: number]: TestCaseResult}}>({});
  const [totalScore, setTotalScore] = useState(0);
  const [evaluationComplete, setEvaluationComplete] = useState(false);
  const [processedTestCases, setProcessedTestCases] = useState(0);
  const [activeCriterion, setActiveCriterion] = useState<string>();
  const [testCaseAnalysis, setTestCaseAnalysis] = useState<TestCaseAnalysis | null>(null);
  const [currentEvaluationId, setCurrentEvaluationId] = useState<number>();
  const [selectedEvaluation, setSelectedEvaluation] = useState<Evaluation | null>(null);
  const [allEvaluations, setAllEvaluations] = useState<Evaluation[]>([]);
  const [currentOffset, setCurrentOffset] = useState(0);
  const [snackbarState, setSnackbarState] = useState({ open: false, message: '', isError: false });
  const [detailedResults, setDetailedResults] = useState<{[key: number]: TestCaseDetails}>({});

  const fetchAllEvaluations = useCallback(async () => {
    if (!backendPort) return;
    try {
      const response = await fetch(`http://localhost:${backendPort}/evaluations?page=1&limit=1000`);
      if (!response.ok) throw new Error('Failed to fetch evaluations');
      const result = await response.json();
      const sortedEvals = [...result.evaluations].sort((a, b) => a.id - b.id);
      setAllEvaluations(sortedEvals);
      setCurrentOffset(Math.max(0, sortedEvals.length - 20));
    } catch (err) {
      console.error('Failed to fetch evaluations:', err);
    }
  }, [backendPort]);

  const handleEvaluationSelect = useCallback((evaluation: Evaluation) => {
    setSelectedEvaluation(evaluation);
    if (evaluation.test_case_results) {
      setCriteriaResults({});
      const results: {[criterion: string]: {[id: number]: TestCaseResult}} = {};
      Object.entries(evaluation.test_case_results).forEach(([id, details]) => {
        const criterion = details.criterion;
        if (!results[criterion]) results[criterion] = {};
        results[criterion][parseInt(id)] = details.result as TestCaseResult;
      });
      setCriteriaResults(results);
      setDetailedResults(evaluation.test_case_results);
      setTotalScore(evaluation.total_score);
      setProcessedTestCases(Object.keys(evaluation.test_case_results).length);
      setEvaluationComplete(true);
      setCurrentEvaluationId(evaluation.id);
    }
  }, []);

  const setupWebSocket = useCallback((port: number) => {
    const socket = new WebSocket(`ws://localhost:${port}/ws`);
    wsRef.current = socket;
    setWs(socket);

    socket.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data) as WebSocketMessage;
        if (data.type === 'ping') return socket.send(JSON.stringify({ type: 'pong' }));

        if (data.current_result) {
          const { id, criterion, result, evaluation_id } = data.current_result;
          setCurrentEvaluationId(evaluation_id);
          setActiveCriterion(criterion);
          setCriteriaResults(prev => ({
            ...prev,
            [criterion]: { ...(prev[criterion] || {}), [id]: result as TestCaseResult }
          }));

          if (!processedIds.current.has(id)) {
            processedIds.current.add(id);
            setProcessedTestCases(p => p + 1);
            if (result === 'pass') setTotalScore(p => p + 1);
          }
        }

        if (data.stage === 'completed') {
          setEvaluationStarted(false);
          setEvaluationComplete(true);
          setActiveCriterion(undefined);
          setSnackbarState({ open: true, message: 'Evaluation completed', isError: false });
          setSelectedEvaluation(null);
          await fetchAllEvaluations();
        } else if (data.stage === 'error') {
          setError(data.error || 'Unknown error');
          setEvaluationStarted(false);
          setActiveCriterion(undefined);
          setSnackbarState({ open: true, message: 'Evaluation failed', isError: true });
        }
      } catch (error) {
        console.error('WebSocket error:', error);
      }
    };

    socket.onclose = () => reconnectAttempts.current < 5 && 
      setTimeout(() => { reconnectAttempts.current++; setupWebSocket(port); }, 3000);

    return socket;
  }, [fetchAllEvaluations]);

  useEffect(() => {
    (async () => {
      try {
        const response = await fetch(`http://localhost:${process.env.REACT_APP_BACKEND_PORT}/config`);
        const data = await response.json();
        setBackendPort(data.backendPort);
        setModelName(data.model);
        setScoringModel(data.scoringModel);
        await Promise.all([
          fetch(`http://localhost:${data.backendPort}/test-case-analysis`)
            .then(r => r.json())
            .then(setTestCaseAnalysis),
          fetchAllEvaluations()
        ]);
        setupWebSocket(data.backendPort);
      } catch (error) {
        setError('Failed to initialize. Check if backend is running.');
      }
    })();
    return () => wsRef.current?.close();
  }, [setupWebSocket, fetchAllEvaluations]);

  const handleSystemPromptSubmit = useCallback(async (prompt: string) => {
    if (!backendPort) return setError('Backend port not configured');
    setEvaluationStarted(true);
    setEvaluationComplete(false);
    setCriteriaResults({});
    setTotalScore(0);
    setProcessedTestCases(0);
    setActiveCriterion(undefined);
    setCurrentEvaluationId(undefined);
    setSelectedEvaluation(null);
    setDetailedResults({});
    processedIds.current.clear();

    try {
      const response = await fetch(`http://localhost:${backendPort}/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ prompt })
      });
      if (!response.ok) throw new Error(await response.text());
      await response.json();
    } catch (error) {
      setError(`Evaluation failed: ${error}`);
      setEvaluationStarted(false);
      setSnackbarState({ open: true, message: 'Evaluation failed', isError: true });
    }
  }, [backendPort]);

  const chartData = allEvaluations.slice(currentOffset, currentOffset + 20);
  const hasNext = currentOffset + 20 < allEvaluations.length;
  const hasPrev = currentOffset > 0;

  return (
    <AppLayout>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>Language Model</Typography>
            <Typography variant="body1">
              Current model: {modelName} {modelName === 'gpt-4o-mini' && '(default)'}
            </Typography>
          </Paper>
          <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
            <SystemPromptInput 
              onSubmit={handleSystemPromptSubmit}
              disabled={evaluationStarted || !ws}
              defaultValue={selectedEvaluation?.system_prompt}
            />
          </Paper>
          <TrendChart 
            evaluations={chartData}
            onNext={() => setCurrentOffset(o => Math.min(o + 20, allEvaluations.length - 20))}
            onPrev={() => setCurrentOffset(o => Math.max(0, o - 20))}
            hasNext={hasNext}
            hasPrev={hasPrev}
          />
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
            detailedResults={detailedResults}
          />
        </Grid>
      </Grid>
      <PreviousEvaluations 
        backendPort={backendPort}
        onEvaluationSelect={handleEvaluationSelect}
      />
      <Snackbar
        open={snackbarState.open}
        autoHideDuration={6000}
        onClose={() => setSnackbarState(s => ({ ...s, open: false }))}
      >
        <Alert 
          onClose={() => setSnackbarState(s => ({ ...s, open: false }))} 
          severity={snackbarState.isError ? "error" : "success"}
        >
          {snackbarState.message}
        </Alert>
      </Snackbar>
    </AppLayout>
  );
}

export default App;