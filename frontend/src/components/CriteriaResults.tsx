// frontend/src/components/CriteriaResults.tsx
import React, { useState } from 'react';
import { Box, Typography, Popover } from '@mui/material';
import { TestCaseResult, TestCaseDetails as TestCaseDetailsType } from '../types';
import { TestCaseDetails } from './TestCaseDetails';

interface CriteriaResultsProps {
  criteria: { [key: string]: string };
  criteriaResults: { [criterion: string]: { [id: number]: TestCaseResult } };
  countsPerCriterion: { [key: string]: number };
  evaluationStarted: boolean;
  activeCriterion?: string;
  evaluationId?: number;
  detailedResults?: { [key: number]: TestCaseDetailsType };
}

export const CriteriaResults: React.FC<CriteriaResultsProps> = ({
  criteria,
  criteriaResults,
  countsPerCriterion,
  evaluationStarted,
  activeCriterion,
  evaluationId,
  detailedResults
}) => {
  const [hoveredCase, setHoveredCase] = useState<{ id: number, criterion: string } | null>(null);
  const [selectedCase, setSelectedCase] = useState<{ id: number, criterion: string } | null>(null);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [testCaseDetails, setTestCaseDetails] = useState<TestCaseDetailsType | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleHover = async (
    event: React.MouseEvent<HTMLElement>,
    id: number, 
    criterion: string,
    result: TestCaseResult
  ) => {
    if (!evaluationId) return;
    
    setHoveredCase({ id, criterion });
    setAnchorEl(event.currentTarget);
    
    // First check if we have the details in detailedResults
    if (detailedResults && detailedResults[id]) {
      setTestCaseDetails(detailedResults[id]);
      return;
    }
    
    // Fall back to fetching if not in detailedResults
    if (!testCaseDetails || testCaseDetails.id !== id) {
      setIsLoading(true);
      try {
        const response = await fetch(
          `http://localhost:${process.env.REACT_APP_BACKEND_PORT}/test-case-details/${evaluationId}/${id}`
        );
        if (response.ok) {
          const details = await response.json();
          setTestCaseDetails(details);
        } else {
          console.error('Failed to fetch test case details:', await response.text());
          setTestCaseDetails(null);
        }
      } catch (error) {
        console.error('Error fetching test case details:', error);
        setTestCaseDetails(null);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleClick = async (id: number, criterion: string, result: TestCaseResult) => {
    if (!evaluationId) return;
    
    if (selectedCase?.id === id) {
      setSelectedCase(null);
      return;
    }

    setSelectedCase({ id, criterion });
    
    // First check if we have the details in detailedResults
    if (detailedResults && detailedResults[id]) {
      setTestCaseDetails(detailedResults[id]);
      return;
    }
    
    // Fall back to fetching if not in detailedResults
    setIsLoading(true);
    
    try {
      const response = await fetch(
        `http://localhost:${process.env.REACT_APP_BACKEND_PORT}/test-case-details/${evaluationId}/${id}`
      );
      if (response.ok) {
        const details = await response.json();
        setTestCaseDetails(details);
      } else {
        console.error('Failed to fetch test case details:', await response.text());
        setTestCaseDetails(null);
        setSelectedCase(null);
      }
    } catch (error) {
      console.error('Error fetching test case details:', error);
      setTestCaseDetails(null);
      setSelectedCase(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMouseLeave = () => {
    if (!selectedCase) {
      setHoveredCase(null);
      setAnchorEl(null);
    }
  };

  const renderProgressBar = (criterion: string) => {
    const count = countsPerCriterion[criterion] || 5;
    const results = criteriaResults[criterion] || {};
    const criterionIds = Object.keys(results).map(Number)
      .filter(id => results[id] !== undefined)
      .sort((a, b) => a - b);
    
    const resultArray = Array.from({ length: count }, (_, index) => {
      const id = criterionIds[index];
      return {
        id: id,
        result: id !== undefined ? results[id] : 'pending'
      };
    });

    return (
      <Box sx={{ display: 'flex', mt: 1, mb: 1 }}>
        {resultArray.map(({ id, result }, index) => (
          <Box 
            key={index} 
            onClick={() => id && handleClick(id, criterion, result)}
            onMouseEnter={(e) => id && handleHover(e, id, criterion, result)}
            onMouseLeave={handleMouseLeave}
            sx={{
              flex: 1,
              height: 20,
              backgroundColor: result === 'pass' ? 'success.light' : 
                             result === 'fail' ? 'error.light' : 
                             'grey.300',
              mx: 0.5,
              borderRadius: 1,
              transition: 'all 0.3s ease',
              opacity: evaluationStarted && criterion !== activeCriterion ? 0.7 : 1,
              cursor: id ? 'pointer' : 'default',
              '&:hover': id ? {
                transform: 'scale(1.05)',
                boxShadow: 2
              } : undefined
            }}
          />
        ))}
      </Box>
    );
  };

  const getPassCountForCriterion = (criterion: string) => 
    Object.values(criteriaResults[criterion] || {}).filter(result => result === 'pass').length;

  return (
    <Box sx={{ mt: 3, position: 'relative' }}>
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
        </Box>
      ))}

      <Popover
        open={Boolean(anchorEl) && !selectedCase && Boolean(hoveredCase)}
        anchorEl={anchorEl}
        onClose={() => {
          if (!selectedCase) {
            setAnchorEl(null);
            setHoveredCase(null);
          }
        }}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'center',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
        sx={{
          pointerEvents: 'none',
        }}
      >
        <Box sx={{ p: 2, maxWidth: 300 }}>
          {isLoading ? (
            <Typography>Loading...</Typography>
          ) : testCaseDetails ? (
            <>
              <Typography variant="subtitle2" gutterBottom>
                {testCaseDetails.result === 'pass' ? '✓ Pass' : 
                 testCaseDetails.result === 'fail' ? '✗ Fail' : 
                 '⋯ In Progress'}
              </Typography>
              {testCaseDetails.explanation && (
                <Typography variant="body2">{testCaseDetails.explanation}</Typography>
              )}
              {testCaseDetails.input && (
                <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
                  Input: {testCaseDetails.input}
                </Typography>
              )}
            </>
          ) : (
            <Typography>Details not available yet</Typography>
          )}
        </Box>
      </Popover>

      {selectedCase && testCaseDetails && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 999
          }}
          onClick={() => setSelectedCase(null)}
        >
          <Box onClick={e => e.stopPropagation()}>
            <TestCaseDetails
              details={testCaseDetails}
              onClose={() => setSelectedCase(null)}
            />
          </Box>
        </Box>
      )}
    </Box>
  );
};