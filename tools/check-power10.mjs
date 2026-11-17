/**
 * Development-time Power of 10 checks for the game modules.
 * Not shipped to the browser. The walk uses an explicit stack with a fixed cap.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'acorn';

const ROOT = process.cwd();
const FILES = ['shared/power10.js', 'v1/game.js', 'v2/game.js'];
const MAX_NODES = 200000;
const EXEMPT = new Set(['assertThat']);
const FUNC_TYPES = new Set([
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression'
]);

function isNode(value) {
  return value !== null && typeof value === 'object' && typeof value.type === 'string';
}

function pushChildren(stack, node) {
  const keys = Object.keys(node);
  for (let i = keys.length - 1; i >= 0; i -= 1) {
    const key = keys[i];
    if (key === 'type' || key === 'start' || key === 'end' || key === 'loc' || key === 'range') {
      continue;
    }
    const child = node[key];
    if (Array.isArray(child)) {
      for (let j = child.length - 1; j >= 0; j -= 1) {
        if (isNode(child[j])) {
          stack.push(child[j]);
        }
      }
    } else if (isNode(child)) {
      stack.push(child);
    }
  }
}

function lineOf(source, index) {
  let line = 1;
  const stop = index < source.length ? index : source.length;
  for (let i = 0; i < stop; i += 1) {
    if (source.charCodeAt(i) === 10) {
      line += 1;
    }
  }
  return line;
}

function collect(root, source) {
  const funcs = [];
  const loops = [];
  const calls = [];
  const stack = [root];
  let seen = 0;
  while (stack.length > 0) {
    seen += 1;
    if (seen > MAX_NODES) {
      return { funcs, loops, calls, overflow: true };
    }
    const node = stack.pop();
    if (FUNC_TYPES.has(node.type)) {
      funcs.push(node);
    }
    if (node.type === 'ForStatement' || node.type === 'WhileStatement' || node.type === 'DoWhileStatement' || node.type === 'ForInStatement' || node.type === 'ForOfStatement') {
      loops.push(node);
    }
    if (node.type === 'CallExpression') {
      calls.push(node);
    }
    pushChildren(stack, node);
  }
  return { funcs, loops, calls, overflow: false, source };
}

function functionName(fn) {
  if (fn.id && fn.id.type === 'Identifier') {
    return fn.id.name;
  }
  return '';
}

function directAsserts(fn) {
  let count = 0;
  const stack = [fn.body];
  let seen = 0;
  while (stack.length > 0) {
    seen += 1;
    if (seen > MAX_NODES) {
      return -1;
    }
    const node = stack.pop();
    if (!isNode(node)) {
      continue;
    }
    if (node !== fn.body && FUNC_TYPES.has(node.type)) {
      continue;
    }
    if (node.type === 'CallExpression' && node.callee && node.callee.type === 'Identifier' && node.callee.name === 'assertThat') {
      count += 1;
    }
    pushChildren(stack, node);
  }
  return count;
}

function calleeNames(fn) {
  const names = [];
  const stack = [fn.body];
  let seen = 0;
  while (stack.length > 0) {
    seen += 1;
    if (seen > MAX_NODES) {
      break;
    }
    const node = stack.pop();
    if (!isNode(node)) {
      continue;
    }
    if (node !== fn.body && FUNC_TYPES.has(node.type)) {
      continue;
    }
    if (node.type === 'CallExpression' && node.callee && node.callee.type === 'Identifier') {
      names.push(node.callee.name);
    }
    pushChildren(stack, node);
  }
  return names;
}

function stepIsOne(update, name) {
  if (!update || !name) {
    return false;
  }
  if (update.type === 'UpdateExpression' && update.operator === '++' && update.argument && update.argument.type === 'Identifier' && update.argument.name === name) {
    return true;
  }
  if (update.type === 'AssignmentExpression' && update.operator === '+=' && update.left && update.left.type === 'Identifier' && update.left.name === name && update.right && update.right.type === 'Literal' && update.right.value === 1) {
    return true;
  }
  return false;
}

function boundOk(test) {
  if (!test || test.type !== 'BinaryExpression') {
    return false;
  }
  if (test.operator !== '<' && test.operator !== '<=') {
    return false;
  }
  if (!test.left || test.left.type !== 'Identifier') {
    return false;
  }
  const right = test.right;
  if (right && right.type === 'Literal' && typeof right.value === 'number' && Number.isFinite(right.value)) {
    return test.left.name;
  }
  if (right && right.type === 'Identifier' && /^[A-Z][A-Z0-9_]*$/.test(right.name)) {
    return test.left.name;
  }
  return false;
}

function findCycles(graph) {
  const state = new Map();
  const names = Array.from(graph.keys());
  const cycles = [];
  for (let n = 0; n < names.length; n += 1) {
    const start = names[n];
    if (state.get(start) === 2) {
      continue;
    }
    const stack = [{ name: start, index: 0 }];
    state.set(start, 1);
    let steps = 0;
    while (stack.length > 0) {
      steps += 1;
      if (steps > MAX_NODES) {
        cycles.push(start);
        break;
      }
      const top = stack[stack.length - 1];
      const edges = graph.get(top.name) || [];
      if (top.index >= edges.length) {
        state.set(top.name, 2);
        stack.pop();
        continue;
      }
      const next = edges[top.index];
      top.index += 1;
      const mark = state.get(next) || 0;
      if (mark === 1) {
        cycles.push(top.name + ' -> ' + next);
        continue;
      }
      if (mark === 0 && graph.has(next)) {
        state.set(next, 1);
        stack.push({ name: next, index: 0 });
      }
    }
  }
  return cycles;
}

function checkFunctions(rel, source, funcs, errors) {
  const known = new Set();
  let assertSum = 0;
  let counted = 0;
  for (let i = 0; i < funcs.length; i += 1) {
    const fn = funcs[i];
    const name = functionName(fn);
    const line = lineOf(source, fn.start);
    if (!name) {
      errors.push(rel + ':' + line + ' anonymous function is not allowed (rule 9)');
      continue;
    }
    known.add(name);
    if (EXEMPT.has(name)) {
      continue;
    }
    const asserts = directAsserts(fn);
    counted += 1;
    assertSum += asserts;
    if (asserts < 2) {
      errors.push(rel + ':' + line + ' ' + name + ' has ' + asserts + ' assertThat call(s); need at least 2');
    }
  }
  return { known, assertSum, counted };
}

function checkLoops(rel, source, loops, errors) {
  const sourceOk = assertSource(source);
  const listOk = assertSource(loops);
  if (!sourceOk || !listOk) {
    errors.push(rel + ': loop check missing source');
    return false;
  }
  for (let i = 0; i < loops.length; i += 1) {
    const loop = loops[i];
    const line = lineOf(source, loop.start);
    if (loop.type !== 'ForStatement') {
      errors.push(rel + ':' + line + ' unbounded loop form ' + loop.type + ' (rule 2)');
      continue;
    }
    const name = boundOk(loop.test);
    if (!name || !stepIsOne(loop.update, name)) {
      errors.push(rel + ':' + line + ' for-loop needs `i < CONSTANT` (or <=) and a +1 step (rule 2)');
    }
  }
  return true;
}

function assertSource(value) {
  return value !== null && value !== undefined;
}

function checkCalls(rel, source, calls, errors) {
  const sourceOk = assertSource(source);
  const listOk = assertSource(calls);
  if (!sourceOk || !listOk) {
    errors.push(rel + ': call check missing source');
    return false;
  }
  for (let i = 0; i < calls.length; i += 1) {
    const call = calls[i];
    const callee = call.callee;
    if (callee && callee.type === 'MemberExpression' && callee.computed === true) {
      errors.push(rel + ':' + lineOf(source, call.start) + ' computed call is not allowed (rule 9)');
    }
    if (callee && callee.type === 'Identifier' && callee.name === 'eval') {
      errors.push(rel + ':' + lineOf(source, call.start) + ' eval is not allowed (rule 8)');
    }
  }
  return true;
}

function buildGraph(funcs, known) {
  const graph = new Map();
  const funcsOk = assertSource(funcs);
  const knownOk = assertSource(known);
  if (!funcsOk || !knownOk) {
    return graph;
  }
  for (let i = 0; i < funcs.length; i += 1) {
    const fn = funcs[i];
    const name = functionName(fn);
    if (!name) {
      continue;
    }
    const edges = [];
    const called = calleeNames(fn);
    for (let c = 0; c < called.length; c += 1) {
      if (known.has(called[c])) {
        edges.push(called[c]);
      }
    }
    graph.set(name, edges);
  }
  return graph;
}

function checkFile(rel, errors, summary) {
  const full = path.join(ROOT, rel);
  const source = fs.readFileSync(full, 'utf8');
  let ast;
  try {
    ast = parse(source, { ecmaVersion: 2022, sourceType: 'module' });
  } catch (err) {
    errors.push(rel + ': parse error ' + (err instanceof Error ? err.message : 'unknown'));
    return;
  }
  const found = collect(ast, source);
  if (found.overflow) {
    errors.push(rel + ': syntax tree exceeded ' + MAX_NODES + ' nodes');
    return;
  }
  const countedFns = checkFunctions(rel, source, found.funcs, errors);
  const graph = buildGraph(found.funcs, countedFns.known);
  const cycles = findCycles(graph);
  for (let i = 0; i < cycles.length; i += 1) {
    errors.push(rel + ': recursion cycle ' + cycles[i] + ' (rule 1)');
  }
  checkLoops(rel, source, found.loops, errors);
  checkCalls(rel, source, found.calls, errors);
  const counted = countedFns.counted;
  const assertSum = countedFns.assertSum;
  const average = counted === 0 ? 0 : assertSum / counted;
  summary.push(rel + ': functions ' + counted + ', assertions ' + assertSum + ', average ' + average.toFixed(2) + ', min required 2');
}

function main() {
  const errors = [];
  const summary = [];
  for (let i = 0; i < FILES.length; i += 1) {
    checkFile(FILES[i], errors, summary);
  }
  for (let i = 0; i < summary.length; i += 1) {
    process.stdout.write(summary[i] + '\n');
  }
  if (errors.length > 0) {
    for (let i = 0; i < errors.length; i += 1) {
      process.stderr.write(errors[i] + '\n');
    }
    process.exitCode = 1;
    return;
  }
  process.stdout.write('Power of 10 structural checks passed.\n');
}

main();
