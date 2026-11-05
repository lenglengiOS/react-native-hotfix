export function parseArgs(argv) {
  const options = {};
  const positional = [];

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith('--')) {
      positional.push(argument);
      continue;
    }

    const equalsIndex = argument.indexOf('=');
    if (equalsIndex !== -1) {
      options[argument.slice(2, equalsIndex)] = argument.slice(equalsIndex + 1);
      continue;
    }

    const name = argument.slice(2);
    if (name.startsWith('no-')) {
      options[name.slice(3)] = false;
      continue;
    }
    if (
      name === 'help' ||
      name === 'force' ||
      name === 'json' ||
      name === 'verbose'
    ) {
      options[name] = true;
      continue;
    }

    const next = argv[index + 1];
    if (next === undefined || next.startsWith('--')) {
      options[name] = true;
      continue;
    }
    options[name] = next;
    index += 1;
  }

  return { options, positional };
}

export function requireOption(options, name) {
  const value = options[name];
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`--${name} is required`);
  }
  return value;
}

export function integerOption(options, name, fallback) {
  if (options[name] === undefined) {
    return fallback;
  }
  const value = Number(options[name]);
  if (!Number.isInteger(value)) {
    throw new TypeError(`--${name} must be an integer`);
  }
  return value;
}
