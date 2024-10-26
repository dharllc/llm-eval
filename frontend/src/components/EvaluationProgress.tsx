import React, { useState, useEffect } from 'react';
import { Paper, Typography, Box, LinearProgress, Alert, CircularProgress, IconButton } from '@mui/material';
import { Eye, EyeOff } from 'lucide-react';
import { TotalScore } from './TotalScore';
import { CriteriaResults } from './CriteriaResults';
import { TestCaseAnalysis, TestCaseResult, EvaluationSettings } from '../types';

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
  const [showEvalDetails, setShowEvalDetails] = useState(false);
  const [evalSettings, setEvalSettings] = useState<EvaluationSettings | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEvalSettings = async () => {
      try {
        const response = await fetch(`http://localhost:${process.env.REACT_APP_BACKEND_PORT}/evaluation-settings`);
        if (!response.ok) throw new Error('Failed to fetch evaluation settings');
        const settings = await response.json();
        setEvalSettings(settings);
      } catch (err) {
        setSettingsError('Failed to load evaluation settings');
        console.error('Error fetching evaluation settings:', err);
      }
    };
    fetchEvalSettings();
  }, []);

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
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6">Evaluation Progress</Typography>
        <IconButton 
          onClick={() => setShowEvalDetails(!showEvalDetails)}
          size="small"
          color="primary"
        >
          {showEvalDetails ? <EyeOff size={20} /> : <Eye size={20} />}
        </IconButton>
      </Box>

      {settingsError && <Alert severity="error" sx={{ mb: 2 }}>{settingsError}</Alert>}
      
      {showEvalDetails && evalSettings && (
        <Box sx={{ 
          mb: 3, 
          p: 2, 
          bgcolor: 'grey.50', 
          borderRadius: 1,
          border: '1px solid',
          borderColor: 'grey.200'
        }}>
          <Typography variant="subtitle2" gutterBottom>Evaluation Settings</Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>Temperature:</strong> {evalSettings.temperature}
          </Typography>
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              <strong>System Prompt:</strong>
            </Typography>
            <Box sx={{ 
              p: 1.5, 
              bgcolor: 'background.paper', 
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'grey.300',
              whiteSpace: 'pre-wrap'
            }}>
              {evalSettings.system_prompt}
            </Box>
          </Box>
          <Box>
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              <strong>Evaluation Prompt Template:</strong>
            </Typography>
            <Box sx={{ 
              p: 1.5, 
              bgcolor: 'background.paper', 
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'grey.300',
              whiteSpace: 'pre-wrap'
            }}>
              {evalSettings.evaluation_prompt_template}
            </Box>
          </Box>
        </Box>
      )}
      
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