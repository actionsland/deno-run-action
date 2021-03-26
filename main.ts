import { urlParse } from "https://deno.land/x/url_parse/mod.ts";
import { URLPattern } from "https://deno.land/x/url_pattern/mod.ts";
import {
  compile,
  match,
  parse,
  pathToRegexp,
} from "https://deno.land/x/path_to_regexp@v6.2.0/index.ts";

const DEFAULT_BRANCH = "main";
const GITHUB_RAW_DOMAIN = "raw.githubusercontent.com";
const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN");

type Options = {
  readonly script: Script;
  readonly flags?: string;
  readonly token?: string;
  readonly shouldCache: boolean;
};

type Script = {
  readonly isGitHub: boolean;
  readonly script: string;
  readonly domain: string;
  readonly owner?: string;
  readonly repo?: string;
  readonly ref?: string;
};

function getInput(name: string, fallback: string = ""): string {
  return Deno.env.get(`INPUT_${name.toUpperCase()}`) || fallback;
}

function getBooleanInput(name: string, fallback: boolean = false) {
  const input = getInput(name);

  return input === "true" ? true : input === "false" ? false : fallback;
}

function buildURLForGitHub(script: Script): string {
  return `https://${GITHUB_RAW_DOMAIN}/${script.owner}/${script.repo}/${script
    .ref || DEFAULT_BRANCH}/${script.script}`;
}

function parseScriptInput(script: string): Script {
  const info = match(":owner/:repo@:ref/:script")(script) ||
    match(":owner/:repo/:script")(script);

  if (!info) {
    const host = urlParse(script)?.host || "";

    return {
      script,
      domain: host,
      isGitHub: host.startsWith(GITHUB_RAW_DOMAIN),
    };
  }

  const { owner, repo, ref, script: scriptStr } = info.params as {
    owner: string;
    repo: string;
    ref?: string;
    script: string;
  };

  const scriptObj = {
    owner,
    repo,
    ref,
    script: scriptStr,
    isGitHub: true,
    domain: "",
  };

  return {
    ...scriptObj,
    domain: GITHUB_RAW_DOMAIN,
    script: buildURLForGitHub(scriptObj),
  };
}

function optionsFromInputs(): Options {
  const script = getInput("script");

  if (!script) {
    throw new Error('Argument "script" is required');
  }

  return {
    script: parseScriptInput(script),
    flags: getInput("flags"),
    token: getInput("token"),
    shouldCache: getBooleanInput("cache", true),
  };
}

async function run() {
  const options = optionsFromInputs();

  console.log("options", options);

  const authTokens = options.script.isGitHub
    ? `${options.token || GITHUB_TOKEN}@${options.script.domain}`
    : options.token
    ? `${options.token}@${options.script.domain}`
    : "";

  if (options.shouldCache) {
    const cacheProcess = Deno.run({
      cmd: ["deno", "cache", options.script.script],
      env: authTokens ? { "DENO_AUTH_TOKENS": authTokens } : {},
    });

    const { success, code } = await cacheProcess.status();

    if (!success) {
      Deno.exit(code);
    }
  }

  const mainProcess = Deno.run({
    cmd: ["deno", "run", options.script.script],
    env: authTokens ? { "DENO_AUTH_TOKENS": authTokens } : {},
  });

  const { code } = await mainProcess.status();

  Deno.exit(code);
}

if (import.meta.main) {
  await run();
}
