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
  input_model?: string;
  output_model?: string;
  evaluation_cost?: number;
  scoring_cost?: number;
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
    cost?: number;
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

export interface ModelCosts {
  input: number;
  output: number;
}

export interface ModelProvider {
  [model: string]: ModelCosts;
}

export interface ModelConfig {
  models: {
    [provider: string]: ModelProvider;
  };
  current: {
    evaluation_model: string;
    scoring_model: string;
  };
  default: {
    evaluation_model: string;
    scoring_model: string;
  };
}

export interface Evaluation {
  id: number;
  timestamp: string;
  system_prompt: string;
  model_name: string;
  scoring_model: string;
  total_score: number;
  total_tokens: number;
  total_cost: number;
  test_case_results: { [key: number]: TestCaseDetails };
  scores_by_criteria: {
    [criterion: string]: {
      pass_count: number;
      total_count: number;
      cost: number;
    };
  };
}

export interface PaginatedEvaluations {
  evaluations: Evaluation[];
  total_count: number;
  page: number;
  pages: number;
}