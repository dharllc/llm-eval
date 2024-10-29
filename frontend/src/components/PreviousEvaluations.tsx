import React, { useState, useEffect, useCallback } from 'react';
import { 
  Paper, 
  Typography, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  TablePagination, 
  CircularProgress, 
  Box,
  Tooltip,
  Alert
} from '@mui/material';
import { Evaluation, WebSocketMessage } from '../types';

interface PreviousEvaluationsProps {
  backendPort?: number | null;
  onEvaluationSelect?: (evaluation: Evaluation) => void;
}

export const PreviousEvaluations: React.FC<PreviousEvaluationsProps> = ({ 
  backendPort,
  onEvaluationSelect 
}) => {
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{
    evaluations: Evaluation[];
    total_count: number;
  }>({
    evaluations: [],
    total_count: 0
  });
  const [allEvaluations, setAllEvaluations] = useState<Evaluation[]>([]);
  const [ws, setWs] = useState<WebSocket | null>(null);

  const fetchAllEvaluations = async () => {
    if (!backendPort) return;
    
    try {
      const response = await fetch(
        `http://localhost:${backendPort}/evaluations?page=1&limit=1000`,
        {
          credentials: 'include',
          headers: { 'Accept': 'application/json' }
        }
      );
      
      if (!response.ok) throw new Error('Failed to fetch evaluations');
      
      const result = await response.json();
      const sortedEvals = [...result.evaluations].sort((a, b) => b.id - a.id);
      setAllEvaluations(sortedEvals);
      setData({
        evaluations: sortedEvals.slice(0, 20),
        total_count: result.total_count
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch evaluations');
    } finally {
      setLoading(false);
    }
  };

  const setupWebSocket = useCallback(() => {
    if (!backendPort) return;

    const socket = new WebSocket(`ws://localhost:${backendPort}/ws`);
    
    socket.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data) as WebSocketMessage;
        if (data.stage === 'completed') {
          await fetchAllEvaluations();
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    setWs(socket);

    return () => {
      socket.close();
    };
  }, [backendPort]);

  useEffect(() => {
    if (backendPort) {
      fetchAllEvaluations();
      const cleanup = setupWebSocket();
      return () => {
        cleanup?.();
      };
    }
  }, [backendPort, setupWebSocket]);

  const handleChangePage = (_: unknown, newPage: number) => {
    const startIdx = newPage * 20;
    setData(prev => ({
      ...prev,
      evaluations: allEvaluations.slice(startIdx, startIdx + 20)
    }));
    setPage(newPage);
  };

  if (loading) {
    return (
      <Paper elevation={3} sx={{ p: 3, mt: 3, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Paper>
    );
  }

  if (error) {
    return (
      <Paper elevation={3} sx={{ p: 3, mt: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          Error: {error}
        </Alert>
      </Paper>
    );
  }

  return (
    <Paper elevation={3} sx={{ p: 3, mt: 3 }}>
      <Typography variant="h6" gutterBottom>
        Previous Evaluations
      </Typography>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Date</TableCell>
              <TableCell align="right">Score</TableCell>
              <TableCell align="right">Tokens</TableCell>
              <TableCell align="right">Cost ($)</TableCell>
              <TableCell>Evaluation Model</TableCell>
              <TableCell>Scoring Model</TableCell>
              <TableCell>System Prompt</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.evaluations.map((evaluation) => (
              <TableRow 
                key={evaluation.id}
                hover
                onClick={() => onEvaluationSelect?.(evaluation)}
                sx={{ 
                  cursor: 'pointer',
                  '&:hover': {
                    backgroundColor: 'rgba(0, 0, 0, 0.04)'
                  }
                }}
              >
                <TableCell>{evaluation.id}</TableCell>
                <TableCell>{new Date(evaluation.timestamp).toLocaleString()}</TableCell>
                <TableCell align="right">{evaluation.total_score}/25</TableCell>
                <TableCell align="right">{evaluation.total_tokens}</TableCell>
                <TableCell align="right">
                  {evaluation.total_cost.toFixed(6)}
                </TableCell>
                <TableCell>
                  <Tooltip title={evaluation.model_name}>
                    <Typography variant="body2" sx={{ maxWidth: 150, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {evaluation.model_name}
                      {evaluation.model_name === 'gpt-4o-mini-2024-07-18' && ' (default)'}
                    </Typography>
                  </Tooltip>
                </TableCell>
                <TableCell>
                  <Tooltip title={evaluation.scoring_model}>
                    <Typography variant="body2" sx={{ maxWidth: 150, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {evaluation.scoring_model}
                      {evaluation.scoring_model === 'gpt-4o-mini-2024-07-18' && ' (default)'}
                    </Typography>
                  </Tooltip>
                </TableCell>
                <TableCell sx={{ maxWidth: 300 }}>
                  <Tooltip title={evaluation.system_prompt}>
                    <Typography
                      variant="body2"
                      sx={{
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                    >
                      {evaluation.system_prompt}
                    </Typography>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
        <TablePagination
          component="div"
          count={allEvaluations.length}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={20}
          rowsPerPageOptions={[20]}
        />
      </Box>
    </Paper>
  );
};