import { spawn } from "node:child_process";
import { CommandInteraction, MessageFlags } from "discord.js";
import { Discord, Slash } from "discordx";

const MAX_OUTPUT_LENGTH = 1_800;
const GIT_PULL_TIMEOUT_MS = 60_000;

@Discord()
export class Git {
  @Slash({
    name: "git-pull",
    description: "Botの実行ディレクトリで git pull を実行します",
    dmPermission: false,
  })
  async pull(interaction: CommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: "💥 サーバー情報の取得に失敗しました", flags: MessageFlags.Ephemeral });
      return;
    }

    if (!(await isBotOwner(interaction))) {
      await interaction.reply({ content: "❌ Botの所有者のみ実行できます", flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const result = await runGitPull();
    const output = trimOutput([result.stdout, result.stderr].filter(Boolean).join("\n"));
    const status = result.ok ? "✅ git pull が完了しました" : "❌ git pull に失敗しました";
    const exit = result.code == null ? "" : `\n終了コード: ${result.code}`;
    const signal = result.signal ? `\nシグナル: ${result.signal}` : "";
    const body = output ? `\n\`\`\`\n${output}\n\`\`\`` : "";

    await interaction.editReply(`${status}${exit}${signal}${body}`);
  }
}

async function isBotOwner(interaction: CommandInteraction): Promise<boolean> {
  const application = await interaction.client.application?.fetch();
  const owner = application?.owner;
  if (!owner) {
    return false;
  }

  if ("members" in owner) {
    return owner.members.has(interaction.user.id);
  }

  return owner.id === interaction.user.id;
}

type GitPullResult = {
  ok: boolean;
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
};

function runGitPull(): Promise<GitPullResult> {
  return new Promise(resolve => {
    const child = spawn("git", ["pull"], {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let settled = false;

    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      stderr += `\ngit pull が ${GIT_PULL_TIMEOUT_MS / 1000} 秒以内に完了しませんでした`;
    }, GIT_PULL_TIMEOUT_MS);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", chunk => {
      stdout += chunk;
    });
    child.stderr.on("data", chunk => {
      stderr += chunk;
    });

    child.on("error", error => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve({
        ok: false,
        code: null,
        signal: null,
        stdout,
        stderr: `${stderr}\n${error.message}`.trim(),
      });
    });

    child.on("close", (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve({
        ok: code === 0,
        code,
        signal,
        stdout,
        stderr,
      });
    });
  });
}

function trimOutput(output: string): string {
  const trimmed = output.trim();
  if (trimmed.length <= MAX_OUTPUT_LENGTH) {
    return trimmed;
  }
  return `...省略...\n${trimmed.slice(-MAX_OUTPUT_LENGTH)}`;
}
