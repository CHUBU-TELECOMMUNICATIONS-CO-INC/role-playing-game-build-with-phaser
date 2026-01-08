export class EndingScene extends Phaser.Scene {
    constructor() {
        super('ending');
    }

    create() {
        const { width, height } = this.game.canvas;

        // 背景画像を追加
        this.add.image(width / 2, height / 2, 'title');

        // テキストスタイルを定義
        const text_style: Phaser.Types.GameObjects.Text.TextStyle = {
            fontFamily: 'Meiryo, sans-serif',
            fontSize: '28px',
            color: '#ffffff'
        };

        // 終了メッセージを中央上に表示
        this.add.text(width / 2, height / 2 - 80, 'ロールプレイングが終了しました\nお疲れ様でした', text_style).setOrigin(0.5);
    }
}
