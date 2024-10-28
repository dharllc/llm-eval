// frontend/src/components/PreviousEvaluations.tsx
import React, { useState, useEffect } from 'react';
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
import { Evaluation } from '../types';

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

  const fetchEvaluations = async () => {
    if (!backendPort) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(
        `http://localhost:${backendPort}/evaluations?page=${page + 1}&limit=${rowsPerPage}`,
        {
          credentials: 'include',
          headers: { 'Accept': 'application/json' }
        }
      );
      
      if (!response.ok) throw new Error('Failed to fetch evaluations');
      
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load evaluations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (backendPort) fetchEvaluations();
  }, [backendPort, page, rowsPerPage]);

  const handleChangePage = (_: unknown, newPage: number) => setPage(newPage);

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

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
      <TablePagination
        component="div"
        count={data.total_count}
        page={page}
        onPageChange={handleChangePage}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={handleChangeRowsPerPage}
        rowsPerPageOptions={[5, 10, 25]}
      />
    </Paper>
  );
};