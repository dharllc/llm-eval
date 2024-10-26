import React from 'react';
import { Box, Typography } from '@mui/material';
import { TestCaseResult } from '../types';

interface CriteriaResultsProps {
  criteria: { [key: string]: string };
  criteriaResults: { [criterion: string]: { [id: number]: TestCaseResult } };
  countsPerCriterion: { [key: string]: number };
  evaluationStarted: boolean;
  activeCriterion?: string;
}

export const CriteriaResults: React.FC<CriteriaResultsProps> = ({
  criteria,
  criteriaResults,
  countsPerCriterion,
  evaluationStarted,
  activeCriterion
}) => {
  const renderProgressBar = (criterion: string) => {
    const count = countsPerCriterion[criterion] || 5;
    const results = criteriaResults[criterion] || {};
    const criterionIds = Object.keys(results).map(Number).filter(id => results[id] !== undefined).sort((a, b) => a - b);
    const resultArray = Array.from({ length: count }, (_, index) => {
      const id = criterionIds[index];
      return id !== undefined ? results[id] : 'pending';
    });

    return (
      <Box sx={{ display: 'flex', mt: 1, mb: 1 }}>
        {resultArray.map((result, index) => (
          <Box key={index} sx={{
            flex: 1,
            height: 20,
            backgroundColor: result === 'pass' ? 'success.light' : result === 'fail' ? 'error.light' : 'grey.300',
            mx: 0.5,
            borderRadius: 1,
            transition: 'all 0.3s ease',
            opacity: evaluationStarted && criterion !== activeCriterion ? 0.7 : 1
          }}/>
        ))}
      </Box>
    );
  };

  const getPassCountForCriterion = (criterion: string) => 
    Object.values(criteriaResults[criterion] || {}).filter(result => result === 'pass').length;

  return (
    <Box sx={{ mt: 3 }}>
      <Typography variant="h6" gutterBottom>Evaluation Criteria</Typography>
      {Object.entries(criteria).map(([criterion, displayName], index) => (
        <Box key={criterion} sx={{
          mb: 2,
          p: 2,
          borderRadius: 2,
          bgcolor: criterion === activeCriterion ? 'rgba(25, 118, 210, 0.08)' : 'background.default',
          boxShadow: 1,
          transition: 'background-color 0.3s ease'
        }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body1" sx={{ fontWeight: criterion === activeCriterion ? 600 : 500 }}>
              {index + 1}. {displayName}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Pass: {getPassCountForCriterion(criterion)}/{countsPerCriterion[criterion] || 5}
            </Typography>
          </Box>
          {renderProgressBar(criterion)}
          {evaluationStarted && criterion === activeCriterion && (
            <Box sx={{ 
              height: 2, 
              mt: 1,
              backgroundColor: 'primary.main',
              width: '100%',
              position: 'relative',
              overflow: 'hidden',
              '&::after': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                width: '30%',
                height: '100%',
                background: 'rgba(255, 255, 255, 0.3)',
                animation: 'pulse 1.5s ease-in-out infinite'
              },
              '@keyframes pulse': {
                '0%': { transform: 'translateX(-100%)' },
                '100%': { transform: 'translateX(400%)' }
              }
            }} />
          )}
        </Box>
      ))}
    </Box>
  );
};