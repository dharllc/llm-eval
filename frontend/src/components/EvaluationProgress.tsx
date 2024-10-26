import React from 'react';
import { Paper, Typography, Box, LinearProgress, Alert, CircularProgress } from '@mui/material';
import { TotalScore } from './TotalScore';
import { CriteriaResults } from './CriteriaResults';
import { TestCaseAnalysis, TestCaseResult } from '../types';

interface EvaluationProgressProps {
  evaluationStarted: boolean;
  evaluationComplete: boolean;
  processedTestCases: number;
  totalScore: number;
  testCaseAnalysis: TestCaseAnalysis | null;
  criteriaResults: { [criterion: string]: { [id: number]: TestCaseResult } };
  error: string | null;
  activeCriterion?: string;
}

export const EvaluationProgress: React.FC<EvaluationProgressProps> = ({
  evaluationStarted,
  evaluationComplete,
  processedTestCases,
  totalScore,
  testCaseAnalysis,
  criteriaResults,
  error,
  activeCriterion
}) => {
  if (!testCaseAnalysis) {
    return (
      <Paper elevation={3} sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
        <Box sx={{ textAlign: 'center' }}>
          <CircularProgress sx={{ mb: 2 }} />
          <Typography variant="body2">Loading evaluation criteria...</Typography>
        </Box>
      </Paper>
    );
  }

  return (
    <Paper elevation={3} sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>Evaluation Progress</Typography>
      
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box sx={{ mt: 2, mb: 2 }}>
        <Typography variant="body2">
          Processed test cases: {processedTestCases}/{testCaseAnalysis.total_test_cases}
        </Typography>
        <LinearProgress 
          variant="determinate" 
          value={(processedTestCases / testCaseAnalysis.total_test_cases) * 100} 
          sx={{ 
            mt: 1,
            height: 8,
            borderRadius: 4,
            '& .MuiLinearProgress-bar': {
              transition: 'transform 0.5s ease-in-out'
            }
          }}
        />
      </Box>

      {evaluationComplete && (
        <TotalScore 
          score={totalScore} 
          total={testCaseAnalysis.total_test_cases}
          animate={true}
        />
      )}

      <CriteriaResults
        criteria={testCaseAnalysis.criteria}
        criteriaResults={criteriaResults}
        countsPerCriterion={testCaseAnalysis.counts_per_criterion}
        evaluationStarted={evaluationStarted}
        activeCriterion={activeCriterion}
      />
    </Paper>
  );
};