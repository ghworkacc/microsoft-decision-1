export const name = 'keep talking';

export const form = {
    questions: [
        {
            id: 'question-1',
            type: 'choice',
            instructions:
                'Which wire should be cut, based on the observed module and serial number?',
            choices: ['First', 'Second', 'Third', 'Fourth', 'None'],
        },
    ],
    state: [
        'Scenario: Keep Talking and Nobody Explodes, Version 1 standard Wires module.',
        'Only the top-left wiring puzzle from the bomb screenshot is in scope. Ignore every other module.',
        '',
        'Observed module: there are exactly four wires, ordered from top to bottom:',
        '1. black',
        '2. black',
        '3. blue',
        '4. black',
        '',
        'Serial Number: AFC3F2',
        '',
        'Manual: Wires can have 3-6 wires.',
        'Only the one correct wire needs to be cut to disarm the module.',
        'Wire ordering begins with the first on the top.',
        '',
        'Manual rules for 4 wires, evaluated in this order:',
        '- If there is more than one red wire and the last digit of the serial number is odd, cut the last red wire.',
        '- Otherwise, if the last wire is yellow and there are no red wires, cut the first wire.',
        '- Otherwise, if there is exactly one blue wire, cut the first wire.',
        '- Otherwise, if there is more than one yellow wire, cut the last wire.',
        '- Otherwise, cut the second wire.',
        '',
        'A later rule is considered only when every earlier rule is false. This module has one correct cut; there is no second wire-cutting pass after the module is disarmed.',
    ].join('\n'),
};
