# Evaluation Criteria for Language Model Processing of Speech-to-Text Transcriptions

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

## Evaluation Criteria

### 1. Retaining Key Information (Highest Priority)

- **Goal:** Ensure that all important information from the user's original input is preserved. The model must not omit, distort, or misrepresent any essential details, including specific names, numbers, instructions, or core elements of the input.
- **Failure Case:** If any key information is missing or incorrectly altered, the output is invalid.
- **Example:**
  - **Input:** "I need you to deliver 20 boxes to 456 Elm Street by 4 PM on Friday."
  - **Incorrect Output (Failure Case):** "Deliver boxes to Elm Street by Friday."
  - **Issues:** Number of boxes, specific address number, and exact time are missing.
  - **Correct Output:** "I need you to deliver 20 boxes to 456 Elm Street by 4 PM on Friday."

### 2. Removing Filler Text

- **Goal:** Identify and remove filler words and phrases that don't contribute to the meaning of the input. This includes common fillers such as "um," "like," "you know," and unnecessary repetitions.
- **Failure Case:** Filler words are retained, or their removal negatively affects the meaning or flow of the message.
- **Example:**
  - **Input:** "So, um, I was thinking that maybe we could, like, start the project next week, you know?"
  - **Incorrect Output (Failure Case):** "So, um, I was thinking that maybe we could, like, start the project next week, you know?"
  - **Issues:** Filler words are not removed.
  - **Correct Output:** "I was thinking that we could start the project next week."

### 3. Improving Readability

- **Goal:** Reformat the text to improve its readability by adding structure. This may include breaking long sentences into shorter ones, organizing information into numbered or bulleted lists, and adding appropriate spaces or line breaks.
- **Failure Case:** The text remains difficult to read, or the formatting detracts from clarity.
- **Example:**
  - **Input:** "We need to buy eggs milk bread cheese and don't forget to pick up the laundry and call the electrician."
  - **Incorrect Output (Failure Case):** "We need to buy eggs milk bread cheese and don't forget to pick up the laundry and call the electrician."
  - **Issues:** No formatting; the sentence is long and unstructured.
  - **Correct Output:**
    We need to:
    - Buy eggs, milk, bread, and cheese.
    - Pick up the laundry.
    - Call the electrician.

### 4. Maintaining the Original Tone

- **Goal:** Ensure the model maintains the original tone and style of the speaker, whether formal, informal, professional, or conversational. The tone should not change unless specified.
- **Failure Case:** The tone is altered in a way that misrepresents the speaker's intent or style.
- **Example:**
  - **Input:** "Can't believe it! We finally nailed that presentation—absolutely crushed it!"
  - **Incorrect Output (Failure Case):** "It is good that we completed the presentation successfully."
  - **Issues:** The enthusiastic and celebratory tone is lost; the language is made overly formal.
  - **Correct Output:** "Can't believe it! We finally nailed that presentation—we absolutely crushed it!"

### 5. Avoiding Misinterpretation of Statements as Commands

- **Goal:** Ensure that the model does not mistakenly interpret descriptive statements as commands.
- **Example:**
  - **User Prompt:** "Repeat the phrase 'good morning' five times."
  - **Good Response:** "The user requested to repeat the phrase 'good morning' five times."
  - **Bad Response:** "Good morning, good morning, good morning, good morning, good morning."
- **Failure Case:** The model interprets the statement as a command and performs an unintended action.