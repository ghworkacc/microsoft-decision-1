export const name = 'support judge';

export const form = {
    questions: [
        {
            id: 'question-1',
            type: 'choice',
            instructions: "In what way has the customer's question been responded?",
            choices: ['Answered', 'Promised to answer', 'Changed subject'],
        },
        {
            id: 'question-2',
            type: 'noul',
            instructions: 'Did the agent provide a workaround for the customer?',
            choices: [],
        },
        {
            id: 'question-3',
            type: 'score',
            instructions: 'How satisfied is the customer likely to be?',
            choices: [
                'Very dissatisfied',
                'Dissatisfied',
                'Neutral',
                'Satisfied',
                'Very satisfied',
            ],
        },
        {
            id: 'question-4',
            type: 'score',
            instructions: 'How satisfied is the customer likely to be?',
            choices: ['Dissatisfied', 'Satisfied'],
        },
    ],
    state: [
        'Customer: I\'m having trouble setting up my model deployment.  It says "error - name included a reserved word"',
        'Agent: The default deployment unfortunately used a reserved word.  To work around the issue, you need to ' +
            "create a custom deployment and provide it an alternative name (e.g. 'msft-decidobot-threesixtyfive').",
    ].join('\n'),
};

export const DEMO_QUESTION = form.questions[0].instructions;
export const DEMO_CHOICES = form.questions[0].choices;
export const DEMO_QUESTIONS = form.questions;
export const DEMO_STATE = form.state;
