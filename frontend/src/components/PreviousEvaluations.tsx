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
  Alert,
  IconButton,
  Collapse
} from '@mui/material';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Evaluation } from '../types';

interface PreviousEvaluationsProps {
  backendPort?: number | null;
  onEvaluationSelect?: (evaluation: Evaluation) => void;
}

interface ExpandedRow {
  [key: number]: boolean;
}

export const PreviousEvaluations: React.FC<PreviousEvaluationsProps> = ({ 
  backendPort,
  onEvaluationSelect 
}) => {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<ExpandedRow>({});
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

  const toggleRowExpand = (id: number) => {
    setExpandedRows(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const formatCriteriaScores = (scores: Evaluation['scores_by_criteria']) => {
    return Object.entries(scores).map(([criterion, score]) => (
      <Box key={criterion} sx={{ mb: 1 }}>
        <Typography variant="body2">
          {criterion.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}:&nbsp;
          {score.pass_count}/{score.total_count}
        </Typography>
      </Box>
    ));
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
              <TableCell padding="checkbox" />
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
              <React.Fragment key={evaluation.id}>
                <TableRow 
                  hover
                  onClick={() => onEvaluationSelect?.(evaluation)}
                  sx={{ cursor: 'pointer', '& > *': { borderBottom: 'unset' } }}
                >
                  <TableCell padding="checkbox">
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleRowExpand(evaluation.id);
                      }}
                    >
                      {expandedRows[evaluation.id] ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </IconButton>
                  </TableCell>
                  <TableCell>{evaluation.id}</TableCell>
                  <TableCell>{new Date(evaluation.timestamp).toLocaleString()}</TableCell>
                  <TableCell align="right">{evaluation.total_score}/25</TableCell>
                  <TableCell align="right">{evaluation.token_count}</TableCell>
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
                <TableRow>
                  <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={7}>
                    <Collapse in={expandedRows[evaluation.id]} timeout="auto" unmountOnExit>
                      <Box sx={{ margin: 1 }}>
                        <Typography variant="h6" gutterBottom component="div">
                          Criteria Scores
                        </Typography>
                        {formatCriteriaScores(evaluation.scores_by_criteria)}
                      </Box>
                    </Collapse>
                  </TableCell>
                </TableRow>
              </React.Fragment>
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