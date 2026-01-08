# Phaserで作られたロールプレイングゲーム テンプレート
Phaserで作られたロールプレイングゲームのテンプレートです。

## 概要
このリポジトリは、Phaserフレームワークを使用してブラウザ上で動作するノベルゲームの基本的な構造と機能を示すサンプルプロジェクトです。  
テキスト表示、選択肢、画像表示など、ノベルゲームに必要な要素を実装しています。

なお、 public/assets フォルダ内の画像/音源等は著作権の関係で含まれていません。  
適宜、ご自身で用意したデータを配置してご利用ください。

## 機能
- テキスト表示
- 選択肢の表示と選択
- 画像の表示と切り替え
- シンプルなシーン管理

## 使用技術
- [Phaser](https://phaser.io/) - ゲームフレームワーク
- TypeScript - プログラミング言語
- HTML/CSS - ウェブページの構造とスタイル

## インストールとセットアップ
1. リポジトリをクローンします。
   ```bash
   git clone https://github.com/CHUBU-TELECOMMUNICATIONS-CO-INC/role-playing-game-build-with-phaser.git test-phaser
   cd test-phaser
   ```

2. 依存関係をインストールします。(pnpmを使用推奨)
   ```bash
   pnpm install
   ```

3. 開発サーバーを起動します。
   ```bash
   pnpm dev
   ```

4. src/senario.ts を作成し、シナリオを記述します。

5. ブラウザで `http://localhost:5173/` にアクセスします。

## 配布方法
ビルドコマンドを実行して、配布用のファイルを生成します。
```bash
pnpm build
```
生成されたファイルは `dist` フォルダに格納されます。

## LICENSE
このプロジェクトはMITライセンスの下で公開されています。詳細は `LICENSE` ファイルを参照してください。

## Thanks
このプロジェクトは以下の先駆者の記事を参考にしています。
- [TypeScriptを使ってノベルゲームを作ろう](https://qiita.com/non_cal/items/622108030aa2e516260c)
