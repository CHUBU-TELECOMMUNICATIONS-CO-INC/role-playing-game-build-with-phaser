import { Choice, EventTypeEnum, MultiChoice, Timeline } from '../types/timeline';
import { MessageDialog } from './message_dialog';

export class TimelinePlayer {
    private background_layer: Phaser.GameObjects.Container;
    private foreground_layer: Phaser.GameObjects.Container;
    private frame_layer: Phaser.GameObjects.Container;
    private ui_layer: Phaser.GameObjects.Container;
    private hit_area: Phaser.GameObjects.Zone;

    private timeline?: Timeline;
    private timeline_index = 0;

    private typing_timer: Phaser.Time.TimerEvent | undefined;  // タイマーを保存するプロパティ

    constructor(private scene: Phaser.Scene, private message_dialog: MessageDialog, private text_style: Phaser.Types.GameObjects.Text.TextStyle = {}) {
        // 背景レイヤー・前景レイヤー・UIレイヤーをコンテナを使って表現
        this.background_layer = this.scene.add.container(0, 0); // 背景用のレイヤー
        this.foreground_layer = this.scene.add.container(0, 0); // 前景用のレイヤー
        this.frame_layer = this.scene.add.container(0, 0); // 画面枠用のレイヤー

        // レイヤーの描画順を明示（小さい値が背面）
        this.background_layer.setDepth(0);
        this.foreground_layer.setDepth(1);
        this.frame_layer.setDepth(2);

        // ダイアログは前景とUIの間に置く
        this.scene.add.existing(this.message_dialog);
        this.message_dialog.setDepth(3);

        this.ui_layer = this.scene.add.container(0, 0);
        this.ui_layer.setDepth(4);

        // クリック領域(hit_area)を画面全体に設定
        const { width, height } = this.scene.game.canvas;
        this.hit_area = new Phaser.GameObjects.Zone(this.scene, width / 2, height / 2, width, height);
        this.hit_area.setInteractive({
            useHandCursor: true
        });

        // hit_areaをクリックしたらnext()を実行
        this.hit_area.on('pointerdown', () => {
            this.next();
        });
        // hit_area を interactive にした直後に、もし hitAreaDebug があれば破棄して非表示にする
        const ia = (this.hit_area as any).input;
        if (ia && ia.hitAreaDebug) {
            try {
                ia.hitAreaDebug.destroy();
            } catch (e) { /* ignore */ }
            ia.hitAreaDebug = null;
        }

        // hitAreaをUIレイヤーに追加
        this.ui_layer.add(this.hit_area);
    }

    // タイムラインの再生を開始
    public start(timeline: Timeline) {
        this.timeline = timeline;
        this.next();
    }

    // 背景画像をセット
    private setBackground(texture: string, x: number | undefined, y: number | undefined, effect: string | undefined) {
        // 現在の背景レイヤーの子を全て削除
        this.background_layer.removeAll();
        const { width, height } = this.scene.game.canvas;
        if (x === undefined) {
            x = width / 2;
        }
        if (y === undefined) {
            y = height / 2;
        }
        // 背景画像のオブジェクトを作成
        const background_image = new Phaser.GameObjects.Image(this.scene, x, y, texture);

        switch (effect) {
            case 'fadein':
                // フェードインエフェクトの場合
                background_image.setAlpha(0);  // 初期透明度を0に設定

                // 背景レイヤーに画像オブジェクトを配置
                this.background_layer.add(background_image);

                // フェードインエフェクトを追加
                this.scene.tweens.add({
                    targets: background_image,
                    alpha: 1,  // 最終透明度を1に
                    duration: 1000,  // 1000msでフェードイン
                    ease: 'Linear'  // 線形補間
                });
                break;

            case 'fadeout':
                // フェードインエフェクトの場合
                background_image.setAlpha(1);  // 初期透明度を1に設定

                // 背景レイヤーに画像オブジェクトを配置
                this.background_layer.add(background_image);

                // フェードアウトエフェクトを追加
                this.scene.tweens.add({
                    targets: background_image,
                    alpha: 0,  // 最終透明度を0に
                    duration: 1000,  // 1000msでフェードアウト
                    ease: 'Linear'  // 線形補間
                });
                break;

            default:
                // 未知のエフェクトの場合はそのまま配置
                this.background_layer.add(background_image);
                break;
        }
    }

