import React from 'react';
import { Box, Typography } from '@mui/material';

interface TotalScoreProps {
  score: number;
  total: number;
  animate?: boolean;
}

export const TotalScore: React.FC<TotalScoreProps> = ({ 
  score, 
  total, 
  animate = false 
}) => {
  const percentage = (score / total) * 100;
  const scoreColor = percentage >= 80 ? 'success.main' 
    : percentage >= 60 ? 'warning.main' 
    : 'error.main';

  return (
    <Box sx={{ 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center',
      p: 2,
      bgcolor: 'background.paper',
      borderRadius: 1,
      boxShadow: 1,
      transition: animate ? 'all 0.3s ease-in-out' : undefined
    }}>
      <Typography variant="h6">Total Score</Typography>
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 2,
        animation: animate ? 'fadeIn 0.5s ease-in-out' : undefined,
        '@keyframes fadeIn': {
          '0%': {
            opacity: 0,
            transform: 'translateY(10px)'
          },
          '100%': {
            opacity: 1,
            transform: 'translateY(0)'
          }
        }
      }}>
        <Typography variant="h5" color={scoreColor}>
          {score}/{total}
        </Typography>
        <Typography variant="h6" color={scoreColor}>
          ({percentage.toFixed(1)}%)
        </Typography>
      </Box>
    </Box>
  );
};

export default TotalScore;