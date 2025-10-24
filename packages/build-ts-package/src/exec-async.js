import { spawn } from 'node:child_process';

/**
 * @typedef {Object} ExecAsyncOpts
 * @property {string} cwd
 * @property {'inherit' | 'ignore' | 'pipe'} stdio
 * @property {boolean} [verbose=false]
 */

/**
 * Executes a command asynchronously via spawn.
 * @param {string} command 
 * @param {ExecAsyncOpts} opts
 */
export function execAsync(
  command,
  { verbose = process.env.LETS_VERSION_VERBOSE === 'true' || false, ...opts },
) {
  if (verbose) console.info('Executing', command, 'in', opts.cwd);

  const [cmd, ...args] = command.split(/\s+/);

  if (!cmd) throw new Error('unable to spawn because no command was given');

  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, opts);

    let errBuffer = Buffer.alloc(0);
    let stdoutBuffer = Buffer.alloc(0);

    /** @type {Error | null} */
    let error = null;
    child.on('error', err => {
      error = err;
    });
    child.stderr?.on('data', data => {
      errBuffer = Buffer.concat([errBuffer, data]);
    });

    child.stdout?.on('data', data => {
      stdoutBuffer = Buffer.concat([stdoutBuffer, data]);
    });

    child.once('exit', code => {
      if (code) {
        const errMsg = errBuffer.toString('utf-8');
        console.error(errMsg);

        if (error) {
          return reject(error);
        }
        return reject(new Error(errMsg));
      }

      const output = stdoutBuffer.toString('utf-8');
      return resolve(output);
    });
  });
}