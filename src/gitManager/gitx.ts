import { existsSync } from "fs";
import { homedir } from "os";
import * as path from "path";
import { Platform } from "obsidian";
import { spawnAsync } from "../utils";

export interface GitxRunResult {
    stdout: string;
    stderr: string;
    code: number;
    error: Error | undefined;
}

/** Expands a leading `~` so the settings field accepts shell-style paths. */
export function expandTilde(filePath: string): string {
    if (filePath == "~") return homedir();
    if (filePath.startsWith("~/")) return homedir() + filePath.substring(1);
    return filePath;
}

/**
 * Resolves which gitx executable to run: the configured path when set,
 * otherwise the default install location when it exists, and finally a bare
 * `gitx` looked up on the PATH. GUI applications on macOS often run with a
 * PATH that excludes `~/.local/bin`, so trusting the PATH alone would miss
 * the location used by the install script.
 */
export function resolveGitxExecutable(
    configuredPath: string | null | undefined
): string {
    const configured = configuredPath?.trim();
    if (configured) return configured;
    if (!Platform.isWin) {
        const defaultInstall = expandTilde("~/.local/bin/gitx");
        if (existsSync(defaultInstall)) return defaultInstall;
    }
    return "gitx";
}

/**
 * Builds the environment for gitx, honoring the extra PATH paths from the
 * settings so a gitx installed outside the default PATH can be resolved by
 * name.
 */
export function buildGitxEnv(extraPathPaths: string[]): NodeJS.ProcessEnv {
    const envs = { ...process.env };
    if (extraPathPaths.length > 0) {
        envs["PATH"] =
            extraPathPaths.join(path.delimiter) + path.delimiter + envs["PATH"];
    }
    return envs;
}

/**
 * Runs the gitx CLI in the given repository directory. gitx transfers over
 * SSH via libgit2 without invoking the git binary, which avoids environments
 * that intercept `git push`.
 */
export async function runGitx(
    executable: string,
    args: string[],
    options: { cwd: string; env: NodeJS.ProcessEnv }
): Promise<GitxRunResult> {
    // Windows installs use a `.cmd` launcher, which requires a shell.
    return spawnAsync(expandTilde(executable), args, {
        cwd: options.cwd,
        env: options.env,
        shell: Platform.isWin,
    });
}

export interface GitxInstallationStatus {
    installed: boolean;
    /** The gitx version on success, or the failure reason. */
    details: string;
}

/**
 * Checks whether the gitx executable can be started by running
 * `gitx --version`. Used by the settings page to report the installation
 * status.
 */
export async function checkGitxInstallation(
    executable: string,
    env: NodeJS.ProcessEnv
): Promise<GitxInstallationStatus> {
    const result = await runGitx(executable, ["--version"], {
        cwd: homedir(),
        env,
    });
    if (result.error != undefined) {
        return { installed: false, details: result.error.message };
    }
    if (result.code !== 0) {
        const message = `${result.stderr}${result.stdout}`.trim();
        return {
            installed: false,
            details: message || `gitx exited with code ${result.code}.`,
        };
    }
    return { installed: true, details: result.stdout.trim() || "gitx" };
}
