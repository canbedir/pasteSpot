import assert from 'node:assert/strict';
import { test } from 'node:test';
import { detectKind, groupDigits, splitLink } from './detect.ts';

/**
 * Content typing is the feature the product is named for, and it is the easiest
 * thing to break with a small regex change. These are the real shapes people
 * paste, not synthetic ones.
 */
const cases: Array<[string, ReturnType<typeof detectKind>]> = [
  // codes: short, contains a digit, no lower case
  ['146704', 'code'],
  ['8712-4460', 'code'],
  ['TR33 0006 1005 1978 6457 8413 26', 'code'],
  ['ORDER-99312', 'code'],
  ['9789750736070', 'code'],
  ['0532 118 4470', 'code'],
  ['2026-0884', 'code'],
  ['AB12-CD34-EF56', 'code'],

  ['https://astro.build/blog/astro-5', 'link'],
  ['www.example.com/x', 'link'],
  ['http://localhost:4321/app', 'link'],

  // prose: lower case keeps these out of the code branch
  ['12 monkeys are waiting outside', 'text'],
  ['remember to call the courier tomorrow', 'text'],
  ['Kargo perşembe 14:00-18:00 arası', 'text'],
  ['Sennett — Zanaatkâr, ilk bölüm', 'text'],
  ['TODO', 'text'], // upper case but no digit
  ['', 'text'],
  ['   ', 'text'],
  // a URL with trailing words is a sentence about a link, not a link
  ['https://example.com and then some', 'text'],
];

for (const [input, expected] of cases) {
  test(`detectKind(${JSON.stringify(input)}) is ${expected}`, () => {
    assert.equal(detectKind(input), expected);
  });
}

test('splitLink separates host from path', () => {
  assert.deepEqual(splitLink('https://example.com/a/b'), {
    host: 'example.com',
    path: '/a/b',
  });
  assert.deepEqual(splitLink('https://example.com'), { host: 'example.com', path: '' });
  assert.deepEqual(splitLink('www.example.com/x'), { host: 'www.example.com', path: '/x' });
});

/**
 * Grouping is a rendering only. Getting it wrong is worse than not doing it, so
 * the exclusions matter more than the inclusions here.
 */
test('a card number and an IBAN are regrouped in fours', () => {
  assert.equal(groupDigits('4242424242424242'), '4242 4242 4242 4242');
  assert.equal(
    groupDigits('TR330006100519786457841326'),
    'TR33 0006 1005 1978 6457 8413 26',
  );
});

test('shapes that fours would get wrong are left alone', () => {
  // A Turkish mobile reads 0532 118 4470, not 0532 1184 470.
  assert.equal(groupDigits('05321184470'), null);
  // An ISBN reads 978-975-07-3607-0.
  assert.equal(groupDigits('9789750736070'), null);
  assert.equal(groupDigits('146704'), null);
});

test('anything already spaced is shown as it was pasted', () => {
  assert.equal(groupDigits('TR33 0006 1005 1978 6457 8413 26'), null);
  assert.equal(groupDigits('4242 4242 4242 4242'), null);
});

test('prose and codes with punctuation are never regrouped', () => {
  assert.equal(groupDigits('call the courier tomorrow at 14:00'), null);
  assert.equal(groupDigits('ORDER-99312'), null);
  assert.equal(groupDigits('AB12-CD34-EF56'), null);
  assert.equal(groupDigits('https://example.com/12345678901234'), null);
  assert.equal(groupDigits(''), null);
});

test('a grouped rendering never loses or adds a character', () => {
  const raw = 'TR330006100519786457841326';
  const grouped = groupDigits(raw);
  assert.equal(grouped?.replace(/ /g, ''), raw);
});
