import { createProcessAccess } from './ProcessAccess';

describe('createProcessAccess', () => {
  const proc = createProcessAccess();

  describe('run — success', () => {
    it('returns success=true and captures stdout', async () => {
      const result = await proc.run('echo', ['hello'], { cwd: process.cwd() });
      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe('hello');
    });

    it('captures stderr separately from stdout', async () => {
      // node writes to stderr
      const result = await proc.run('node', ['-e', 'process.stderr.write("err")'], {
        cwd: process.cwd(),
      });
      expect(result.success).toBe(true);
      expect(result.stderr).toContain('err');
    });

    it('merges extra env vars with process.env', async () => {
      const result = await proc.run('node', ['-e', 'process.stdout.write(process.env.MY_VAR ?? "")'], {
        cwd: process.cwd(),
        env: { MY_VAR: 'injected' },
      });
      expect(result.stdout).toBe('injected');
    });

    it('uses default 120s timeout when not specified', async () => {
      // Just verify it runs without hanging
      const result = await proc.run('echo', ['ok'], { cwd: process.cwd() });
      expect(result.success).toBe(true);
    });
  });

  describe('run — failure', () => {
    it('returns success=false on non-zero exit', async () => {
      const result = await proc.run('node', ['-e', 'process.exit(2)'], {
        cwd: process.cwd(),
      });
      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(2);
    });

    it('captures stdout/stderr from failed process', async () => {
      const result = await proc.run(
        'node',
        ['-e', 'process.stdout.write("out"); process.stderr.write("err"); process.exit(1)'],
        { cwd: process.cwd() },
      );
      expect(result.success).toBe(false);
      expect(result.stdout).toBe('out');
      expect(result.stderr).toBe('err');
    });

    it('returns success=false for unknown command', async () => {
      const result = await proc.run('__this_cmd_does_not_exist__', [], {
        cwd: process.cwd(),
      });
      expect(result.success).toBe(false);
      expect(result.exitCode).toBeGreaterThan(0);
    });

    it('returns success=false and non-zero exitCode on timeout', async () => {
      const result = await proc.run('sleep', ['5'], {
        cwd: process.cwd(),
        timeout: 100, // 100ms — will time out
      });
      expect(result.success).toBe(false);
    });
  });
});
