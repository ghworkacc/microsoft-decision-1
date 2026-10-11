export const DEMO_QUESTION = 'In what way has the customer\'s question been responded?';

export const DEMO_CHOICES = [
    'Answered',
    'Promised to answer',
    'Changed subject',
];

export const DEMO_STATE = [
    'Customer: I\'m having trouble setting up my model deployment.  It says "error - name included a reserved word"',
    'Agent: The default deployment unfortunately used a reserved word.  To work around the issue, you need to '
        + 'create a custom deployment and provide it an alternative name (e.g. \'msft-decidobot-threesixtyfive\').',
].join('\n');

export const initialFormState = {
    question: DEMO_QUESTION,
    choices: DEMO_CHOICES,
    state: DEMO_STATE,
};

export function decisionFormReducer(form, action) {
    switch (action.type) {
        case 'setQuestion':
            return { ...form, question: action.value };
        case 'setChoice':
            return {
                ...form,
                choices: form.choices.map((choice, i) => (i === action.index ? action.value : choice)),
            };
        case 'addChoice':
            return { ...form, choices: [...form.choices, ''] };
        case 'clearChoices':
            return { ...form, choices: [''] };
        case 'setState':
            return { ...form, state: action.value };
        default:
            throw new Error(`Unknown action: ${action.type}`);
    }
}
