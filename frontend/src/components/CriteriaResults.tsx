import React, { useState } from 'react';
import { Box, Typography, Popover } from '@mui/material';
import { TestCaseResult, TestCaseDetails as TestCaseDetailsType } from '../types';
import { TestCaseDetails } from './TestCaseDetails';

interface CriteriaResultsProps {
  criteria: { [key: string]: string };
  criteriaResults: { [criterion: string]: { [id: number]: TestCaseResult } };
  countsPerCriterion: { [key: string]: number };
  evaluationStarted: boolean;
  evaluationComplete: boolean;  // Added this prop
  activeCriterion?: string;
  evaluationId?: number;
  detailedResults?: { [key: number]: TestCaseDetailsType };
}

export const CriteriaResults: React.FC<CriteriaResultsProps> = ({
  criteria,
  criteriaResults,
  countsPerCriterion,
  evaluationStarted,
  evaluationComplete,  // Added this prop
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
    
    if (detailedResults && detailedResults[id]) {
      setTestCaseDetails(detailedResults[id]);
      return;
    }
    
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
    
    if (detailedResults && detailedResults[id]) {
      setTestCaseDetails(detailedResults[id]);
      return;
    }
    
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
    
    let criterionResults: { id: number | undefined; result: TestCaseResult }[] = [];
    
    if (Array.isArray(results)) {
      criterionResults = results.map((result, index) => ({
        id: index,
        result: result as TestCaseResult
      }));
    } else {
      const criterionIds = Object.keys(results).map(Number)
        .filter(id => results[id] !== undefined)
        .sort((a, b) => a - b);
      
      criterionResults = Array.from({ length: count }, (_, index) => ({
        id: criterionIds[index],
        result: criterionIds[index] !== undefined ? results[criterionIds[index]] : 'pending'
      }));
    }

    return (
      <Box sx={{ display: 'flex', mt: 1, mb: 1 }}>
        {criterionResults.map(({ id, result }, index) => (
          <Box 
            key={index} 
            onClick={() => id !== undefined && handleClick(id, criterion, result)}
            onMouseEnter={(e) => id !== undefined && handleHover(e, id, criterion, result)}
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
              cursor: id !== undefined ? 'pointer' : 'default',
              '&:hover': id !== undefined ? {
                transform: 'scale(1.05)',
                boxShadow: 2
              } : undefined
            }}
          />
        ))}
      </Box>
    );
  };

  const getPassCountForCriterion = (criterion: string) => {
    const results = criteriaResults[criterion];
    if (Array.isArray(results)) {
      return results.filter(result => result === 'pass').length;
    }
    return Object.values(results || {}).filter(result => result === 'pass').length;
  };

  const getCriterionCost = (criterion: string) => {
    if (!detailedResults) return 0;
    return Object.values(detailedResults)
      .filter(detail => detail.criterion === criterion)
      .reduce((sum, detail) => sum + (detail.evaluation_cost || 0) + (detail.scoring_cost || 0), 0);
  };

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
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="body1" sx={{ fontWeight: criterion === activeCriterion ? 600 : 500 }}>
              {index + 1}. {displayName}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Pass: {getPassCountForCriterion(criterion)}/{countsPerCriterion[criterion] || 5}
              </Typography>
              {evaluationComplete && (
                <Typography variant="body2" color="text.secondary">
                  Cost: ${getCriterionCost(criterion).toFixed(6)}
                </Typography>
              )}
            </Box>
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
                <Typography variant="body2" gutterBottom>{testCaseDetails.explanation}</Typography>
              )}
              {testCaseDetails.evaluation_cost !== undefined && testCaseDetails.scoring_cost !== undefined && (
                <Typography variant="body2" color="text.secondary">
                  Eval Cost: ${testCaseDetails.evaluation_cost.toFixed(6)}<br/>
                  Scoring Cost: ${testCaseDetails.scoring_cost.toFixed(6)}
                </Typography>
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