import type { UserConfig } from "@commitlint/types";

const config: UserConfig = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "feat", // new feature
        "fix", // bug fix
        "docs", // documentation
        "style", // formatting, no logic change
        "refactor", // refactoring, no feature or bug fix
        "perf", // performance improvements
        "test", // adding or updating tests
        "chore", // build process, dependencies, tooling
        "revert", // revert a commit
        "ci", // CI/CD changes
      ],
    ],
    "subject-case": [2, "never", ["upper-case", "pascal-case", "start-case"]],
    "subject-max-length": [2, "always", 100],
    "body-max-line-length": [2, "always", 200],
  },
};

export default config;
