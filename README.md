# m2vocal.ts

Discord の読み上げ Bot。

## 必要なもの

- Node.js >= 16
- pnpm
- VOICEVOX Engine（別途起動が必要）

## セットアップ

```sh
pnpm install
```

環境変数を設定する（`.env` ファイルを作成するか、環境変数として渡す）:

```
BOT_TOKEN=your_discord_bot_token
```

## 開発

```sh
pnpm dev
```

## ビルド & 起動

```sh
pnpm build
pnpm start
```

## Docker

```sh
docker-compose up -d
```

`BOT_TOKEN` 環境変数が必要。

## ライセンス

MIT
