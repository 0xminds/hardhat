import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { HardhatError } from "@nomicfoundation/hardhat-errors";

import { ParameterType } from "../../../src/config.js";
import { createHardhatRuntimeEnvironment } from "../../../src/index.js";
import { buildGlobalParameterDefinition } from "../../../src/internal/global-parameters.js";
import {
  EmptyTaskDefinitionBuilderImplementation,
  NewTaskDefinitionBuilderImplementation,
  TaskOverrideDefinitionBuilderImplementation,
} from "../../../src/internal/tasks/builders.js";
import { TaskDefinitionType } from "../../../src/types/tasks.js";

/**
 * There is a circular dependency between the TaskManagerImplementation and the
 * HardhatRuntimeEnvironmentImplementation. The TaskManagerImplementation needs
 * the HardhatRuntimeEnvironmentImplementation to be created, and the
 * HardhatRuntimeEnvironmentImplementation creates the TaskManagerImplementation.
 *
 * The way to test the TaskManagerImplementation is through the
 * HardhatRuntimeEnvironmentImplementation, as it's the one that creates the
 * TaskManagerImplementation.
 */
describe("TaskManagerImplementation", () => {
  it("should initialize the task manager with an empty set of tasks if no plugins or tasks are provided", async () => {
    const hre = await createHardhatRuntimeEnvironment({});

    assert.equal(hre.tasks.rootTasks.size, 0);
  });

  it("should initialize the task manager with the tasks from the plugins", async () => {
    const hre = await createHardhatRuntimeEnvironment({
      plugins: [
        {
          id: "plugin1",
          tasks: [
            new NewTaskDefinitionBuilderImplementation("task1")
              .addNamedParameter({ name: "param1" })
              .setAction(() => {})
              .build(),
            new NewTaskDefinitionBuilderImplementation("task2")
              .addFlag({ name: "flag1" })
              .setAction(() => {})
              .build(),
          ],
          globalParameters: [
            buildGlobalParameterDefinition({
              name: "globalParam1",
              description: "",
              parameterType: ParameterType.STRING,
              defaultValue: "",
            }),
          ],
        },
        {
          id: "plugin2",
          tasks: [
            new NewTaskDefinitionBuilderImplementation("task3")
              .addPositionalParameter({ name: "posParam1" })
              .addVariadicParameter({ name: "varParam1" })
              .setAction(() => {})
              .build(),
          ],
        },
      ],
    });

    // task1 in plugin1 should be available
    const task1 = hre.tasks.getTask("task1");
    assert.deepEqual(task1.id, ["task1"]);
    assert.equal(task1.pluginId, "plugin1");

    // task2 in plugin1 should be available
    const task2 = hre.tasks.getTask("task2");
    assert.deepEqual(task2.id, ["task2"]);
    assert.equal(task2.pluginId, "plugin1");

    // task3 in plugin2 should be available
    const task3 = hre.tasks.getTask("task3");
    assert.deepEqual(task3.id, ["task3"]);
    assert.equal(task3.pluginId, "plugin2");

    // task1, task2 and task3 should be root tasks
    assert.equal(hre.tasks.rootTasks.size, 3);
    assert.deepEqual(hre.tasks.rootTasks.get("task1")?.id, ["task1"]);
    assert.deepEqual(hre.tasks.rootTasks.get("task2")?.id, ["task2"]);
    assert.deepEqual(hre.tasks.rootTasks.get("task3")?.id, ["task3"]);
  });

  it("should initialize the task manager with the tasks from the config", async () => {
    const hre = await createHardhatRuntimeEnvironment({
      tasks: [
        new NewTaskDefinitionBuilderImplementation("task1")
          .addNamedParameter({ name: "param1" })
          .setAction(() => {})
          .build(),
        new NewTaskDefinitionBuilderImplementation("task2")
          .addFlag({ name: "flag1" })
          .setAction(() => {})
          .build(),
        new NewTaskDefinitionBuilderImplementation("task3")
          .addPositionalParameter({ name: "posParam1" })
          .addVariadicParameter({ name: "varParam1" })
          .setAction(() => {})
          .build(),
      ],
    });

    // task1 in plugin1 should be available
    const task1 = hre.tasks.getTask("task1");
    assert.deepEqual(task1.id, ["task1"]);
    assert.equal(task1.pluginId, undefined);

    // task2 in plugin1 should be available
    const task2 = hre.tasks.getTask("task2");
    assert.deepEqual(task2.id, ["task2"]);
    assert.equal(task2.pluginId, undefined);

    // task3 in plugin2 should be available
    const task3 = hre.tasks.getTask("task3");
    assert.deepEqual(task3.id, ["task3"]);
    assert.equal(task3.pluginId, undefined);

    // task1, task2 and task3 should be root tasks
    assert.equal(hre.tasks.rootTasks.size, 3);
    assert.deepEqual(hre.tasks.rootTasks.get("task1")?.id, ["task1"]);
    assert.deepEqual(hre.tasks.rootTasks.get("task2")?.id, ["task2"]);
    assert.deepEqual(hre.tasks.rootTasks.get("task3")?.id, ["task3"]);
  });

  it("should override a task within the same plugin", async () => {
    const hre = await createHardhatRuntimeEnvironment({
      plugins: [
        {
          id: "plugin1",
          tasks: [
            new NewTaskDefinitionBuilderImplementation("task1")
              .setDescription("description1")
              .addNamedParameter({ name: "param1" })
              .addFlag({ name: "flag1" })
              .addPositionalParameter({ name: "posParam1" })
              .addVariadicParameter({ name: "varParam1" })
              .setAction(() => {})
              .build(),
            // overriding task1 with a new description and parameters
            new TaskOverrideDefinitionBuilderImplementation("task1")
              .setDescription("description2")
              .addNamedParameter({ name: "param2" })
              .addFlag({ name: "flag2" })
              .setAction(() => {})
              .build(),
          ],
        },
      ],
    });

    const task1 = hre.tasks.getTask("task1");
    assert.deepEqual(task1.id, ["task1"]);
    assert.equal(task1.pluginId, "plugin1");
    assert.equal(task1.description, "description2");
    // Original params should have not been removed
    assert.ok(task1.namedParameters.get("param1"), "Should have param1");
    assert.ok(task1.namedParameters.get("flag1"), "Should have flag1");
    assert.ok(
      task1.positionalParameters.some((p) => p.name === "posParam1"),
      "Should have posParam1",
    );
    assert.ok(
      task1.positionalParameters.some((p) => p.name === "posParam1"),
      "Should have varParam1",
    );
    // New params should be added by the overrides
    assert.ok(task1.namedParameters.get("param2"), "Should have param2");
    assert.ok(task1.namedParameters.get("flag2"), "Should have flag2");
    // Should have 2 actions
    assert.equal(task1.actions.length, 2);
    assert.equal(task1.actions[0].pluginId, "plugin1");
    assert.equal(task1.actions[1].pluginId, "plugin1");
  });

  it("should override a task from a different plugin", async () => {
    const hre = await createHardhatRuntimeEnvironment({
      plugins: [
        {
          id: "plugin1",
          tasks: [
            new NewTaskDefinitionBuilderImplementation("task1")
              .setDescription("description1")
              .addNamedParameter({ name: "param1" })
              .addFlag({ name: "flag1" })
              .addPositionalParameter({ name: "posParam1" })
              .addVariadicParameter({ name: "varParam1" })
              .setAction(() => {})
              .build(),
          ],
        },
        {
          id: "plugin2",
          tasks: [
            // overriding task1 with a new description and parameters
            new TaskOverrideDefinitionBuilderImplementation("task1")
              .setDescription("description2")
              .addNamedParameter({ name: "param2" })
              .addFlag({ name: "flag2" })
              .setAction(() => {})
              .build(),
          ],
        },
      ],
    });

    const task1 = hre.tasks.getTask("task1");
    assert.deepEqual(task1.id, ["task1"]);
    assert.equal(task1.pluginId, "plugin1");
    assert.equal(task1.description, "description2");
    // Original params should have not been removed
    assert.ok(task1.namedParameters.get("param1"), "Should have param1");
    assert.ok(task1.namedParameters.get("flag1"), "Should have flag1");
    assert.ok(
      task1.positionalParameters.some((p) => p.name === "posParam1"),
      "Should have posParam1",
    );
    assert.ok(
      task1.positionalParameters.some((p) => p.name === "posParam1"),
      "Should have varParam1",
    );
    // New params should be added by the overrides
    assert.ok(task1.namedParameters.get("param2"), "Should have param2");
    assert.ok(task1.namedParameters.get("flag2"), "Should have flag2");
    // Should have 2 actions
    assert.equal(task1.actions.length, 2);
    assert.equal(task1.actions[0].pluginId, "plugin1");
    assert.equal(task1.actions[1].pluginId, "plugin2");
  });

  it("should override the same task multiple times", async () => {
    const hre = await createHardhatRuntimeEnvironment({
      plugins: [
        {
          id: "plugin1",
          tasks: [
            new NewTaskDefinitionBuilderImplementation("task1")
              .setDescription("description1")
              .addNamedParameter({ name: "param1" })
              .addFlag({ name: "flag1" })
              .addPositionalParameter({ name: "posParam1" })
              .addVariadicParameter({ name: "varParam1" })
              .setAction(() => {})
              .build(),
            // overriding task1 with a new description and parameters
            new TaskOverrideDefinitionBuilderImplementation("task1")
              .setDescription("description2")
              .addNamedParameter({ name: "param2" })
              .addFlag({ name: "flag2" })
              .setAction(() => {})
              .build(),
          ],
        },
        {
          id: "plugin2",
          tasks: [
            // overriding task1 with a new description and parameters
            new TaskOverrideDefinitionBuilderImplementation("task1")
              .setDescription("description3")
              .addNamedParameter({ name: "param3" })
              .addFlag({ name: "flag3" })
              .setAction(() => {})
              .build(),
          ],
        },
      ],
    });

    const task1 = hre.tasks.getTask("task1");
    assert.deepEqual(task1.id, ["task1"]);
    assert.equal(task1.pluginId, "plugin1");
    assert.equal(task1.description, "description3");
    // Original params should have not been removed
    assert.ok(task1.namedParameters.get("param1"), "Should have param1");
    assert.ok(task1.namedParameters.get("flag1"), "Should have flag1");
    assert.ok(
      task1.positionalParameters.some((p) => p.name === "posParam1"),
      "Should have posParam1",
    );
    assert.ok(
      task1.positionalParameters.some((p) => p.name === "posParam1"),
      "Should have varParam1",
    );
    // New params should be added by the overrides
    assert.ok(task1.namedParameters.get("param2"), "Should have param2");
    assert.ok(task1.namedParameters.get("flag2"), "Should have flag2");
    assert.ok(task1.namedParameters.get("param3"), "Should have param3");
    assert.ok(task1.namedParameters.get("flag3"), "Should have flag3");
    // Should have 3 actions
    assert.equal(task1.actions.length, 3);
    assert.equal(task1.actions[0].pluginId, "plugin1");
    assert.equal(task1.actions[1].pluginId, "plugin1");
    assert.equal(task1.actions[2].pluginId, "plugin2");
  });

  it("should add an empty task", async () => {
    const hre = await createHardhatRuntimeEnvironment({
      plugins: [
        {
          id: "plugin1",
          tasks: [
            new EmptyTaskDefinitionBuilderImplementation(
              "task1",
              "description1",
            ).build(),
          ],
        },
      ],
    });

    const task1 = hre.tasks.getTask("task1");
    assert.deepEqual(task1.id, ["task1"]);
    assert.equal(task1.pluginId, "plugin1");
  });

  it("should add subtasks", async () => {
    const hre = await createHardhatRuntimeEnvironment({
      plugins: [
        {
          id: "plugin1",
          tasks: [
            new EmptyTaskDefinitionBuilderImplementation(
              "task1",
              "description1",
            ).build(),
            // adds a subtask to the empty task
            new NewTaskDefinitionBuilderImplementation(["task1", "subtask1"])
              .setAction(() => {})
              .build(),
          ],
        },

        {
          id: "plugin2",
          tasks: [
            // adds a subtask to the non-empty task
            new NewTaskDefinitionBuilderImplementation([
              "task1",
              "subtask1",
              "subsubtask1",
            ])
              .setAction(() => {})
              .build(),
          ],
        },
      ],
    });

    const task1 = hre.tasks.getTask("task1");
    assert.deepEqual(task1.id, ["task1"]);
    assert.equal(task1.pluginId, "plugin1");

    const subtask1 = hre.tasks.getTask(["task1", "subtask1"]);
    assert.deepEqual(subtask1.id, ["task1", "subtask1"]);
    assert.equal(subtask1.pluginId, "plugin1");

    const subsubtask1 = hre.tasks.getTask(["task1", "subtask1", "subsubtask1"]);
    assert.deepEqual(subsubtask1.id, ["task1", "subtask1", "subsubtask1"]);
    assert.equal(subsubtask1.pluginId, "plugin2");

    // task1 should be a root task, but subtask1 and subsubtask1 should not
    assert.equal(hre.tasks.rootTasks.size, 1);
    assert.deepEqual(hre.tasks.rootTasks.get("task1")?.id, ["task1"]);
    assert.equal(hre.tasks.rootTasks.get("subtask1"), undefined);
    assert.equal(hre.tasks.rootTasks.get("subsubtask1"), undefined);
  });

  /**
   * These are all tested with plugin tasks, but the same logic applies to config tasks
   */
  describe("errors", () => {
    it("should throw if there's a global parameter with the same name as a task named parameter", async () => {
      await assert.rejects(
        createHardhatRuntimeEnvironment({
          plugins: [
            {
              id: "plugin1",
              tasks: [
                new NewTaskDefinitionBuilderImplementation("task1")
                  .addNamedParameter({ name: "param1" })
                  .setAction(() => {})
                  .build(),
              ],
            },
            {
              id: "plugin2",
              globalParameters: [
                buildGlobalParameterDefinition({
                  name: "param1",
                  description: "",
                  parameterType: ParameterType.STRING,
                  defaultValue: "",
                }),
              ],
            },
          ],
        }),
        new HardhatError(
          HardhatError.ERRORS.TASK_DEFINITIONS.TASK_PARAMETER_ALREADY_DEFINED,
          {
            actorFragment: "Plugin plugin1 is",
            task: "task1",
            parameter: "param1",
            globalParamPluginId: "plugin2",
          },
        ),
      );
    });

    it("should throw if there's a global parameter with the same name as a task positional parameter", async () => {
      await assert.rejects(
        createHardhatRuntimeEnvironment({
          plugins: [
            {
              id: "plugin1",
              tasks: [
                new NewTaskDefinitionBuilderImplementation("task1")
                  .addPositionalParameter({ name: "param1" })
                  .setAction(() => {})
                  .build(),
              ],
            },
            {
              id: "plugin2",
              globalParameters: [
                buildGlobalParameterDefinition({
                  name: "param1",
                  description: "",
                  parameterType: ParameterType.STRING,
                  defaultValue: "",
                }),
              ],
            },
          ],
        }),
        new HardhatError(
          HardhatError.ERRORS.TASK_DEFINITIONS.TASK_PARAMETER_ALREADY_DEFINED,
          {
            actorFragment: "Plugin plugin1 is",
            task: "task1",
            parameter: "param1",
            globalParamPluginId: "plugin2",
          },
        ),
      );
    });

    it("should throw if trying to add a task with an empty id", async () => {
      await assert.rejects(
        createHardhatRuntimeEnvironment({
          plugins: [
            {
              id: "plugin1",
              tasks: [
                // Manually creating a task as the builder doesn't allow empty ids
                {
                  type: TaskDefinitionType.NEW_TASK,
                  id: [], // empty id
                  description: "",
                  action: () => {},
                  namedParameters: {},
                  positionalParameters: [],
                },
              ],
            },
          ],
        }),
        new HardhatError(HardhatError.ERRORS.TASK_DEFINITIONS.EMPTY_TASK_ID),
      );
    });

    it("should throw if trying to add a subtask for a task that doesn't exist", async () => {
      await assert.rejects(
        createHardhatRuntimeEnvironment({
          plugins: [
            {
              id: "plugin1",
              tasks: [
                new NewTaskDefinitionBuilderImplementation([
                  "task1",
                  "subtask1",
                ])
                  .addNamedParameter({ name: "param1" })
                  .setAction(() => {})
                  .build(),
              ],
            },
          ],
        }),
        new HardhatError(
          HardhatError.ERRORS.TASK_DEFINITIONS.SUBTASK_WITHOUT_PARENT,
          {
            task: "task1",
            subtask: "task1 subtask1",
          },
        ),
      );
    });

    it("should throw if trying to add a task that already exists", async () => {
      await assert.rejects(
        createHardhatRuntimeEnvironment({
          plugins: [
            {
              id: "plugin1",
              tasks: [
                new NewTaskDefinitionBuilderImplementation("task1")
                  .addNamedParameter({ name: "param1" })
                  .setAction(() => {})
                  .build(),
              ],
            },
            {
              id: "plugin2",
              tasks: [
                new NewTaskDefinitionBuilderImplementation("task1")
                  .addNamedParameter({ name: "param2" })
                  .setAction(() => {})
                  .build(),
              ],
            },
          ],
        }),
        new HardhatError(
          HardhatError.ERRORS.TASK_DEFINITIONS.TASK_ALREADY_DEFINED,
          {
            actorFragment: "Plugin plugin2 is",
            task: "task1",
            definedByFragment: " by plugin plugin1",
          },
        ),
      );
    });

    it("should throw if trying to override a task that doesn't exist", async () => {
      // Empty id task will not be found as empty ids are not allowed
      await assert.rejects(
        createHardhatRuntimeEnvironment({
          plugins: [
            {
              id: "plugin1",
              tasks: [
                // Manually creating a task as the builder doesn't allow empty ids
                {
                  type: TaskDefinitionType.TASK_OVERRIDE,
                  id: [], // empty id
                  description: "",
                  action: () => {},
                  namedParameters: {},
                },
              ],
            },
          ],
        }),
        new HardhatError(HardhatError.ERRORS.TASK_DEFINITIONS.TASK_NOT_FOUND, {
          task: "",
        }),
      );

      // task1 will not be found as it's not defined
      await assert.rejects(
        createHardhatRuntimeEnvironment({
          plugins: [
            {
              id: "plugin1",
              tasks: [
                new TaskOverrideDefinitionBuilderImplementation("task1")
                  .setAction(() => {})
                  .build(),
              ],
            },
          ],
        }),
        new HardhatError(HardhatError.ERRORS.TASK_DEFINITIONS.TASK_NOT_FOUND, {
          task: "task1",
        }),
      );
    });

    it("should throw if trying to override a task and there is a name clash with an exising named parameter", async () => {
      // added parameter clash with an existing named parameter
      await assert.rejects(
        createHardhatRuntimeEnvironment({
          plugins: [
            {
              id: "plugin1",
              tasks: [
                new NewTaskDefinitionBuilderImplementation("task1")
                  .addNamedParameter({ name: "param1" })
                  .setAction(() => {})
                  .build(),
              ],
            },
            {
              id: "plugin2",
              tasks: [
                new TaskOverrideDefinitionBuilderImplementation("task1")
                  .addNamedParameter({ name: "param1" })
                  .setAction(() => {})
                  .build(),
              ],
            },
          ],
        }),
        new HardhatError(
          HardhatError.ERRORS.TASK_DEFINITIONS.TASK_OVERRIDE_PARAMETER_ALREADY_DEFINED,
          {
            actorFragment: "Plugin plugin2 is",
            namedParamName: "param1",
            task: "task1",
          },
        ),
      );

      // added flag clash with an existing named parameter
      await assert.rejects(
        createHardhatRuntimeEnvironment({
          plugins: [
            {
              id: "plugin1",
              tasks: [
                new NewTaskDefinitionBuilderImplementation("task1")
                  .addNamedParameter({ name: "param1" })
                  .setAction(() => {})
                  .build(),
              ],
            },
            {
              id: "plugin2",
              tasks: [
                new TaskOverrideDefinitionBuilderImplementation("task1")
                  .addFlag({ name: "param1" })
                  .setAction(() => {})
                  .build(),
              ],
            },
          ],
        }),
        new HardhatError(
          HardhatError.ERRORS.TASK_DEFINITIONS.TASK_OVERRIDE_PARAMETER_ALREADY_DEFINED,
          {
            actorFragment: "Plugin plugin2 is",
            namedParamName: "param1",
            task: "task1",
          },
        ),
      );
    });

    it("should throw if trying to override a task and there is a name clash with an exising flag parameter", async () => {
      // added parameter clash with an existing flag
      await assert.rejects(
        createHardhatRuntimeEnvironment({
          plugins: [
            {
              id: "plugin1",
              tasks: [
                new NewTaskDefinitionBuilderImplementation("task1")
                  .addFlag({ name: "flag1" })
                  .setAction(() => {})
                  .build(),
              ],
            },
            {
              id: "plugin2",
              tasks: [
                new TaskOverrideDefinitionBuilderImplementation("task1")
                  .addNamedParameter({ name: "flag1" })
                  .setAction(() => {})
                  .build(),
              ],
            },
          ],
        }),
        new HardhatError(
          HardhatError.ERRORS.TASK_DEFINITIONS.TASK_OVERRIDE_PARAMETER_ALREADY_DEFINED,
          {
            actorFragment: "Plugin plugin2 is",
            namedParamName: "flag1",
            task: "task1",
          },
        ),
      );

      // added flag clash with an existing flag
      await assert.rejects(
        createHardhatRuntimeEnvironment({
          plugins: [
            {
              id: "plugin1",
              tasks: [
                new NewTaskDefinitionBuilderImplementation("task1")
                  .addFlag({ name: "flag1" })
                  .setAction(() => {})
                  .build(),
              ],
            },
            {
              id: "plugin2",
              tasks: [
                new TaskOverrideDefinitionBuilderImplementation("task1")
                  .addFlag({ name: "flag1" })
                  .setAction(() => {})
                  .build(),
              ],
            },
          ],
        }),
        new HardhatError(
          HardhatError.ERRORS.TASK_DEFINITIONS.TASK_OVERRIDE_PARAMETER_ALREADY_DEFINED,
          {
            actorFragment: "Plugin plugin2 is",
            namedParamName: "flag1",
            task: "task1",
          },
        ),
      );
    });

    it("should throw if trying to override a task and there is a name clash with an exising positional parameter", async () => {
      // added parameter clash with an existing positional parameter
      await assert.rejects(
        createHardhatRuntimeEnvironment({
          plugins: [
            {
              id: "plugin1",
              tasks: [
                new NewTaskDefinitionBuilderImplementation("task1")
                  .addPositionalParameter({ name: "param1" })
                  .setAction(() => {})
                  .build(),
              ],
            },
            {
              id: "plugin2",
              tasks: [
                new TaskOverrideDefinitionBuilderImplementation("task1")
                  .addNamedParameter({ name: "param1" })
                  .setAction(() => {})
                  .build(),
              ],
            },
          ],
        }),
        new HardhatError(
          HardhatError.ERRORS.TASK_DEFINITIONS.TASK_OVERRIDE_PARAMETER_ALREADY_DEFINED,
          {
            actorFragment: "Plugin plugin2 is",
            namedParamName: "param1",
            task: "task1",
          },
        ),
      );

      // added flag clash with an existing positional parameter
      await assert.rejects(
        createHardhatRuntimeEnvironment({
          plugins: [
            {
              id: "plugin1",
              tasks: [
                new NewTaskDefinitionBuilderImplementation("task1")
                  .addPositionalParameter({ name: "flag1" })
                  .setAction(() => {})
                  .build(),
              ],
            },
            {
              id: "plugin2",
              tasks: [
                new TaskOverrideDefinitionBuilderImplementation("task1")
                  .addFlag({ name: "flag1" })
                  .setAction(() => {})
                  .build(),
              ],
            },
          ],
        }),
        new HardhatError(
          HardhatError.ERRORS.TASK_DEFINITIONS.TASK_OVERRIDE_PARAMETER_ALREADY_DEFINED,
          {
            actorFragment: "Plugin plugin2 is",
            namedParamName: "flag1",
            task: "task1",
          },
        ),
      );
    });

    it("should throw if trying to override a task and there is a name clash with an exising variadic parameter", async () => {
      // added parameter clash with an existing variadic parameter
      await assert.rejects(
        createHardhatRuntimeEnvironment({
          plugins: [
            {
              id: "plugin1",
              tasks: [
                new NewTaskDefinitionBuilderImplementation("task1")
                  .addVariadicParameter({ name: "param1" })
                  .setAction(() => {})
                  .build(),
              ],
            },
            {
              id: "plugin2",
              tasks: [
                new TaskOverrideDefinitionBuilderImplementation("task1")
                  .addNamedParameter({ name: "param1" })
                  .setAction(() => {})
                  .build(),
              ],
            },
          ],
        }),
        new HardhatError(
          HardhatError.ERRORS.TASK_DEFINITIONS.TASK_OVERRIDE_PARAMETER_ALREADY_DEFINED,
          {
            actorFragment: "Plugin plugin2 is",
            namedParamName: "param1",
            task: "task1",
          },
        ),
      );

      // added flag clash with an existing variadic parameter
      await assert.rejects(
        createHardhatRuntimeEnvironment({
          plugins: [
            {
              id: "plugin1",
              tasks: [
                new NewTaskDefinitionBuilderImplementation("task1")
                  .addVariadicParameter({ name: "flag1" })
                  .setAction(() => {})
                  .build(),
              ],
            },
            {
              id: "plugin2",
              tasks: [
                new TaskOverrideDefinitionBuilderImplementation("task1")
                  .addFlag({ name: "flag1" })
                  .setAction(() => {})
                  .build(),
              ],
            },
          ],
        }),
        new HardhatError(
          HardhatError.ERRORS.TASK_DEFINITIONS.TASK_OVERRIDE_PARAMETER_ALREADY_DEFINED,
          {
            actorFragment: "Plugin plugin2 is",
            namedParamName: "flag1",
            task: "task1",
          },
        ),
      );
    });

    it("should throw if a plugins tries to override a task defined in the config", async () => {
      // this will fail as the config tasks are processed after
      // the plugin tasks so the override logic will not find task1
      await assert.rejects(
        createHardhatRuntimeEnvironment({
          tasks: [
            new NewTaskDefinitionBuilderImplementation("task1")
              .setAction(() => {})
              .build(),
          ],
          plugins: [
            {
              id: "plugin1",
              tasks: [
                new TaskOverrideDefinitionBuilderImplementation("task1")
                  .setAction(() => {})
                  .build(),
              ],
            },
          ],
        }),
        new HardhatError(HardhatError.ERRORS.TASK_DEFINITIONS.TASK_NOT_FOUND, {
          task: "task1",
        }),
      );
    });
  });

  describe("getTask", () => {
    it("should return the task if it exists", async () => {
      const hre = await createHardhatRuntimeEnvironment({
        plugins: [
          {
            id: "plugin1",
            tasks: [
              new NewTaskDefinitionBuilderImplementation("task1")
                .setAction(() => {})
                .build(),
            ],
          },
        ],
        tasks: [
          new NewTaskDefinitionBuilderImplementation("task2")
            .setAction(() => {})
            .build(),
        ],
      });

      const task1 = hre.tasks.getTask("task1");
      assert.deepEqual(task1.id, ["task1"]);
      assert.equal(task1.pluginId, "plugin1");

      const task2 = hre.tasks.getTask("task2");
      assert.deepEqual(task2.id, ["task2"]);
      assert.equal(task2.pluginId, undefined);
    });

    it("should throw if the task doesn't exist", async () => {
      const hre = await createHardhatRuntimeEnvironment({});
      // task1 will not be found as it's not defined
      assert.throws(
        () => hre.tasks.getTask("task1"),
        new HardhatError(HardhatError.ERRORS.TASK_DEFINITIONS.TASK_NOT_FOUND, {
          task: "task1",
        }),
      );
    });
  });

  /**
   * The run method is part of the Task interface, but it's tested through the
   * HardhatRuntimeEnvironmentImplementation for simplicity.
   */
  describe("run", () => {
    it("should run a task without arguments", async () => {
      let taskRun = false;
      const hre = await createHardhatRuntimeEnvironment({
        plugins: [
          {
            id: "plugin1",
            tasks: [
              new NewTaskDefinitionBuilderImplementation("task1")
                .setAction(() => {
                  taskRun = true;
                })
                .build(),
            ],
          },
        ],
      });

      const task1 = hre.tasks.getTask("task1");
      assert.equal(taskRun, false);
      await task1.run({});
      assert.equal(taskRun, true);
    });

    it("should return the result of the task action", async () => {
      const hre = await createHardhatRuntimeEnvironment({
        plugins: [
          {
            id: "plugin1",
            tasks: [
              new NewTaskDefinitionBuilderImplementation("task1")
                .setAction(() => "task run successfully")
                .build(),
            ],
          },
        ],
      });

      const task1 = hre.tasks.getTask("task1");
      const result = await task1.run({});
      assert.equal(result, "task run successfully");
    });

    it("should run a overridden task without arguments", async () => {
      let taskRun = false;
      let overrideTaskRun = false;
      const hre = await createHardhatRuntimeEnvironment({
        plugins: [
          {
            id: "plugin1",
            tasks: [
              new NewTaskDefinitionBuilderImplementation("task1")
                .setAction(() => {
                  taskRun = true;
                })
                .build(),
              new TaskOverrideDefinitionBuilderImplementation("task1")
                .setAction(async (args, _hre, runSuper) => {
                  await runSuper(args);
                  overrideTaskRun = true;
                })
                .build(),
            ],
          },
        ],
      });

      const task1 = hre.tasks.getTask("task1");
      assert.equal(taskRun, false);
      assert.equal(overrideTaskRun, false);
      await task1.run({});
      assert.equal(taskRun, true);
      assert.equal(overrideTaskRun, true);
    });

    it("should run a task with several overrides", async () => {
      let taskRun = false;
      let override1TaskRun = false;
      let override2TaskRun = false;
      let override3TaskRun = false;
      const hre = await createHardhatRuntimeEnvironment({
        plugins: [
          {
            id: "plugin1",
            tasks: [
              new NewTaskDefinitionBuilderImplementation("task1")
                .setAction(() => {
                  taskRun = true;
                })
                .build(),
              new TaskOverrideDefinitionBuilderImplementation("task1")
                .setAction(async (args, _hre, runSuper) => {
                  await runSuper(args);
                  override1TaskRun = true;
                })
                .build(),
            ],
          },
          {
            id: "plugin2",
            tasks: [
              new TaskOverrideDefinitionBuilderImplementation("task1")
                .setAction(async (args, _hre, runSuper) => {
                  await runSuper(args);
                  override2TaskRun = true;
                })
                .build(),
            ],
          },
        ],
        tasks: [
          new TaskOverrideDefinitionBuilderImplementation("task1")
            .setAction(async (args, _hre, runSuper) => {
              await runSuper(args);
              override3TaskRun = true;
            })
            .build(),
        ],
      });

      const task1 = hre.tasks.getTask("task1");
      assert.equal(taskRun, false);
      assert.equal(override1TaskRun, false);
      assert.equal(override2TaskRun, false);
      assert.equal(override3TaskRun, false);
      await task1.run({});
      assert.equal(taskRun, true);
      assert.equal(override1TaskRun, true);
      assert.equal(override2TaskRun, true);
      assert.equal(override3TaskRun, true);
    });

    it("should not run the original task action if the override task action doesn't call runSuper", async () => {
      let taskRun = false;
      let overrideTaskRun = false;
      const hre = await createHardhatRuntimeEnvironment({
        plugins: [
          {
            id: "plugin1",
            tasks: [
              new NewTaskDefinitionBuilderImplementation("task1")
                .setAction(() => {
                  taskRun = true;
                })
                .build(),
              new TaskOverrideDefinitionBuilderImplementation("task1")
                .setAction(async (_args, _hre, _runSuper) => {
                  overrideTaskRun = true;
                })
                .build(),
            ],
          },
        ],
      });

      const task1 = hre.tasks.getTask("task1");
      assert.equal(taskRun, false);
      assert.equal(overrideTaskRun, false);
      await task1.run({});
      assert.equal(taskRun, false);
      assert.equal(overrideTaskRun, true);
    });

    it("should run a task with arguments", async () => {
      const hre = await createHardhatRuntimeEnvironment({
        plugins: [
          {
            id: "plugin1",
            tasks: [
              new NewTaskDefinitionBuilderImplementation("task1")
                .addNamedParameter({ name: "param1" })
                .addFlag({ name: "flag1" })
                .addPositionalParameter({ name: "posParam" })
                .addVariadicParameter({ name: "varParam" })
                .setAction((args) => {
                  assert.deepEqual(args, {
                    param1: "param1Value",
                    flag1: true,
                    posParam: "posValue",
                    varParam: ["varValue1", "varValue2"],
                  });
                })
                .build(),
              new TaskOverrideDefinitionBuilderImplementation("task1")
                .addNamedParameter({ name: "param2" })
                .addFlag({ name: "flag2" })
                .setAction(
                  async ({ param2, flag2, ...args }, _hre, runSuper) => {
                    await runSuper(args);
                    assert.deepEqual(
                      { param2, flag2 },
                      {
                        param2: "param2Value",
                        flag2: true,
                      },
                    );
                  },
                )
                .build(),
            ],
          },
        ],
      });

      const task1 = hre.tasks.getTask("task1");
      await task1.run({
        param1: "param1Value",
        flag1: true,
        posParam: "posValue",
        varParam: ["varValue1", "varValue2"],
        param2: "param2Value",
        flag2: true,
      });
    });

    it("should run a task with arguments and resolve their default values", async () => {
      const hre = await createHardhatRuntimeEnvironment({
        plugins: [
          {
            id: "plugin1",
            tasks: [
              new NewTaskDefinitionBuilderImplementation("task1")
                .addNamedParameter({
                  name: "param1",
                  defaultValue: "param1DefaultValue",
                })
                .addFlag({ name: "flag1" })
                .addPositionalParameter({
                  name: "posParam",
                  defaultValue: "posValue",
                })
                .addVariadicParameter({
                  name: "varParam",
                  defaultValue: ["varValue1", "varValue2"],
                })
                .setAction((args) => {
                  assert.deepEqual(args, {
                    param1: "param1DefaultValue",
                    flag1: false,
                    posParam: "posValue",
                    varParam: ["varValue1", "varValue2"],
                  });
                })
                .build(),
            ],
          },
        ],
      });

      const task1 = hre.tasks.getTask("task1");
      await task1.run({});
    });

    it("should run an empty task that was overriden", async () => {
      let overrideTaskRun = false;
      const hre = await createHardhatRuntimeEnvironment({
        plugins: [
          {
            id: "plugin1",
            tasks: [
              new EmptyTaskDefinitionBuilderImplementation(
                "task1",
                "description1",
              ).build(),
              new TaskOverrideDefinitionBuilderImplementation("task1")
                .setAction(async (args, _hre, runSuper) => {
                  await runSuper(args);
                  overrideTaskRun = true;
                })
                .build(),
            ],
          },
        ],
      });

      const task1 = hre.tasks.getTask("task1");
      assert.equal(overrideTaskRun, false);
      await task1.run({});
      assert.equal(overrideTaskRun, true);
    });

    it("should run a task with an action url", async () => {
      const actionUrl = import.meta.resolve(
        "./fixture-projects/file-actions/action-fn.js",
      );

      const hre = await createHardhatRuntimeEnvironment({
        plugins: [
          {
            id: "plugin1",
            tasks: [
              new NewTaskDefinitionBuilderImplementation("task1")
                .setAction((args) => args)
                .build(),
              new TaskOverrideDefinitionBuilderImplementation("task1")
                .addNamedParameter({ name: "param1" })
                .setAction(actionUrl)
                .build(),
            ],
          },
        ],
      });

      const task1 = hre.tasks.getTask("task1");
      const response = await task1.run({ param1: "param1Value" });
      assert.deepEqual(response, { param1: "param1Value" });
    });

    it("should run a task with an invalid action url that was overriden and the override doesn't call runSuper", async () => {
      const validActionUrl = import.meta.resolve(
        "./fixture-projects/file-actions/no-run-super.js",
      );

      const hre = await createHardhatRuntimeEnvironment({
        plugins: [
          {
            id: "plugin1",
            tasks: [
              new NewTaskDefinitionBuilderImplementation("task1")
                .setAction("file://not-a-module")
                .build(),
              new TaskOverrideDefinitionBuilderImplementation("task1")
                .addNamedParameter({ name: "param1" })
                .setAction(validActionUrl)
                .build(),
            ],
          },
        ],
      });

      const task1 = hre.tasks.getTask("task1");
      const response = await task1.run({ param1: "param1Value" });
      assert.equal(
        response,
        `action fn called with args: ${JSON.stringify({ param1: "param1Value" })}`,
      );
    });

    describe("validations", () => {
      it("should throw if the task is empty", async () => {
        const hre = await createHardhatRuntimeEnvironment({
          plugins: [
            {
              id: "plugin1",
              tasks: [
                new EmptyTaskDefinitionBuilderImplementation(
                  "task1",
                  "description1",
                ).build(),
              ],
            },
          ],
        });

        const task1 = hre.tasks.getTask("task1");
        await assert.rejects(
          task1.run({}),
          new HardhatError(HardhatError.ERRORS.TASK_DEFINITIONS.EMPTY_TASK, {
            task: "task1",
          }),
        );
      });

      it("should throw if the provided parameter is not one of the task parameters", async () => {
        const hre = await createHardhatRuntimeEnvironment({
          plugins: [
            {
              id: "plugin1",
              tasks: [
                new NewTaskDefinitionBuilderImplementation("task1")
                  .setAction(() => {})
                  .build(),
              ],
            },
          ],
        });

        const task1 = hre.tasks.getTask("task1");
        await assert.rejects(
          task1.run({ otherParam: "otherParamValue" }),
          new HardhatError(
            HardhatError.ERRORS.TASK_DEFINITIONS.UNRECOGNIZED_NAMED_PARAM,
            {
              parameter: "otherParam",
              task: "task1",
            },
          ),
        );
      });

      it("should throw if a required parameter is missing", async () => {
        const hre = await createHardhatRuntimeEnvironment({
          plugins: [
            {
              id: "plugin1",
              tasks: [
                new NewTaskDefinitionBuilderImplementation("task1")
                  .addNamedParameter({ name: "namedParam" })
                  .addPositionalParameter({ name: "posParam" })
                  .addVariadicParameter({ name: "varParam" })
                  .setAction(() => {})
                  .build(),
              ],
            },
          ],
        });

        const task1 = hre.tasks.getTask("task1");

        // namedParam is missing
        await assert.rejects(
          task1.run({
            posParam: "posValue",
            varParam: ["varValue1", "varValue2"],
          }),
          new HardhatError(
            HardhatError.ERRORS.TASK_DEFINITIONS.MISSING_VALUE_FOR_PARAMETER,
            {
              parameter: "namedParam",
              task: "task1",
            },
          ),
        );

        // posParam is missing
        await assert.rejects(
          task1.run({
            namedParam: "param1Value",
            varParam: ["varValue1", "varValue2"],
          }),
          new HardhatError(
            HardhatError.ERRORS.TASK_DEFINITIONS.MISSING_VALUE_FOR_PARAMETER,
            {
              parameter: "posParam",
              task: "task1",
            },
          ),
        );

        // varParam is missing
        await assert.rejects(
          task1.run({
            namedParam: "param1Value",
            posParam: "posValue",
          }),
          new HardhatError(
            HardhatError.ERRORS.TASK_DEFINITIONS.MISSING_VALUE_FOR_PARAMETER,
            {
              parameter: "varParam",
              task: "task1",
            },
          ),
        );
      });

      it("should throw if the provided value for the parameter is not of the correct type", async () => {
        const hre = await createHardhatRuntimeEnvironment({
          plugins: [
            {
              id: "plugin1",
              tasks: [
                new NewTaskDefinitionBuilderImplementation("task1")
                  .addNamedParameter({
                    name: "namedParam",
                    type: ParameterType.BIGINT,
                  })
                  .addPositionalParameter({
                    name: "posParam",
                    type: ParameterType.INT,
                  })
                  .addVariadicParameter({
                    name: "varParam",
                    type: ParameterType.FILE,
                  })
                  .setAction(() => {})
                  .build(),
              ],
            },
          ],
        });

        const task1 = hre.tasks.getTask("task1");

        // namedParam has the wrong type
        await assert.rejects(
          task1.run({
            namedParam: "not a bigint",
            posParam: 10,
            varParam: ["file1", "file2", "file3"],
          }),
          new HardhatError(
            HardhatError.ERRORS.TASK_DEFINITIONS.INVALID_VALUE_FOR_TYPE,
            {
              value: "not a bigint",
              name: "namedParam",
              type: ParameterType.BIGINT,
              task: "task1",
            },
          ),
        );

        // posParam has the wrong type
        await assert.rejects(
          task1.run({
            namedParam: 5n,
            posParam: true,
            varParam: ["file1", "file2", "file3"],
          }),
          new HardhatError(
            HardhatError.ERRORS.TASK_DEFINITIONS.INVALID_VALUE_FOR_TYPE,
            {
              value: true,
              name: "posParam",
              type: ParameterType.INT,
              task: "task1",
            },
          ),
        );

        // varParam has the wrong type (not an array)
        await assert.rejects(
          task1.run({
            namedParam: 5n,
            posParam: 10,
            varParam: "not an array",
          }),
          new HardhatError(
            HardhatError.ERRORS.TASK_DEFINITIONS.INVALID_VALUE_FOR_TYPE,
            {
              value: "not an array",
              name: "varParam",
              type: ParameterType.FILE,
              task: "task1",
            },
          ),
        );

        // varParam has the wrong type (array element has the wrong type)
        await assert.rejects(
          task1.run({
            namedParam: 5n,
            posParam: 10,
            varParam: ["file1", 5, "file3"],
          }),
          new HardhatError(
            HardhatError.ERRORS.TASK_DEFINITIONS.INVALID_VALUE_FOR_TYPE,
            {
              value: ["file1", 5, "file3"],
              name: "varParam",
              type: ParameterType.FILE,
              task: "task1",
            },
          ),
        );
      });

      it("should throw if an action url is provided and the module can't be resolved", async () => {
        const hre = await createHardhatRuntimeEnvironment({
          plugins: [
            {
              id: "plugin1",
              tasks: [
                new NewTaskDefinitionBuilderImplementation("task1")
                  .setAction("file://not-a-module")
                  .build(),
              ],
            },
          ],
        });

        const task1 = hre.tasks.getTask("task1");
        await assert.rejects(
          task1.run({}),
          new HardhatError(
            HardhatError.ERRORS.TASK_DEFINITIONS.INVALID_ACTION_URL,
            {
              action: "file://not-a-module",
              task: "task1",
            },
          ),
        );
      });

      it("should throw if an action url is provided and the module doesn't have a default export", async () => {
        const actionUrl = import.meta.resolve(
          "./fixture-projects/file-actions/no-default.js",
        );

        const hre = await createHardhatRuntimeEnvironment({
          plugins: [
            {
              id: "plugin1",
              tasks: [
                new NewTaskDefinitionBuilderImplementation("task1")
                  .setAction(actionUrl)
                  .build(),
              ],
            },
          ],
        });

        const task1 = hre.tasks.getTask("task1");
        await assert.rejects(
          task1.run({}),
          new HardhatError(
            HardhatError.ERRORS.TASK_DEFINITIONS.INVALID_ACTION,
            {
              action: actionUrl,
              task: "task1",
            },
          ),
        );
      });

      it("should throw if an action url is provided and the module default export is not a function", async () => {
        const actionUrl = import.meta.resolve(
          "./fixture-projects/file-actions/no-default-fn.js",
        );

        const hre = await createHardhatRuntimeEnvironment({
          plugins: [
            {
              id: "plugin1",
              tasks: [
                new NewTaskDefinitionBuilderImplementation("task1")
                  .setAction(actionUrl)
                  .build(),
              ],
            },
          ],
        });

        const task1 = hre.tasks.getTask("task1");
        await assert.rejects(
          task1.run({}),
          new HardhatError(
            HardhatError.ERRORS.TASK_DEFINITIONS.INVALID_ACTION,
            {
              action: actionUrl,
              task: "task1",
            },
          ),
        );
      });
    });
  });
});
