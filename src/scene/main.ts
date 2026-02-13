import { MessageDialog, MessageDialogConfig } from '../classes/message_dialog';
import { TimelinePlayer } from '../classes/timeline_player';
import { Timeline } from '../types/timeline';
import { senarioData } from '../senario';

export class MainScene extends Phaser.Scene {
    private timeline?: Timeline;

    constructor() {
        super('main');
    }

    init(data: any) {
        // this.scene.restart()の第1引数もしくは
        // this.scene.start()の第2引数に指定されたオブジェクトがdataに渡される
        const id = data.id || 'start';

        if (!(id in senarioData)) {
            console.error(`[ERROR] タイムラインID[${id}]は登録されていません`);
            // 登録されていないタイムラインIDが指定されていたらタイトルシーンに遷移する
            this.scene.start('title');
            return;
        }

        this.timeline = senarioData[id];
    }

    create() {
        if (!this.timeline) {
            return;
        }
        const { width, height } = this.game.canvas;

        this.add.image(0, 0, 'street').setOrigin(0);

        // フォントの設定
        const text_style: Phaser.Types.GameObjects.Text.TextStyle = {
            fontFamily: 'Meiryo, sans-serif',
            fontSize: '24px'
        };

        // DialogBoxのコンフィグ
        const message_dialog_height = 160;
        const message_dialog_margin = 20;
        const messaged_dialog_config: MessageDialogConfig = {
            x: (width / 2),
            y: height - (message_dialog_height / 2),
            width: width - (message_dialog_margin * 2),
            height: message_dialog_height,
            padding: 10,
            margin: 0,
            text_style: text_style
        };

        // MessageDialogの作成
        const messageDialog = new MessageDialog(this, messaged_dialog_config);

        // タイムラインプレイヤーの作成
        const timelinePlayer = new TimelinePlayer(this, messageDialog, text_style);

        // タイムラインの再生開始
        timelinePlayer.start(this.timeline);
    }
}
