import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatKeywords, parseKeywords, sanitizeKeywords } from './keywords.ts';

test('commas separate keywords', () => {
  assert.deepEqual(parseKeywords('lol, password'), ['lol', 'password']);
});

test('a phrase stays one keyword', () => {
  // Splitting on spaces would turn this into "kredi" and "kartı", neither of
  // which is what the person meant.
  assert.deepEqual(parseKeywords('kredi kartı'), ['kredi kartı']);
});

test('case and stray whitespace are normalised away', () => {
  assert.deepEqual(parseKeywords('  LOL ,  Şifre  '), ['lol', 'şifre']);
});

test('duplicates collapse', () => {
  assert.deepEqual(parseKeywords('lol, LOL, lol'), ['lol']);
});

test('empty parts are dropped rather than kept as blanks', () => {
  assert.deepEqual(parseKeywords(',, lol ,,'), ['lol']);
  assert.deepEqual(parseKeywords('   '), []);
  assert.deepEqual(parseKeywords(''), []);
});

test('newlines separate too, so a pasted list works', () => {
  assert.deepEqual(parseKeywords('lol\nşifre\nbanka'), ['lol', 'şifre', 'banka']);
});

test('a slip cannot be buried under keywords', () => {
  const many = parseKeywords(Array.from({ length: 40 }, (_, i) => `k${i}`).join(','));
  assert.equal(many.length, 8);
});

test('a single keyword cannot run away with the slip', () => {
  const [long] = parseKeywords('x'.repeat(200));
  assert.equal(long?.length, 24);
});

test('keywords round-trip through the field that edits them', () => {
  const keywords = parseKeywords('lol, kredi kartı, banka');
  assert.equal(formatKeywords(keywords), 'lol, kredi kartı, banka');
  assert.deepEqual(parseKeywords(formatKeywords(keywords)), keywords);
});

test('formatting nothing gives an empty field, not "undefined"', () => {
  assert.equal(formatKeywords(undefined), '');
  assert.equal(formatKeywords([]), '');
});

test('untrusted input is reduced to the same shape or dropped', () => {
  assert.deepEqual(sanitizeKeywords(['LOL', 'lol', '  ']), ['lol']);
  assert.equal(sanitizeKeywords([]), undefined);
  assert.equal(sanitizeKeywords(['   ']), undefined);
  assert.equal(sanitizeKeywords('lol'), undefined);
  assert.equal(sanitizeKeywords(undefined), undefined);
  assert.deepEqual(sanitizeKeywords([1, 'lol', null]), ['lol']);
});
