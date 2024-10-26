import React from 'react';
import { Box, Typography, LinearProgress, Tooltip } from '@mui/material';
import { TestCaseResult } from '../types';

interface CriteriaResultsProps {
  criteria: { [key: string]: string };
  criteriaResults: { [criterion: string]: { [id: number]: TestCaseResult } };
  countsPerCriterion: { [key: string]: number };
  evaluationStarted: boolean;
}

export const CriteriaResults: React.FC<CriteriaResultsProps> = ({
  criteria,
  criteriaResults,
  countsPerCriterion,
  evaluationStarted,
}) => {
  const renderProgressBar = (criterion: string) => {
    const count = countsPerCriterion[criterion] || 5;
    const results = criteriaResults[criterion] || {};
    const criterionIds = Object.keys(results)
      .map(Number)
      .filter(id => results[id] !== undefined)
      .sort((a, b) => a - b);

    const resultArray = Array.from({ length: count }, (_, index) => {
      const id = criterionIds[index];
      return id !== undefined ? results[id] : 'pending';
    });

    return (
      <Box sx={{ display: 'flex', mt: 1, mb: 1 }}>
        {resultArray.map((result, index) => (
          <Tooltip 
            key={index}
            title={`Test case ${index + 1}: ${result}`}
            arrow
          >
            <Box
              sx={{
                flex: 1,
                height: 20,
                backgroundColor: result === 'pass' 
                  ? 'success.light'
                  : result === 'fail'
                    ? 'error.light'
                    : 'grey.300',
                mx: 0.5,
                borderRadius: 1,
                transition: 'all 0.3s ease',
                opacity: evaluationStarted ? 0.7 : 1,
                '&:hover': {
                  opacity: 0.8,
                  transform: 'scale(1.05)',
                }
              }}
            />
          </Tooltip>
        ))}
      </Box>
    );
  };

  const getPassCountForCriterion = (criterion: string) => {
    const results = criteriaResults[criterion] || {};
    return Object.values(results).filter(result => result === 'pass').length;
  };

  return (
    <Box sx={{ mt: 3 }}>
      <Typography variant="h6" gutterBottom>
        Evaluation Criteria
      </Typography>
      {Object.entries(criteria).map(([criterion, displayName], index) => (
        <Box 
          key={criterion} 
          sx={{ 
            mb: 2,
            p: 2,
            borderRadius: 2,
            bgcolor: 'background.default',
            boxShadow: 1,
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body1" sx={{ fontWeight: 500 }}>
              {index + 1}. {displayName}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Pass: {getPassCountForCriterion(criterion)}/{countsPerCriterion[criterion] || 5}
            </Typography>
          </Box>
          {renderProgressBar(criterion)}
          {evaluationStarted && (
            <LinearProgress 
              sx={{ 
                mt: 1,
                height: 2,
                borderRadius: 1,
              }} 
            />
          )}
        </Box>
      ))}
    </Box>
  );
};