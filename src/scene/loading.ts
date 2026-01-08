import { illustrationFiles, musicFiles } from "../senario";

export class LoadingScene extends Phaser.Scene {
    constructor() {
        super('loading');
    }

    // preload()はシーンが呼び出されたら実行される
    preload() {
        this.load.image('title', 'assets/image/common/title.png');
        this.load.image('ending', 'assets/image/common/ending.png');

        // Preload illustration files
        for (const key in illustrationFiles) {
            this.load.image(key, illustrationFiles[key]);
        }

        // Preload music files
        for (const key in musicFiles) {
            this.load.audio(key, musicFiles[key]);
        }
    }

    // create()はpreload内のアセットのロードが完了したら実行される
    create() {
        // 描画領域のサイズを取得
        const { width, height } = this.game.canvas;

        // ロゴ画像を中央に表示
        //this.add.image(0, 0, 'loading').setOrigin(0);

        // テキストをロゴの下に表示
        this.add.text(width / 2, height / 2 + 60, 'Loading...').setOrigin(0.5);

        // アセットのロードが完了したらTitleSceneに遷移
        this.load.on('complete', () => {
            this.scene.start('title');
        });

        // アセットのロードを開始（preload外でロードを行う場合はこのメソッドを呼ぶ必要がある）
        this.load.start();
    }
}
