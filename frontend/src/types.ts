// frontend/src/types.ts
export type TestCaseResult = 'pending' | 'pass' | 'fail';

export interface TestCaseAnalysis {
  criteria: { [key: string]: string };
  counts_per_criterion: { [key: string]: number };
  total_test_cases: number;
}

export interface TestCaseDetails {
  id: number;
  input: string;
  description: string;
  output: string;
  result: TestCaseResult;
  explanation: string;
  criterion: string;
  prompt_tokens?: number;
  response_tokens?: number;
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
    evaluation_id?: number;
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

export interface Evaluation {
  id: number;
  timestamp: string;
  system_prompt: string;
  model_name: string;
  total_score: number;
  token_count: number;  
  total_tokens: number; 
  test_case_results: { [key: number]: TestCaseDetails };
  scores_by_criteria: {  
    [criterion: string]: TestCaseResult[];  
  }
}

export interface PaginatedEvaluations {
  evaluations: Evaluation[];
  total_count: number;
  page: number;
  pages: number;
}