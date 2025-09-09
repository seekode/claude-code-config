console.log("test log");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// ANSI color codes
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  gray: "\x1b[90m",
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
const modelName = () => jsonInput.model?.display_name || "Claude";

/**
 * Get AI modification stats from the last prompt only with color coding
 * @returns string of added / removed lines with green for added, red for removed
 */
/**
 * Clean old cache files asynchronously (older than 24h)
 */
const cleanOldCacheFiles = () => {
  const cacheDir = path.join(__dirname, "claude_cache");

  // Run cleanup asynchronously to avoid blocking
  setImmediate(() => {
    try {
      if (!fs.existsSync(cacheDir)) return;

      const files = fs.readdirSync(cacheDir);
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24h in milliseconds

      for (const file of files) {
        if (file.startsWith("stats_") && file.endsWith(".json")) {
          const filePath = path.join(cacheDir, file);
          const stats = fs.statSync(filePath);

          if (now - stats.mtime.getTime() > maxAge) {
            fs.unlinkSync(filePath);
          }
        }
      }
    } catch (error) {
      // Ignore cleanup errors silently
    }
  });
};

const getAIModificationStats = () => {
  try {
    const cost = jsonInput.cost;
    if (!cost) return "+0 -0";

    const sessionId = jsonInput.session_id || "default";
    const cacheDir = path.join(__dirname, "claude_cache");
    const cacheFile = path.join(cacheDir, `stats_${sessionId}.json`);

    // Ensure cache directory exists
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    // Clean old files (async, non-blocking)
    cleanOldCacheFiles();

    let previousStats = {
      added: 0,
      removed: 0,
      lastDisplay: { added: 0, removed: 0 },
    };

    // Read previous stats if exists
    try {
      if (fs.existsSync(cacheFile)) {
        previousStats = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
      }
    } catch (error) {
      // Ignore cache read errors
    }

    const currentAdded = cost.total_lines_added || 0;
    const currentRemoved = cost.total_lines_removed || 0;

    const deltaAdded =
      currentAdded == previousStats.added
        ? previousStats.lastDisplay.added
        : currentAdded - previousStats.added;
    const deltaRemoved =
      currentRemoved == previousStats.removed
        ? previousStats.lastDisplay.removed
        : currentRemoved - previousStats.removed;

    // Update cache
    try {
      fs.writeFileSync(
        cacheFile,
        JSON.stringify({
          added: currentAdded,
          removed: currentRemoved,
          lastDisplay: {
            added: deltaAdded,
            removed: deltaRemoved,
          },
        })
      );
    } catch (error) {
      // Ignore cache write errors
    }

    return `${colors.green}+${deltaAdded}${colors.reset} ${colors.red}-${deltaRemoved}${colors.reset}`;
  } catch (error) {
    return `${colors.green}+0${colors.reset} ${colors.red}-0${colors.reset}`;
  }
};

const getTotalAiModificationStats = () => {
  try {
    const cost = jsonInput.cost;
    if (!cost) return "+0 -0";

    return `${colors.green}+${jsonInput.cost.total_lines_added}${colors.reset} ${colors.red}-${jsonInput.cost.total_lines_removed}${colors.reset}`;
  } catch (error) {
    return `${colors.green}+0${colors.reset} ${colors.red}-0${colors.reset}`;
  }
};

/**
 * Get output style from jsonInput
 * @returns output style name
 */
const getOutputStyle = () => {
  try {
    const style = jsonInput.output_style;
    if (typeof style === "object" && style !== null) {
      return style.name || style.display_name || "default";
    }
    return style || "default";
  } catch (error) {
    return "default";
  }
};

/**
 * Get session time in readable format
 * @returns formatted session time
 */
const getSessionTime = () => {
  try {
    const cost = jsonInput.cost;
    if (!cost || !cost.total_duration_ms) return "0m";

    const totalDurationMs = cost.total_duration_ms;
    const hours = Math.floor(totalDurationMs / (60 * 60 * 1000));
    const minutes = Math.floor(
      (totalDurationMs % (60 * 60 * 1000)) / (60 * 1000)
    );

    if (hours > 0) {
      return `${hours}h${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  } catch (error) {
    return "0m";
  }
};


/**
 * Extract project name
 * @returns name
 */
const projectName = () => {
  const dir = jsonInput.workspace?.current_dir || process.cwd();
  return path.basename(dir) || "Unknown";
};

/**
 * Get git context (branch and stats) in a single read
 * @returns object with branch and stats
 */
const getGitContext = () => {
  const dir = jsonInput.workspace?.current_dir || process.cwd();
  try {
    process.chdir(dir);
    if (!fs.existsSync(".git")) {
      return {
        branch: "no-git",
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
    gitContextCache = getGitContext();
  }
  return gitContextCache;
};

/**
 * generate and display the IA status line
 */
function generateIALine() {
  try {
    return `${colors.cyan}🤖 ${colors.bright}${modelName()}${
      colors.reset
    } (${getAIModificationStats()}) ${colors.gray}|${colors.reset} ${
      colors.magenta
    }🎨 ${getOutputStyle()}${colors.reset} ${colors.gray}|${colors.reset} ${
      colors.yellow
    }⌚ ${getSessionTime()}${
      colors.reset
    } | Total : ${getTotalAiModificationStats()}`;
  } catch (error) {
    return `${colors.cyan}🤖 ${colors.bright}Claude${colors.reset} (${colors.green}+0${colors.reset} ${colors.red}-0${colors.reset}) ${colors.gray}|${colors.reset} ${colors.magenta}🎨 default${colors.reset} ${colors.gray}|${colors.reset} ${colors.yellow}⏱️ 0m${colors.reset}`;
  }
}

/**
 * generate and display the project status line
 */
function generateProjectLine() {
  try {
    return `${colors.blue}📁 ${colors.bright}${projectName()}${colors.reset} ${
      colors.gray
    }|${colors.reset} ${colors.green}🌿 ${gitContext().branch}${
      colors.reset
    } (${gitContext().stats})`;
  } catch (error) {
    return `${colors.blue}📁 ${colors.bright}Unknown${colors.reset} ${colors.gray}|${colors.reset} ${colors.green}🌿 unknown${colors.reset} (${colors.green}+0${colors.reset} ${colors.red}-0${colors.reset})`;
  }
}
