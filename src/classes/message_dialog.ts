export type MessageDialogConfig = {
    x: number,
    y: number,
    width: number,
    height: number,
    padding?: number,
    margin?: number,
    text_style?: Phaser.Types.GameObjects.Text.TextStyle
};

// Phaser.GameObjects.Containerを継承してMessageDialogを作成
export class MessageDialog extends Phaser.GameObjects.Container {
    private box: Phaser.GameObjects.Rectangle;
    private text: Phaser.GameObjects.Text;

    private actor_name_box: Phaser.GameObjects.Rectangle;
    private actor_name_text: Phaser.GameObjects.Text;

    private padding: number;

    constructor(public scene: Phaser.Scene, { x, y, width, height, padding = 20, margin = 0, text_style: text_style = {} }: MessageDialogConfig) {
        // Phaser.GameObjects.Containerのコンストラクタ
        super(scene, 0, 0);

        // 白枠付きの黒いRectangleを作成
        this.box = new Phaser.GameObjects.Rectangle(this.scene, x, y, width, height, 0x000000).setStrokeStyle(1, 0xffffff);
        this.add(this.box);  // Containerへの追加

        // wordWrap（折り返し設定）を追加した会話テキスト用のTextStyleを作成
        const dialog_box_text_style = {
            ...text_style,
            wordWrap: { width: width - padding * 2, useAdvancedWrap: true }  // useAdvancedWrapをtrueにすることで日本語の折り返しが有効になる
        };

        // 会話テキスト用のTextを作成
        this.text = new Phaser.GameObjects.Text(this.scene, x - (width / 2) + padding, y - (height / 2) + padding, '', dialog_box_text_style);
        this.add(this.text);  // Containerへの追加

        // 高さ40の白枠付きの黒いRectangleを作成
        this.actor_name_box = new Phaser.GameObjects.Rectangle(this.scene, x - (width / 2), y - (height / 2) - margin, 0, 40, 0x000000).setStrokeStyle(1, 0xffffff);
        this.actor_name_box.setOrigin(0, 1);  // 原点を左下に設定
        this.actor_name_box.setVisible(false);  // 初期状態では非表示
        this.add(this.actor_name_box);  // Containerへの追加

        // 名前テキスト用のTextを作成
        this.actor_name_text = new Phaser.GameObjects.Text(this.scene, x - (width / 2) + padding, y - (height / 2) - margin - 20, '', text_style);
        this.actor_name_text.setOrigin(0, 0.5);  // 原点を左中に設定
        this.actor_name_text.setVisible(false);  // 初期状態では非表示
        this.add(this.actor_name_text);  // Containerへの追加

        this.padding = padding;
    }

    // 会話テキストのセット
    public setText(text: string) {
        this.text.setText(text);
        this.box.setVisible(true);
        this.text.setVisible(true);
    }

    // 会話テキストのクリア（非表示）
    public clearText() {
        this.box.setVisible(false);
        this.text.setVisible(false);
    }

    // 名前テキストのセット
    public setActorNameText(name: string) {
        this.actor_name_text.setText(name);

        // Textの幅に合わせてBoxの幅を調整
        const bounds = this.actor_name_text.getBounds();
        this.actor_name_box.width = bounds.width + this.padding * 2;

        // Rectangleのサイズを変更した際にstrokeがおいてかれる問題の解消
        // https://github.com/photonstorm/phaser/issues/4811
        // @ts-ignore
        this.actor_name_box.geom.width = this.actor_name_box.width;
        // @ts-ignore
        this.actor_name_box.updateData();

        // BoxとTextを表示
        this.actor_name_box.setVisible(true);
        this.actor_name_text.setVisible(true);
    }

    // 名前のクリア（非表示）
    public clearActorNameText() {
        // BoxとTextを非表示
        this.actor_name_box.setVisible(false);
        this.actor_name_text.setVisible(false);
    }
    // テキストボックスの背景色を変更するメソッド
    public setActorBoxFillColor(color: string = "#000000", alpha: number = 1.0) {
        this.actor_name_box.setFillStyle(Phaser.Display.Color.HexStringToColor(color).color, alpha);
    }

    // MessageDialogクラスに追加するメソッド
    public setTextWithTypingEffect(text: string, delay: number = 100): Phaser.Time.TimerEvent {
        this.text.setText('');  // 初期化
        this.box.setVisible(true);
        this.text.setVisible(true);

        const chars = [...text];  // 絵文字を正しく分割
        let index = 0;
        const timer = this.scene.time.addEvent({
            delay: delay,
            callback: () => {
                this.text.setText(chars.slice(0, index + 1).join(''));
                index++;
                if (index >= chars.length) {
                    timer.destroy();  // タイマーを破棄
                }
            },
            loop: true
        });

        // シーン破棄時にタイマーを破棄
        this.scene.events.once('shutdown', () => {
            timer.destroy();
        });

        return timer;  // タイマーを返す
    }

    // テキストボックスの背景色を変更するメソッド
    public setTextBoxFillColor(color: string = "#000000", alpha: number = 1.0) {
        this.box.setFillStyle(Phaser.Display.Color.HexStringToColor(color).color, alpha);
    }
}
