export type TestCaseResult = 'pending' | 'pass' | 'fail';

export interface TestCaseAnalysis {
  criteria: { [key: string]: string };
  counts_per_criterion: { [key: string]: number };
  total_test_cases: number;
}

export interface WebSocketMessage {
  type?: 'ping' | 'pong';
  stage?: 'evaluation' | 'completed' | 'error';
  total_progress?: string;
  criteria_progress?: {
    [criterion: string]: {
      total: number;
      processed: number;
    };
  };
  current_result?: {
    id: number;
    criterion: string;
    result: TestCaseResult;
  };
  error?: string;
  status?: string;
  message?: string;
}

export interface EvaluationSettings {
  temperature: number;
  system_prompt: string;
  evaluation_prompt_template: string;
  scoring_model?: string;
}