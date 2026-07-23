#!/usr/bin/env node
/**
 * Init governance submodule and sync to origin/main (floating latest).
 *
 * If git http.proxy points at a dead local proxy (common Clash port 7890),
 * retry once with proxy cleared for this process only — does not rewrite git config.
 * If remote sync still fails but a local governance tree exists, continue with
 * local sync + check so `npm run dev` can start offline; print a clear warning.
 */
import { access, constants } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const constitutionPath = path.join(repoRoot, "governance", "Constitution.md");

function runSubmoduleUpdate(extraGitConfig = []) {
  return spawnSync(
    "git",
    [...extraGitConfig, "submodule", "update", "--init", "--remote", "governance"],
    { cwd: repoRoot, stdio: "inherit" },
  );
}

async function hasLocalGovernance() {
  try {
    await access(constitutionPath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

let submodule = runSubmoduleUpdate();

if (submodule.status !== 0) {
  console.warn(
    "[bootstrap] submodule update failed; retrying once without http(s).proxy for this process…",
  );
  submodule = runSubmoduleUpdate([
    "-c",
    "http.proxy=",
    "-c",
    "https.proxy=",
  ]);
}

if (submodule.status !== 0) {
  if (!(await hasLocalGovernance())) {
    console.error(
      "[bootstrap] governance submodule fetch failed and no local governance/Constitution.md found.",
    );
    console.error(
      "  Hint: git config http.proxy may point at a stopped local proxy (e.g. 127.0.0.1:7890).",
    );
    console.error(
      "  Fix proxy, or: git -c http.proxy= -c https.proxy= submodule update --init --remote governance",
    );
    process.exit(submodule.status ?? 1);
  }
  console.warn(
    "[bootstrap] WARN: could not fetch origin/main for governance; using existing local checkout.",
  );
  console.warn(
    "  Dev may start, but governance is not guaranteed latest. Fix network/proxy when possible.",
  );
  console.warn(
    "  Common cause: git http.proxy → 127.0.0.1:7890 while the proxy is down.",
  );
}

const sync = spawnSync("node", ["scripts/governance/sync-governance.mjs"], {
  cwd: repoRoot,
  stdio: "inherit",
});

if (sync.status !== 0) {
  process.exit(sync.status ?? 1);
}

const check = spawnSync("node", ["scripts/governance/check-governance.mjs"], {
  cwd: repoRoot,
  stdio: "inherit",
});

process.exit(check.status ?? 1);