    private clearBackground() {
        // 背景レイヤーの子を全て削除
        this.background_layer.removeAll(true);
    }

    // 画面枠をセット
    private setFrame(texture: string) {
        // 画面枠レイヤーの子を全て削除
        this.frame_layer.removeAll(true);
        const { width, height } = this.scene.game.canvas;
        // 画面枠画像のオブジェクトを作成
        const frame_image = new Phaser.GameObjects.Image(this.scene, width / 2, height / 2, texture);
        // 画面枠レイヤーに画像オブジェクトを配置
        this.frame_layer.add(frame_image);
    }

    // 前景画像を追加
    private addForeground(texture: string, x: number | undefined, y: number | undefined) {
        const { width, height } = this.scene.game.canvas;
        if (x === undefined) {
            x = width / 2;
        }
        if (y === undefined) {
            y = height / 2;
        }
        // 前景画像のオブジェクトを作成
        const foreground_image = new Phaser.GameObjects.Image(this.scene, x, y, texture);
        // 前景レイヤーに画像オブジェクトを配置
        this.foreground_layer.add(foreground_image);
    }

    // 前景をクリア
    private clearForeground() {
        // 前景レイヤーの子を全て削除
        this.foreground_layer.removeAll(true);
    }

    // 選択肢ボタンをセット
    private setChoiceButtons(choices: Choice[]) {
        if (choices.length === 0) {
            return;
        }
        this.hit_area.disableInteractive();  // hitAreaのクリックを無効化

        // ボタンを中央に配置するようにボタングループのY原点を計算
        const button_height = 40,
            button_margin = 40;
        const { width, height } = this.scene.game.canvas;
        const button_group_height = button_height * choices.length + button_margin * (choices.length - 1);
        const button_group_origin_y = height / 2 - button_group_height / 2;

        choices.forEach((choice, index) => {
            const y = button_group_origin_y + button_height * (index + 0.5) + button_margin * (index);

            // Rectangleでボタンを作成
            const button = new Phaser.GameObjects.Rectangle(this.scene, width / 2, y, width - button_margin * 2, button_height, 0x000000).setStrokeStyle(1, 0xffffff);
            button.setInteractive({
                useHandCursor: true
            });

            // マウスオーバーで色が変わるように設定
            button.on('pointerover', () => {
                button.setFillStyle(0x333333);
            });
            button.on('pointerout', () => {
                button.setFillStyle(0x000000);
            });

            // ボタンクリックでシーンをリスタートし、指定のタイムラインを実行する
            button.on('pointerdown', () => {
                // restart()の引数がシーンのinit()の引数に渡される
                this.scene.scene.restart({ id: choice.key });
            });

            // ボタンをUIレイヤーに追加
            this.ui_layer.add(button);

            // ボタンテキストを作成
            const button_text = new Phaser.GameObjects.Text(this.scene, width / 2, y, choice.text, this.text_style).setOrigin(0.5);

            // ボタンテキストをUIレイヤーに追加
            this.ui_layer.add(button_text);
        });
    }

