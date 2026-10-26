// A small reader for the YAML that skill files use: SKILL.md frontmatter and agents/openai.yaml.
// It needs no packages, so the scripts run in any repo with Node 20+. Supported: mappings and
// lists by indentation (spaces), `- key: value` list items, plain, single- and double-quoted
// scalars, true/false/null, numbers, `|` and `>` block scalars (blank lines inside them are
// dropped), and # comments. Anything else
// (flow collections, anchors, tags, multi-document files) throws a YamlSubsetError naming the
// line, rather than being misread.

export class YamlSubsetError extends Error {
  constructor(message, line) {
    super(line ? `line ${line}: ${message}` : message);
    this.line = line;
  }
}

const keyPattern = /^("(?:[^"\\]|\\.)*"|'(?:[^']|'')*'|[^\s"'#][^:#]*?)\s*:(?:\s+(.*))?$/;

/** Parses the YAML subset; returns a plain object, array or scalar. */
export function parseYamlSubset(text) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const entries = [];
  lines.forEach((raw, index) => {
    if (/^\s*(#.*)?$/.test(raw)) return;
    if (/^\t| \t/.test(raw.match(/^\s*/)?.[0] ?? ''))
      throw new YamlSubsetError('indent with spaces, not tabs', index + 1);
    if (/^(---|\.\.\.)\s*$/.test(raw))
      throw new YamlSubsetError('only one YAML document is supported', index + 1);
    entries.push({ indent: raw.length - raw.trimStart().length, text: raw.trim(), line: index + 1, raw });
  });
  if (!entries.length) return null;
  const [value, next] = parseBlock(entries, 0, entries[0].indent);
  if (next < entries.length)
    throw new YamlSubsetError('unexpected indentation', entries[next].line);
  return value;
}

function parseBlock(entries, start, indent) {
  return entries[start].text.startsWith('- ') || entries[start].text === '-'
    ? parseList(entries, start, indent)
    : parseMap(entries, start, indent);
}

function parseMap(entries, start, indent) {
  const map = {};
  let i = start;
  while (i < entries.length && entries[i].indent === indent) {
    const entry = entries[i];
    if (entry.text.startsWith('- '))
      throw new YamlSubsetError('a list item cannot follow mapping keys here', entry.line);
    const match = keyPattern.exec(entry.text);
    if (!match) throw new YamlSubsetError(`expected "key: value", found "${entry.text}"`, entry.line);
    const key = unquoteKey(match[1], entry.line);
    if (Object.hasOwn(map, key)) throw new YamlSubsetError(`duplicate key "${key}"`, entry.line);
    const rest = match[2] ?? '';
    i += 1;
    if (/^[|>][-+]?\s*(#.*)?$/.test(rest)) {
      const [value, next] = blockScalar(entries, i, indent, rest[0], rest[1] === '-');
      map[key] = value;
      i = next;
    } else if (rest === '' || rest.startsWith('#')) {
      if (i < entries.length && entries[i].indent > indent) {
        const [value, next] = parseBlock(entries, i, entries[i].indent);
        map[key] = value;
        i = next;
      } else if (
        i < entries.length &&
        entries[i].indent === indent &&
        entries[i].text.startsWith('- ')
      ) {
        // A list may sit at the same indent as its key.
        const [value, next] = parseList(entries, i, indent);
        map[key] = value;
        i = next;
      } else map[key] = null;
    } else map[key] = scalar(rest, entry.line);
  }
  if (i < entries.length && entries[i].indent > indent)
    throw new YamlSubsetError('unexpected indentation', entries[i].line);
  return [map, i];
}

function parseList(entries, start, indent) {
  const list = [];
  let i = start;
  while (i < entries.length && entries[i].indent === indent && /^-(\s|$)/.test(entries[i].text)) {
    const entry = entries[i];
    const content = entry.text.slice(1).trimStart();
    if (!content) {
      i += 1;
      if (i < entries.length && entries[i].indent > indent) {
        const [value, next] = parseBlock(entries, i, entries[i].indent);
        list.push(value);
        i = next;
      } else list.push(null);
      continue;
    }
    const column = indent + (entry.text.length - content.length);
    if (keyPattern.test(content)) {
      // `- key: value`: a mapping whose keys line up with the first key.
      const local = [{ ...entry, indent: column, text: content }, ...entries.slice(i + 1)];
      const [value, used] = parseMap(local, 0, column);
      list.push(value);
      i += used;
    } else {
      list.push(scalar(content, entry.line));
      i += 1;
    }
  }
  return [list, i];
}

function blockScalar(entries, start, parentIndent, style, strip) {
  const parts = [];
  let i = start;
  let indent;
  while (i < entries.length && entries[i].indent > parentIndent) {
    indent ??= entries[i].indent;
    parts.push(entries[i].raw.slice(indent));
    i += 1;
  }
  const text = style === '|' ? parts.join('\n') : parts.join(' ');
  return [strip ? text : `${text}\n`, i];
}

function unquoteKey(key, line) {
  return /^["']/.test(key) ? String(scalar(key, line)) : key.trim();
}

/** One scalar: quoted string, boolean, null, number or plain string (a trailing # comment is dropped). */
function scalar(raw, line) {
  const text = raw.trim();
  if (text.startsWith('"')) {
    const match = /^("(?:[^"\\]|\\.)*")\s*(#.*)?$/.exec(text);
    if (!match) throw new YamlSubsetError('unterminated or malformed double-quoted string', line);
    try {
      return JSON.parse(match[1]);
    } catch {
      throw new YamlSubsetError('unsupported escape in a double-quoted string', line);
    }
  }
  if (text.startsWith("'")) {
    const match = /^'((?:[^']|'')*)'\s*(#.*)?$/.exec(text);
    if (!match) throw new YamlSubsetError('unterminated single-quoted string', line);
    return match[1].replace(/''/g, "'");
  }
  if (/^[[{&*!%@`]/.test(text))
    throw new YamlSubsetError(`unsupported YAML (${text[0]}); write a plain or quoted value`, line);
  const plain = text.replace(/\s+#.*$/, '').trim();
  if (plain === 'true') return true;
  if (plain === 'false') return false;
  if (plain === 'null' || plain === '~' || plain === '') return null;
  if (/^-?\d+(\.\d+)?$/.test(plain)) return Number(plain);
  return plain;
}

/** A double-quoted YAML string (JSON string syntax is valid YAML). */
export const quoteYaml = (value) => JSON.stringify(value);
