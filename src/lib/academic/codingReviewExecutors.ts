export interface ExecutionResult {
  stdout: string;
  stderr: string;
  error?: {
    type: string;
    message: string;
    line?: number;
  };
  executionTime: number;
}

type PyodideInterface = {
  runPythonAsync: (code: string) => Promise<unknown>;
  runPython?: (code: string) => unknown;
  setStdout?: (options: { batched: (text: string) => void }) => unknown;
  setStderr?: (options: { batched: (text: string) => void }) => unknown;
  loadPackage?: (name: string) => Promise<void>;
};

let pyodidePromise: Promise<PyodideInterface> | null = null;

async function loadPyodideFromCdn(): Promise<PyodideInterface> {
  if (typeof window === "undefined") {
    throw new Error("Pyodide can only run in the browser.");
  }

  if (typeof (window as any).loadPyodide !== "function") {
    await new Promise<void>((resolve, reject) => {
      const existing = document.getElementById("pyodide-loader");
      if (existing) {
        existing.addEventListener("load", () => resolve());
        existing.addEventListener("error", () =>
          reject(new Error("Failed to load Pyodide script."))
        );
        return;
      }
      const script = document.createElement("script");
      script.id = "pyodide-loader";
      script.src = "https://cdn.jsdelivr.net/pyodide/v0.25.1/full/pyodide.js";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () =>
        reject(new Error("Failed to load Pyodide script."));
      document.head.appendChild(script);
    });
  }

  const loader = (window as any).loadPyodide as (options: {
    indexURL: string;
  }) => Promise<PyodideInterface>;

  return loader({
    indexURL: "https://cdn.jsdelivr.net/pyodide/v0.25.1/full/",
  });
}

async function getPyodide(): Promise<PyodideInterface> {
  if (!pyodidePromise) {
    pyodidePromise = loadPyodideFromCdn();
  }
  return pyodidePromise;
}

export const PythonExecutor = {
  async execute(code: string, timeoutMs = 10000): Promise<ExecutionResult> {
    const pyodide = await getPyodide();
    const stdoutChunks: string[] = [];
    const stderrChunks: string[] = [];
    const start = performance.now();

    const setStdout = (pyodide as any).setStdout?.bind(pyodide);
    const setStderr = (pyodide as any).setStderr?.bind(pyodide);
    const restoreStdout = setStdout
      ? setStdout({ batched: (text: string) => stdoutChunks.push(text) })
      : null;
    const restoreStderr = setStderr
      ? setStderr({ batched: (text: string) => stderrChunks.push(text) })
      : null;

    let error: ExecutionResult["error"];
    try {
      const execution = pyodide.runPythonAsync(code);
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Execution timeout")), timeoutMs)
      );
      await Promise.race([execution, timeout]);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      error = {
        type: err instanceof Error ? err.name : "Error",
        message,
      };
    } finally {
      if (restoreStdout && typeof restoreStdout === "function") {
        restoreStdout();
      }
      if (restoreStderr && typeof restoreStderr === "function") {
        restoreStderr();
      }
    }

    const executionTime = Math.round(performance.now() - start);
    return {
      stdout: stdoutChunks.join(""),
      stderr: stderrChunks.join(""),
      error,
      executionTime,
    };
  },

  async loadPackage(name: string) {
    const pyodide = await getPyodide();
    if (typeof (pyodide as any).loadPackage === "function") {
      await (pyodide as any).loadPackage(name);
    }
  },

  async reset() {
    const pyodide = await getPyodide();
    if (typeof (pyodide as any).runPython === "function") {
      (pyodide as any).runPython("globals().clear()");
    }
  },
};

type SqlJsModule = {
  Database: new (data?: Uint8Array) => SqlJsDatabase;
};

type SqlJsDatabase = {
  exec: (sql: string) => Array<{ columns: string[]; values: any[][] }>;
  close: () => void;
};

let sqlModulePromise: Promise<SqlJsModule> | null = null;
let sqlDatabase: SqlJsDatabase | null = null;

async function getSqlModule(): Promise<SqlJsModule> {
  if (typeof window === "undefined") {
    throw new Error("SQL.js can only run in the browser.");
  }
  if (!sqlModulePromise) {
    const initSqlJs = (await import("sql.js")).default;
    sqlModulePromise = initSqlJs({
      locateFile: () => "https://sql.js.org/dist/sql-wasm.wasm",
    }) as Promise<SqlJsModule>;
  }
  return sqlModulePromise;
}

