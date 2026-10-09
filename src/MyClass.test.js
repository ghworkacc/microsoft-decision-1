import { expect, test } from 'vitest'

import MyClass from './MyClass.js'

test('it works', () => {
  const myClass = new MyClass();

  const output = myClass.speak();

  expect(output).toBe("hello from my class");
});
