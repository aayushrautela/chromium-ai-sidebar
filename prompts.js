// prompts.js

function getSummaryPrompt(strength, title, content) {
    let lengthConstraint = '';
    switch (strength) {
        case 'short':
            lengthConstraint = 'a short paragraph';
            break;
        case 'medium':
            lengthConstraint = 'a few paragraphs';
            break;
        case 'full':
            lengthConstraint = 'a detailed summary';
            break;
        default:
            lengthConstraint = 'a medium-length summary';
    }

    return `Please provide ${lengthConstraint} of the following web page content. At the end, also provide two follow-up questions a user might ask.

    Return your response as a valid JSON object with the following structure:
    {
      "summary": "The summary of the content.",
      "followUpQuestions": [
        "Question 1?",
        "Question 2?"
      ]
    }

    Webpage Content to Analyze:
    Title: ${title}
    Content:
    ${content}`;
}