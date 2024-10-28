# LLM Evaluation Tool Backend

## Configuration Files
- `backend_config.json`: Contains evaluation and scoring model settings
- `evaluation_test_cases.json`: Contains test cases for evaluating LLM performance
- `.env`: Environment variables (OpenAI API key)

## Database Management

### Database Structure
The SQLite database (`data/llm_eval.db`) contains the following tables:
- `evaluation_types`: Types of evaluations (e.g., speech-to-text)
- `criteria`: Evaluation criteria
- `test_cases`: Individual test cases
- `evaluations`: Individual evaluation runs
- `evaluation_results`: Results for each test case

### Common Operations

1. Update Test Cases:
```bash
cd backend
python update_test_cases.py
```
This updates test cases from `evaluation_test_cases.json`

2. Backup Database:
```bash
cp data/llm_eval.db data/llm_eval_backup_$(date +%Y%m%d_%H%M%S).db
```

3. Reset Database:
```bash
rm data/llm_eval.db
# Start the backend - it will recreate the database
python main.py
```

### Schema Updates
When updating the database schema:
1. Update model definitions in `database.py`
2. Delete the database file
3. Restart the backend to recreate with new schema

## Test Case Management

### Test Case Structure
Each test case in `evaluation_test_cases.json` requires:
- `id`: Unique identifier
- `input`: Test input text
- `criterion`: One of the predefined criteria
- `description`: Test case requirements

### Adding New Test Cases
1. Add entries to `evaluation_test_cases.json`
2. Run `update_test_cases.py`

## Server Management

### Starting the Server
```bash
cd backend
./backend_start.sh
# or
python main.py
```

### Configuration Updates
1. Modify `backend_config.json` for:
   - Evaluation model settings
   - Scoring model settings
   - System prompts
   - Evaluation templates
   - Criteria descriptions

2. Server will load new settings on restart

### Environment Variables
Required in `.env`:
```
OPENAI_API_KEY=your_api_key_here
```

## Troubleshooting

### Common Issues

1. Database Errors:
```bash
# Backup current database
cp data/llm_eval.db data/llm_eval_backup.db
# Delete and let it recreate
rm data/llm_eval.db
```

2. Test Case Updates Not Showing:
```bash
# Verify JSON syntax
python -m json.tool backend/evaluation_test_cases.json
# Run update script
python update_test_cases.py
```

3. Configuration Issues:
```bash
# Verify JSON syntax
python -m json.tool backend/backend_config.json
```

## Development Guidelines

1. Database Changes:
   - Always backup before schema changes
   - Update models in `database.py`
   - Test with a fresh database

2. Test Case Updates:
   - Keep descriptions specific and unambiguous
   - Maintain consistent criteria mapping
   - Use `update_test_cases.py` for changes

3. Configuration Updates:
   - Test prompt changes with a few examples first
   - Keep temperature at 0.0 for consistency
   - Document any prompt template changes