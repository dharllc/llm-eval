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
import { TrendChart } from './TrendChart';

interface PreviousEvaluationsProps {
  backendPort?: number | null;
  onEvaluationSelect?: (evaluation: Evaluation) => void;
}

export const PreviousEvaluations: React.FC<PreviousEvaluationsProps> = ({ 
  backendPort,
  onEvaluationSelect 
}) => {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{
    evaluations: Evaluation[];
    total_count: number;
    page: number;
    pages: number;
  }>({
    evaluations: [],
    total_count: 0,
    page: 1,
    pages: 0
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
      setData(prev => ({
        ...prev,
        total_count: result.total_count
      }));

      // Initialize to show the latest 20 evaluations
      if (sortedEvals.length > 20) {
        const startIdx = Math.max(0, sortedEvals.length - 20);
        setData(prev => ({
          ...prev,
          evaluations: sortedEvals.slice(startIdx, startIdx + 20)
        }));
      } else {
        setData(prev => ({
          ...prev,
          evaluations: sortedEvals
        }));
      }
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

  const totalPages = Math.ceil(allEvaluations.length / 20);

  if (loading && !data.evaluations.length) {
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
              <TableCell>Model</TableCell>
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
                <TableCell align="right">
                  {evaluation.total_tokens !== undefined ? evaluation.total_tokens : 
                   evaluation.token_count !== undefined ? evaluation.token_count : 
                   0}
                </TableCell>
                <TableCell>{evaluation.model_name}</TableCell>
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