    // 複数選択肢ボタンをセット
    private setMultiChoiceButtons(multiChoices: MultiChoice[], correctKey: string, incorrectKey: string, shuffle: boolean = false, minSelect: number = 0, maxSelect?: number) {
        if (multiChoices.length === 0) {
            return;
        }
        this.hit_area.disableInteractive();

        const button_height = 80;
        const button_margin = 10;
        const { width, height } = this.scene.game.canvas;
        const button_group_height = button_height * multiChoices.length + button_margin * (multiChoices.length - 1);
        // ダイアログ領域分を下部に確保して、ボタン群を上にシフト
        const dialogReserve = 180; // 必要に応じて調整（ダイアログ高さに合わせる）
        const button_group_origin_y = Math.max(20, height / 2 - button_group_height / 2 - dialogReserve);

        const selected = new Set<number>();

        // 表示順序を作成（shuffle=true の場合は Fisher-Yates で並び替え）
        const order = multiChoices.map((_, i) => i);
        if (shuffle) {
            for (let i = order.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                const tmp = order[i];
                order[i] = order[j];
                order[j] = tmp;
            }
        }

        // order に従って表示（order 要素は元の multiChoices のインデックス）
        order.forEach((origIndex, displayIndex) => {
            const choice = multiChoices[origIndex];
            const y = button_group_origin_y + button_height * (displayIndex + 0.5) + button_margin * displayIndex;

            const button = new Phaser.GameObjects.Rectangle(this.scene, width / 2, y, width - button_margin * 2, button_height, 0x000000).setStrokeStyle(1, 0xffffff);
            button.setInteractive({ useHandCursor: true });

            // 初期色
            button.setFillStyle(0x000000);

            button.on('pointerover', () => { button.setFillStyle(0x222222); });
            button.on('pointerout', () => {
                // 選択済みなら強い色、未選択なら黒
                button.setFillStyle(selected.has(origIndex) ? 0x663333 : 0x000000);
            });

            button.on('pointerdown', () => {
                if (selected.has(origIndex)) {
                    // 解除
                    selected.delete(origIndex);
                    button.setFillStyle(0x000000);
                } else {
                    // 選択上限がある場合のチェック
                    if (maxSelect === undefined || selected.size < maxSelect) {
                        selected.add(origIndex);
                        button.setFillStyle(0x333333);
                    } else {
                        // 上限に達している場合は何もしない（必要ならフィードバックを追加）
                    }
                }
            });

            this.ui_layer.add(button);

            const button_text = new Phaser.GameObjects.Text(this.scene, width / 2, y, choice.text, this.text_style).setOrigin(0.5);
            this.ui_layer.add(button_text);
        });

        // 下部に「選択完了」ボタンを追加
        const finishY = Math.max(60, height - dialogReserve - 40);
        const finishButton = new Phaser.GameObjects.Rectangle(this.scene, width / 2, finishY, 240, 40, 0x000000).setStrokeStyle(1, 0xffffff);
        finishButton.setInteractive({ useHandCursor: true });

        finishButton.on('pointerover', () => { finishButton.setFillStyle(0x222222); });
        finishButton.on('pointerout', () => { finishButton.setFillStyle(0x000000); });

        const finishText = new Phaser.GameObjects.Text(this.scene, width / 2, finishY, '選択完了(採点する)', this.text_style).setOrigin(0.5);

        finishButton.on('pointerdown', () => {
            // 最低選択数チェック
            if (selected.size < minSelect) {
                // 必要ならフィードバックを出す（現状は何もしない）
                return;
            }

            // 正解インデックス集合を作る（元のインデックス基準）
            const correctIndices = new Set<number>();
            multiChoices.forEach((c, i) => { if (c.correct) correctIndices.add(i); });

            // 判定: 選択集合が正解集合と一致しているか
            let isCorrect = selected.size === correctIndices.size;
            if (isCorrect) {
                for (const idx of correctIndices) {
                    if (!selected.has(idx)) { isCorrect = false; break; }
                }
            }

            // 遷移（restartでtimeline idを渡す）
            if (isCorrect && correctKey) {
                this.scene.scene.restart({ id: correctKey });
            } else if (!isCorrect && incorrectKey) {
                this.scene.scene.restart({ id: incorrectKey });
            } else {
                // キーが無ければ単にUIを再有効化する（必要なら）
                this.hit_area.setInteractive({ useHandCursor: true });
            }
        });

        this.ui_layer.add(finishButton);
        this.ui_layer.add(finishText);
    }

    // Soundの再生
    private playSound(key: string, loop: boolean) {
        const sound = this.scene.sound.get(key) as Phaser.Sound.BaseSound;
        if (sound && sound.isPlaying) {
            return;
        }
        this.scene.sound.play(key, { loop: loop });
    }

