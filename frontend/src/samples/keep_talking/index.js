export const name = 'keep talking';

export const form = {
    questions: [
        {
            id: 'question-1',
            type: 'choice',
            instructions: 'For the three-wire module in the upper-left, which wire should be cut?',
            choices: ['The first wire', 'The second wire', 'The last wire', 'The last blue wire'],
        },
        {
            id: 'question-2',
            type: 'choice',
            instructions:
                'For the blue button labeled HOLD in the upper-center, what should the defuser do?',
            choices: [
                'Press and immediately release it',
                'Hold it, then release when the countdown contains a 4',
                'Hold it, then release when the countdown contains a 1',
                'Hold it, then release when the countdown contains a 5',
            ],
        },
        {
            id: 'question-3',
            type: 'choice',
            instructions:
                'For the blue button labeled HOLD in the lower-left, what should the defuser do?',
            choices: [
                'Press and immediately release it',
                'Hold it, then release when the countdown contains a 4',
                'Hold it, then release when the countdown contains a 1',
                'Hold it, then release when the countdown contains a 5',
            ],
        },
        {
            id: 'question-4',
            type: 'choice',
            instructions:
                'What is the correct way to solve the four-symbol keypad module on the right?',
            choices: [
                'Press the symbols from left to right',
                'Press the symbols from top to bottom',
                'Find the column containing all four symbols, then press that column from top to bottom',
                'Press the symbol that appears twice first',
            ],
        },
        {
            id: 'question-5',
            type: 'choice',
            instructions:
                'What information is needed before solving the lower-right complicated-wires module?',
            choices: [
                'Only the number of modules already disarmed',
                'The serial number parity, whether the bomb has a parallel port, and whether it has at least two batteries',
                'The countdown timer and the color of the HOLD button',
                'Nothing; every wire should be cut',
            ],
        },
    ],
    state: [
        'Scenario: Keep Talking and Nobody Explodes, based on the attached bomb screenshot.',
        'The expert has the version 1 bomb defusal manual. The defuser can see the bomb; the expert must give instructions.',
        '',
        'Bomb layout, viewed from the front:',
        '- Upper-left module: a three-wire module. The visible wires are dark/black and blue; no red wire is visible.',
        '- Upper-center module: a blue button labeled HOLD. A translucent blue strip is visible above the button.',
        '- Upper-right module: a keypad with four different occult-looking symbols arranged in a 2 by 2 grid. The symbols are not named in this description.',
        '- Lower-left module: a second blue button labeled HOLD.',
        '- Lower-center: the main countdown timer and strike display.',
        '- Lower-right module: a complicated-wires module with multiple colored wires, including red, yellow, and black wires. The LEDs and star symbols are difficult to read from the screenshot.',
        '',
        'Bomb facts not visible in the screenshot: the serial number, its last digit parity, battery count, parallel-port presence, and lit indicators are unknown.',
        'Use the manual rules. Do not invent missing bomb facts; identify when the defuser must report additional information.',
    ].join('\n'),
};
