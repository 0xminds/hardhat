import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { HardhatError } from "@ignored/hardhat-vnext-errors";

import { resolveHardhatConfigPath } from "../../src/config.js";
import { createHardhatRuntimeEnvironment } from "../../src/hre.js";
import { builtinPlugins } from "../../src/internal/builtin-plugins/index.js";
import {
  getHardhatRuntimeEnvironmentSingleton,
  resetHardhatRuntimeEnvironmentSingleton,
  setHardhatRuntimeEnvironmentSingleton,
} from "../../src/internal/hre-singleton.js";
import { useFixtureProject } from "../helpers/project.js";

describe("HRE", () => {
  afterEach(() => {
    resetHardhatRuntimeEnvironmentSingleton();
  });

  describe("createHardhatRuntimeEnvironment", () => {
    it("should include the built-in plugins", async () => {
      const hre = await createHardhatRuntimeEnvironment({});

      assert.deepEqual(hre.config.plugins, builtinPlugins);
    });
  });

  describe("getHardhatRuntimeEnvironmentSingleton", () => {
    it("Should return undefined if it wasn't set", () => {
      assert.equal(getHardhatRuntimeEnvironmentSingleton(), undefined);
      assert.equal(getHardhatRuntimeEnvironmentSingleton(), undefined);
    });

    it("should return the same instance after it's set", async () => {
      const hre = await createHardhatRuntimeEnvironment({});
      setHardhatRuntimeEnvironmentSingleton(hre);

      const hre1 = getHardhatRuntimeEnvironmentSingleton();
      const hre2 = getHardhatRuntimeEnvironmentSingleton();

      assert.ok(hre1 === hre, "The instances are not the same");
      assert.ok(hre2 === hre, "The instances are not the same");
    });

    it("should include the builtin plugins", async () => {
      const hre = await createHardhatRuntimeEnvironment({});
      setHardhatRuntimeEnvironmentSingleton(hre);
      const singletonHre = getHardhatRuntimeEnvironmentSingleton();

      assert.ok(singletonHre === hre, "The instances are not the same");
      assert.deepEqual(singletonHre.config.plugins, builtinPlugins);
    });
  });

  describe("config loading", () => {
    describe("resolveConfigPath", async () => {
      it("should return the HARDHAT_CONFIG env variable if it is set", async () => {
        process.env.HARDHAT_CONFIG = "env.config.js";

        assert.equal(await resolveHardhatConfigPath(), "env.config.js");

        delete process.env.HARDHAT_CONFIG;
      });

      it("should throw if the config file is not found", async () => {
        await assert.rejects(
          resolveHardhatConfigPath(),
          new HardhatError(HardhatError.ERRORS.GENERAL.NO_CONFIG_FILE_FOUND),
        );
      });

      describe("javascript config", () => {
        describe("current dir", () => {
          useFixtureProject("config-js");

          it("should load a config file in the current directory", async () => {
            const configPath = await resolveHardhatConfigPath();

            assert(
              configPath.endsWith("hardhat.config.js"),
              `expected configPath to end with hardhat.config.js, but got ${configPath}`,
            );
          });
        });

        describe("nested dir", () => {
          useFixtureProject("config-js", "nested-folder");

          it("should load a config file in the parent directory", async () => {
            const configPath = await resolveHardhatConfigPath();

            assert(
              configPath.endsWith("hardhat.config.js"),
              `expected configPath to end with hardhat.config.js, but got ${configPath}`,
            );
          });
        });
      });

      describe("typescript config", () => {
        describe("current dir", () => {
          useFixtureProject("config-ts");

          it("should load a config file in the current directory", async () => {
            const configPath = await resolveHardhatConfigPath();

            assert(
              configPath.endsWith("hardhat.config.ts"),
              `expected configPath to end with hardhat.config.js, but got ${configPath}`,
            );
          });
        });

        describe("nested dir", () => {
          useFixtureProject("config-ts", "nested-folder");

          it("should load a config file in the parent directory", async () => {
            const configPath = await resolveHardhatConfigPath();

            assert(
              configPath.endsWith("hardhat.config.ts"),
              `expected configPath to end with hardhat.config.js, but got ${configPath}`,
            );
          });
        });
      });
    });

    describe("programmatic API", () => {
      useFixtureProject("loaded-config");

      it("should load the config file", async () => {
        const hre = await import("../../src/index.js");

        assert.deepEqual(hre.config.plugins, [
          ...builtinPlugins,
          { id: "test-plugin" },
        ]);
      });
    });
  });
});