    // Soundの再生を停止
    private clearSound(key: string) {
        const sound = this.scene.sound.get(key) as Phaser.Sound.BaseSound;
        if (sound && sound.isPlaying) {
            sound.destroy();
        }
    }

    // 次のタイムラインを実行
    private next() {
        if (!this.timeline) {
            return;
        }
        if (this.timeline_index >= this.timeline.length) {
            return;
        }

        // 既存のタイマーが存在し、全テキストが表示されていない場合、破棄してテキストを即座に完了させる
        if (this.typing_timer) {
            this.typing_timer.destroy();
            this.typing_timer = undefined;
            // テキストを全表示（タイピングエフェクトをスキップ）
            const currentEvent = this.timeline?.[this.timeline_index - 1];
            if (currentEvent?.event === EventTypeEnum.SetDialog) {
                this.message_dialog.setText(currentEvent.text);
            }
        }

        // タイムラインのイベントを取得してから、timelineIndexをインクリメント
        const timeline_event = this.timeline[this.timeline_index++];

        switch (timeline_event.event) {
            case EventTypeEnum.SetDialog:  // ダイアログイベント
                if (timeline_event.actor_name) {
                    // actorNameが設定されていたら名前を表示
                    this.message_dialog.setActorNameText(timeline_event.actor_name);
                } else {
                    // actorNameが設定されていなかったら名前を非表示
                    this.message_dialog.clearActorNameText();
                }
                // タイピングエフェクトを開始し、タイマーを保存
                this.typing_timer = this.message_dialog.setTextWithTypingEffect(timeline_event.text, 50);
                break;

            case EventTypeEnum.ClearDialog:  // ダイアログ削除イベント
                this.message_dialog.clearActorNameText();
                this.message_dialog.clearText();
                break;

            case EventTypeEnum.SetBackground:  // 背景設定イベント
                this.setBackground(timeline_event.key, timeline_event.x, timeline_event.y, timeline_event.effect);
                this.next();  // すぐに次のタイムラインを実行する
                break;

            case EventTypeEnum.ClearBackground:  // 背景クリアイベント
                this.clearBackground();
                this.next();  // すぐに次のタイムラインを実行する
                break;

            case EventTypeEnum.SetFrame:  // 画面枠設定イベント
                this.setFrame(timeline_event.key);
                this.next();  // すぐに次のタイムラインを実行する
                break;

            case EventTypeEnum.AddForeground:  // 前景追加イベント
                this.addForeground(timeline_event.key, timeline_event.x, timeline_event.y);
                this.next();  // すぐに次のタイムラインを実行する
                break;

            case EventTypeEnum.ClearForeground:  // 前景クリアイベント
                this.clearForeground();
                this.next();  // すぐに次のタイムラインを実行する
                break;

            case EventTypeEnum.TimelineTransition:  // タイムライン遷移イベント
                // シーンをリスタートし、指定のタイムラインを実行する
                // restart()の引数がシーンのinit()の引数に渡される
                this.scene.scene.restart({ id: timeline_event.key });
                break;

            case EventTypeEnum.SceneTransition:  // シーン遷移イベント
                // 指定のシーンに遷移する
                // start()の第2引数がシーンのinit()の引数に渡される
                this.scene.scene.start(timeline_event.key, timeline_event.data);
                break;

            case EventTypeEnum.Choice:  // 選択肢イベント
                this.setChoiceButtons(timeline_event.choices);
                break;

            case EventTypeEnum.MultiChoice:  // 選択肢イベント
                this.setMultiChoiceButtons(timeline_event.choices, timeline_event.correctKey, timeline_event.incorrectKey, timeline_event.shuffle, timeline_event.minSelect, timeline_event.maxSelect);
                break;

            case EventTypeEnum.PlaySound:  // Sound再生イベント
                this.playSound(timeline_event.key, timeline_event.loop ?? false);
                this.next();  // すぐに次のタイムラインを実行する
                break;

            case EventTypeEnum.ClearSound:  // Soundクリアイベント
                this.clearSound(timeline_event.key);
                this.next();  // すぐに次のタイムラインを実行する
                break;

            default:
                break;
        }
    }
}
