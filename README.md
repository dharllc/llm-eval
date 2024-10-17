# LLM Evaluation Tool

## Problem Statement

Language models often struggle with accurately processing raw transcribed text from speech-to-text inputs. Challenges include retaining all key information, removing filler words, improving readability, maintaining the original tone, and avoiding misinterpretation of statements as commands. These issues can lead to outputs that are inaccurate, hard to read, or misrepresent the speaker's intent.

## Intent of the Evaluation

The purpose of this evaluation is to assess and enhance the performance of language models in processing speech-to-text transcriptions. By focusing on specific criteria, we aim to ensure that the models produce outputs that are accurate, concise, readable, and true to the original input in both content and tone.

## Scope of the Project

This project will evaluate language models based on five key criteria:

1. Retaining Key Information (Highest Priority)
2. Removing Filler Text
3. Improving Readability
4. Maintaining the Original Tone
5. Avoiding Misinterpretation of Statements as Commands

Each criterion is critical to the overall effectiveness of the language model in processing transcriptions and will be assessed using specific goals, failure cases, and examples.

## Configuration

The project uses a central configuration file `config.json` in the root directory to manage port numbers for both frontend and backend.

To change the port numbers:

1. Edit the `config.json` file in the root directory.
2. Update the `port` values for `frontend` and `backend` as needed.

## Running the Application

### First-time Setup

Before running the application for the first time or after making changes to the scripts, ensure that the start scripts are executable:

```bash
chmod +x start.sh
chmod +x backend/backend_start.sh
chmod +x frontend/frontend_start.sh
```

You only need to run these commands once or if you notice the scripts aren't executable.

### Starting the Application

To start both the backend and frontend with a single command, run the following from the root directory:

```bash
./start.sh
```

This script will:
1. Start the backend server
2. Wait for the backend to initialize
3. Start the frontend application

To stop the application, press `Ctrl+C` in the terminal where you started it.

## Development

When developing the frontend, the backend port is accessed through the environment variable `process.env.REACT_APP_BACKEND_PORT`. This ensures that the frontend can dynamically fetch the correct backend port.

For the backend, the configuration is read directly from the `config.json` file.

## Evaluation Criteria Details

### 1. Retaining Key Information (Highest Priority)

- **Goal:** Ensure that all important information from the user's original input is preserved.
- **Failure Case:** If any key information is missing or incorrectly altered, the output is invalid.

### 2. Removing Filler Text

- **Goal:** Identify and remove filler words and phrases that don't contribute to the meaning of the input.
- **Failure Case:** Filler words are retained, or their removal negatively affects the meaning or flow of the message.

### 3. Improving Readability

- **Goal:** Reformat the text to improve its readability by adding structure.
- **Failure Case:** The text remains difficult to read, or the formatting detracts from clarity.

### 4. Maintaining the Original Tone

- **Goal:** Ensure the model maintains the original tone and style of the speaker.
- **Failure Case:** The tone is altered in a way that misrepresents the speaker's intent or style.

### 5. Avoiding Misinterpretation of Statements as Commands

- **Goal:** Ensure that the model does not mistakenly interpret descriptive statements as commands.
- **Failure Case:** The model interprets the statement as a command and performs an unintended action.

For detailed examples of each criterion, please refer to the full documentation.