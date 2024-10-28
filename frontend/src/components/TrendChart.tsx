import React from 'react';
import { Box, IconButton, Paper, Typography } from '@mui/material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Evaluation } from '../types';

interface TrendChartProps {
  evaluations: Evaluation[];
  onNext: () => void;
  onPrev: () => void;
  hasNext: boolean;
  hasPrev: boolean;
}

export const TrendChart: React.FC<TrendChartProps> = ({
  evaluations,
  onNext,
  onPrev,
  hasNext,
  hasPrev,
}) => {
  const chartData = [...evaluations]
    .sort((a, b) => a.id - b.id)
    .map(evaluation => ({
      id: evaluation.id,
      score: evaluation.total_score,
    }));

  const displayRange = evaluations.length > 0 ? 
    `${chartData[0].id} - ${chartData[chartData.length - 1].id}` : 
    '0 - 0';

  return (
    <Paper elevation={3} sx={{ p: 2, mb: 2, height: 'fit-content' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="h6">Score Trend</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <IconButton 
            onClick={onPrev} 
            disabled={!hasPrev}
            size="small"
          >
            <ChevronLeft size={20} />
          </IconButton>
          <Typography variant="body2" sx={{ mx: 1 }}>
            {displayRange}
          </Typography>
          <IconButton 
            onClick={onNext} 
            disabled={!hasNext}
            size="small"
          >
            <ChevronRight size={20} />
          </IconButton>
        </Box>
      </Box>
      <Box sx={{ width: '100%', height: 200 }}>
        <ResponsiveContainer>
          <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis 
              dataKey="id"
              type="number"
              domain={['dataMin', 'dataMax']}
              allowDecimals={false}
              interval={0}
              tickCount={20}
            />
            <YAxis 
              domain={[0, 25]}
              ticks={[0, 5, 10, 15, 20, 25]}
              interval={0}
            />
            <Tooltip 
              formatter={(value: number) => [`${value}/25`, 'Score']}
              labelFormatter={(label: number) => `Evaluation ${label}`}
            />
            <Line 
              type="monotone" 
              dataKey="score" 
              stroke="#1976d2" 
              dot={{ stroke: '#1976d2', strokeWidth: 2, r: 3 }} 
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </Box>
    </Paper>
  );
};