export const SqlExecutor = {
  async loadDatabase(sqlSchema: string) {
    const module = await getSqlModule();
    if (sqlDatabase) {
      sqlDatabase.close();
    }
    sqlDatabase = new module.Database();
    if (sqlSchema.trim()) {
      sqlDatabase.exec(sqlSchema);
    }
  },

  async execute(query: string): Promise<{
    columns: string[];
    rows: any[][];
    rowCount: number;
    error?: string;
    executionTime: number;
  }> {
    const module = await getSqlModule();
    if (!sqlDatabase) {
      sqlDatabase = new module.Database();
    }

    const start = performance.now();
    try {
      const results = sqlDatabase.exec(query);
      const first = results[0];
      const executionTime = Math.round(performance.now() - start);
      if (!first) {
        return { columns: [], rows: [], rowCount: 0, executionTime };
      }
      return {
        columns: first.columns,
        rows: first.values,
        rowCount: first.values.length,
        executionTime,
      };
    } catch (err) {
      const executionTime = Math.round(performance.now() - start);
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        error: err instanceof Error ? err.message : String(err),
        executionTime,
      };
    }
  },

  async reset() {
    if (sqlDatabase) {
      sqlDatabase.close();
      sqlDatabase = null;
    }
  },
};

type JsExecutionResult = {
  consoleOutput: string[];
  returnValue?: unknown;
  error?: {
    type: string;
    message: string;
    line?: number;
  };
  domSnapshot?: string;
  executionTime: number;
};

let jsIframe: HTMLIFrameElement | null = null;
let jsRequestId = 0;
const jsPending = new Map<
  number,
  { resolve: (value: JsExecutionResult) => void; reject: (err: Error) => void }
>();

function ensureJsIframe() {
  if (jsIframe || typeof window === "undefined") return;
  jsIframe = document.createElement("iframe");
  jsIframe.setAttribute("sandbox", "allow-scripts");
  jsIframe.style.display = "none";
  jsIframe.srcdoc = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
  </head>
  <body>
    <script>
      window.addEventListener('message', async (event) => {
        const payload = event.data || {};
        if (!payload || payload.type !== 'EXECUTE_JS') return;
        const { id, code, html } = payload;
        const logs = [];
        const originalLog = console.log;
        console.log = (...args) => logs.push(args.map(String).join(' '));
        const start = performance.now();
        let error = null;
        let returnValue;
        try {
          if (typeof html === 'string') {
            document.body.innerHTML = html;
          }
          returnValue = Function(code)();
        } catch (err) {
          error = {
            type: err && err.name ? err.name : 'Error',
            message: err && err.message ? err.message : String(err),
          };
        } finally {
          console.log = originalLog;
        }
        const executionTime = Math.round(performance.now() - start);
        const domSnapshot = document.body.innerHTML;
        parent.postMessage({
          type: 'EXECUTE_JS_RESULT',
          id,
          consoleOutput: logs,
          returnValue,
          error,
          domSnapshot,
          executionTime,
        }, '*');
      });
    </script>
  </body>
</html>`;
  document.body.appendChild(jsIframe);

  window.addEventListener("message", (event) => {
    const payload = event.data || {};
    if (payload.type !== "EXECUTE_JS_RESULT") return;
    const handler = jsPending.get(payload.id);
    if (!handler) return;
    jsPending.delete(payload.id);
    handler.resolve({
      consoleOutput: payload.consoleOutput || [],
      returnValue: payload.returnValue,
      error: payload.error || undefined,
      domSnapshot: payload.domSnapshot,
      executionTime: payload.executionTime || 0,
    });
  });
}

async function runJs(code: string, html?: string): Promise<JsExecutionResult> {
  if (typeof window === "undefined") {
    throw new Error("JavaScript execution can only run in the browser.");
  }
  ensureJsIframe();
  const id = ++jsRequestId;
  const message = { type: "EXECUTE_JS", id, code, html };

  const promise = new Promise<JsExecutionResult>((resolve, reject) => {
    jsPending.set(id, { resolve, reject });
    setTimeout(() => {
      if (jsPending.has(id)) {
        jsPending.delete(id);
        reject(new Error("Execution timeout"));
      }
    }, html ? 10000 : 5000);
  });

  jsIframe?.contentWindow?.postMessage(message, "*");
  return promise;
}

export const JsExecutor = {
  execute: (code: string) => runJs(code),
  executeWithDOM: (code: string, html: string) => runJs(code, html),
  reset: () => {
    if (jsIframe) {
      jsIframe.remove();
      jsIframe = null;
    }
    jsPending.clear();
  },
};
