const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// ANSI color codes
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  brightReset: "\x1b[0m\x1b[1m", // just for make code easier
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  gray: "\x1b[90m",
  black: "\x1b[30m",
};

// input data
let inputData = "";
let jsonInput = {};
// git context
let gitContextCache = null;
process.stdin.setEncoding("utf8");

process.stdin.on("data", (chunk) => (inputData += chunk));

process.stdin.on("end", () => {
  try {
    jsonInput = JSON.parse(inputData.trim());
    console.log(generateIALine());
    console.log(generateProjectLine());
  } catch (error) {}
});

/**
 * Extract model name
 * @returns name
 */
const modelName = (icon, color) =>
  `${colors.brightReset}${color}${icon} ${
    jsonInput.model?.display_name || "Claude"
  }`;

const getAiModificationStats = () => {
  try {
    const cost = jsonInput.cost;
    if (!cost) return "+0 -0";

    return `${colors.brightReset}(${colors.green}+${jsonInput.cost.total_lines_added}${colors.reset} ${colors.red}-${jsonInput.cost.total_lines_removed}${colors.reset}${colors.bright})`;
  } catch (error) {
    return `${colors.brightReset}(${colors.green}+0${colors.reset} ${colors.red}-0${colors.reset}${colors.bright})`;
  }
};

/**
 * Get output style from jsonInput
 * @returns output style name
 */
const getOutputStyle = (icon, color) => {
  try {
    const style = jsonInput.output_style;
    if (typeof style === "object" && style !== null) {
      return `${colors.brightReset}${color}${icon} ${
        style.name || style.display_name || "default"
      }`;
    }
    return `${colors.brightReset}${color}${icon} ${style || "default"}`;
  } catch (error) {
    return `${colors.brightReset}${color}${icon} default`;
  }
};

/**
 * Get session time in readable format
 * @returns formatted session time
 */
const getSessionTime = (icon, color) => {
  try {
    const cost = jsonInput.cost;
    if (!cost || !cost.total_duration_ms) return "0m";

    const totalDurationMs = cost.total_duration_ms;
    const hours = Math.floor(totalDurationMs / (60 * 60 * 1000));
    const minutes = Math.floor(
      (totalDurationMs % (60 * 60 * 1000)) / (60 * 1000)
    );

    if (hours > 0) {
      return `${colors.brightReset}${color}${icon} ${hours}h${minutes}m`;
    } else {
      return `${colors.brightReset}${color}${icon} ${minutes}m`;
    }
  } catch (error) {
    return `${colors.brightReset}${color}${icon} 0m`;
  }
};

/**
 * Extract project name
 * @returns name
 */
const projectName = (icon, color) => {
  const dir = jsonInput.workspace?.current_dir || process.cwd();
  return `${colors.brightReset}${color}${icon} ${
    path.basename(dir) || "Unknown"
  }`;
};

/**
 * Get git context (branch and stats) in a single read
 * @returns object with branch and stats
 */
const loadGitContext = () => {
  const dir = jsonInput.workspace?.current_dir || process.cwd();
  try {
    process.chdir(dir);
    if (!fs.existsSync(".git")) {
      return {
        branch: `no-git`,
        stats: `${colors.green}+0${colors.reset} ${colors.red}-0${colors.reset}`,
      };
    }

    try {
      execSync("git status --porcelain", {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });

      let branch = "unknown";
      try {
        const branchName = execSync("git rev-parse --abbrev-ref HEAD", {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
        }).trim();

        if (branchName && branchName !== "HEAD") {
          branch = branchName;
        } else {
          try {
            const commit = execSync("git rev-parse --short HEAD", {
              encoding: "utf8",
              stdio: ["ignore", "pipe", "ignore"],
            }).trim();
            branch = commit || "unknown";
          } catch (commitError) {
            branch = "unknown";
          }
        }
      } catch (branchError) {
        branch = "unknown";
      }

      let stats = `${colors.green}+0${colors.reset} ${colors.red}-0${colors.reset}`;
      try {
        const diffOutput = execSync("git diff --numstat HEAD", {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
        });

        let totalAdded = 0;
        let totalRemoved = 0;

        const lines = diffOutput
          .trim()
          .split("\n")
          .filter((line) => line);
        for (const line of lines) {
          const parts = line.split("\t");
          if (parts.length >= 2) {
            const added = parseInt(parts[0]) || 0;
            const removed = parseInt(parts[1]) || 0;
            totalAdded += added;
            totalRemoved += removed;
          }
        }

        stats = `${colors.green}+${totalAdded}${colors.reset} ${colors.red}-${totalRemoved}${colors.reset}`;
      } catch (diffError) {
        stats = `${colors.green}+0${colors.reset} ${colors.red}-0${colors.reset}`;
      }

      return { branch, stats };
    } catch (gitError) {
      return {
        branch: "unknown",
        stats: `${colors.green}+0${colors.reset} ${colors.red}-0${colors.reset}`,
      };
    }
  } catch (error) {
    return {
      branch: "unknown",
      stats: `${colors.green}+0${colors.reset} ${colors.red}-0${colors.reset}`,
    };
  }
};

/**
 * get git context, if not exist, call getGitContext for get it before return it
 * @returns object of git context
 */
const gitContext = () => {
  if (!gitContextCache) {
    gitContextCache = loadGitContext();
  }
  return gitContextCache;
};

/**
 * get colorized git branch
 * @returns stylized git branch name
 */
const gitBranch = (icon, color) => {
  return `${colors.brightReset}${color}${icon} ${gitContext().branch}`;
};

/**
 * get colorized git stats
 * @returns stylized git stats
 */
const gitStats = () => {
  return `${colors.brightReset}(${colors.green}+0${colors.reset} ${colors.red}-0${colors.reset})`;
};

/**
 * generate and display the IA status line
 */
function generateIALine() {
  try {
    const part = [];

    part.push(`${modelName("🤖", colors.cyan)} ${getAiModificationStats()}`);
    part.push(getOutputStyle("🎨", colors.magenta));
    part.push(getSessionTime("⌚", colors.yellow));

    return part.join(`${colors.reset}${colors.gray} | `);
  } catch (error) {
    return `${colors.cyan}🤖 ${colors.bright}Claude${colors.reset} (${colors.green}+0${colors.reset} ${colors.red}-0${colors.reset}) ${colors.gray}|${colors.reset} ${colors.magenta}🎨 default${colors.reset} ${colors.gray}|${colors.reset} ${colors.yellow}⏱️ 0m${colors.reset}`;
  }
}

/**
 * generate and display the project status line
 */
function generateProjectLine() {
  try {
    const part = [];

    part.push(`${projectName("📁", colors.blue)}`);
    part.push(`${gitBranch("🌿", colors.green)} ${gitStats()}`);

    return part.join(`${colors.reset}${colors.gray} | `);
  } catch (error) {
    return `${colors.blue}📁 ${colors.bright}Unknown${colors.reset} ${colors.gray}|${colors.reset} ${colors.green} unknown${colors.reset} (${colors.green}+0${colors.reset} ${colors.red}-0${colors.reset})`;
  }
}
