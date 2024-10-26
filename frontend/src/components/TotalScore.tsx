import React from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';

interface TotalScoreProps {
  score: number;
  total: number;
  animate?: boolean;
}

export const TotalScore: React.FC<TotalScoreProps> = ({ score, total }) => {
  const percentage = (score / total) * 100;
  const scoreColor = percentage >= 80 ? 'success.main' 
    : percentage >= 60 ? 'warning.main' 
    : 'error.main';

  return (
    <Box 
      sx={{ 
        mt: 2,
        p: 2,
        borderRadius: 2,
        bgcolor: 'background.paper',
        boxShadow: 2,
        transition: 'all 0.3s ease-in-out',
      }}
    >
      <Typography variant="h6" gutterBottom>
        Total Score
      </Typography>
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        animation: 'fadeIn 0.5s ease-in-out',
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
        <Typography 
          variant="h4" 
          color={scoreColor}
          sx={{ transition: 'color 0.3s ease-in-out' }}
        >
          {score}/{total}
        </Typography>
        <Typography 
          variant="h5"
          color={scoreColor}
          sx={{ transition: 'color 0.3s ease-in-out' }}
        >
          ({percentage.toFixed(1)}%)
        </Typography>
      </Box>
      <Box sx={{ 
        position: 'relative', 
        mt: 2,
        display: 'flex',
        justifyContent: 'center'
      }}>
        <CircularProgress
          variant="determinate"
          value={100}
          size={60}
          sx={{ color: 'grey.200' }}
        />
        <CircularProgress
          variant="determinate"
          value={percentage}
          size={60}
          sx={{
            position: 'absolute',
            color: scoreColor,
            transition: 'all 0.5s ease-in-out',
          }}
        />
        <Typography
          variant="caption"
          component="div"
          color="text.secondary"
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        >
          {`${Math.round(percentage)}%`}
        </Typography>
      </Box>
    </Box>
  );
};