import { existsSync } from "fs";
import { homedir } from "os";
import { describe, expect, it, vi } from "vitest";

vi.mock("fs", async (importOriginal) => {
    const actual = await importOriginal<typeof import("fs")>();
    return { ...actual, existsSync: vi.fn(actual.existsSync) };
});

vi.mock("../../src/utils", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../../src/utils")>();
    return { ...actual, spawnAsync: vi.fn() };
});

import {
    checkGitxInstallation,
    expandTilde,
    resolveGitxExecutable,
} from "../../src/gitManager/gitx";
import { spawnAsync } from "../../src/utils";

describe("checkGitxInstallation", () => {
    it("reports the version when gitx runs", async () => {
        vi.mocked(spawnAsync).mockResolvedValue({
            stdout: "gitx 0.1.0\n",
            stderr: "",
            code: 0,
            error: undefined,
        });

        await expect(checkGitxInstallation("gitx", {})).resolves.toEqual({
            installed: true,
            details: "gitx 0.1.0",
        });
        expect(vi.mocked(spawnAsync)).toHaveBeenCalledWith(
            "gitx",
            ["--version"],
            expect.objectContaining({ cwd: homedir() })
        );
    });

    it("reports a missing executable", async () => {
        vi.mocked(spawnAsync).mockResolvedValue({
            stdout: "",
            stderr: "",
            code: 1,
            error: new Error("spawn gitx ENOENT"),
        });

        await expect(checkGitxInstallation("gitx", {})).resolves.toEqual({
            installed: false,
            details: "spawn gitx ENOENT",
        });
    });

    it("reports a failing gitx run", async () => {
        vi.mocked(spawnAsync).mockResolvedValue({
            stdout: "",
            stderr: "gitx: error: pygit2 is not installed",
            code: 1,
            error: undefined,
        });

        await expect(checkGitxInstallation("gitx", {})).resolves.toEqual({
            installed: false,
            details: "gitx: error: pygit2 is not installed",
        });
    });
});

describe("resolveGitxExecutable", () => {
    it("returns the configured path when set", () => {
        expect(resolveGitxExecutable("  ~/.local/bin/gitx  ")).toBe(
            "~/.local/bin/gitx"
        );
    });

    it("falls back to the default install location when it exists", () => {
        vi.mocked(existsSync).mockReturnValue(true);
        expect(resolveGitxExecutable(undefined)).toBe(
            expandTilde("~/.local/bin/gitx")
        );
    });

    it("falls back to the PATH command when nothing exists", () => {
        vi.mocked(existsSync).mockReturnValue(false);
        expect(resolveGitxExecutable(undefined)).toBe("gitx");
    });
});
