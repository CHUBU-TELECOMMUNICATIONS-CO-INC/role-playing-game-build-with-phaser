import * as Phaser from "phaser";
import { type Choice, EventTypeEnum, type MultiChoice, type SortOrderItem, type Timeline } from "../types/timeline";
import {
    hasPreferredUsername,
    recordAnswer,
    sendGameResultWithPhaserWorks,
    sendGameResultWithPowerAutomate,
} from "./game_session";
import type { MessageDialog } from "./message_dialog";
import {
    addScore,
    clearVariable,
    clearVariableList,
    decrementVariable,
    evaluateCondition,
    getVariable,
    incrementVariable,
    interpolateVariables,
    popVariableList,
    pushVariableList,
    setVariable,
    setVariableList,
} from "./variable_store";

export class TimelinePlayer {
    private background_layer: Phaser.GameObjects.Container;
    private foreground_layer: Phaser.GameObjects.Container;
    private frame_layer: Phaser.GameObjects.Container;
    private ui_layer: Phaser.GameObjects.Container;
    private hit_area: Phaser.GameObjects.Zone;

    private timeline?: Timeline;
    private timeline_index = 0;

    private weblink_box: Phaser.GameObjects.Rectangle | undefined;
    private weblink_text: Phaser.GameObjects.Text | undefined;

    private sending_indicator: Phaser.GameObjects.Text | undefined; // ゲーム結果送信中インジケータ

    private typing_timer: Phaser.Time.TimerEvent | undefined; // タイマーを保存するプロパティ

    constructor(
        private scene: Phaser.Scene,
        private message_dialog: MessageDialog,
        private text_style: Phaser.Types.GameObjects.Text.TextStyle = {},
    ) {
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
            useHandCursor: true,
        });

        // hit_areaをクリックしたらnext()を実行
        this.hit_area.on("pointerdown", () => {
            this.next();
        });

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
            case "fadein":
                // フェードインエフェクトの場合
                background_image.setAlpha(0); // 初期透明度を0に設定

                // 背景レイヤーに画像オブジェクトを配置
                this.background_layer.add(background_image);

                // フェードインエフェクトを追加
                this.scene.tweens.add({
                    targets: background_image,
                    alpha: 1, // 最終透明度を1に
                    duration: 1000, // 1000msでフェードイン
                    ease: "Linear", // 線形補間
                });
                break;

            case "fadeout":
                // フェードインエフェクトの場合
                background_image.setAlpha(1); // 初期透明度を1に設定

                // 背景レイヤーに画像オブジェクトを配置
                this.background_layer.add(background_image);

                // フェードアウトエフェクトを追加
                this.scene.tweens.add({
                    targets: background_image,
                    alpha: 0, // 最終透明度を0に
                    duration: 1000, // 1000msでフェードアウト
                    ease: "Linear", // 線形補間
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

    // 矩形ボタンを作成し、UIレイヤーに追加してhoverで色が切り替わるようにする(戻り値のボタンにpointerdownハンドラを別途登録する)
    private createHoverButton(
        x: number,
        y: number,
        width: number,
        height: number,
        fillColor: number,
        hoverColor: number,
    ): Phaser.GameObjects.Rectangle {
        const button = new Phaser.GameObjects.Rectangle(this.scene, x, y, width, height, fillColor).setStrokeStyle(
            1,
            0xffffff,
        );
        button.setInteractive({ useHandCursor: true });
        button.on("pointerover", () => {
            button.setFillStyle(hoverColor);
        });
        button.on("pointerout", () => {
            button.setFillStyle(fillColor);
        });
        this.ui_layer.add(button);
        return button;
    }

    // ボタン中央に配置するラベルテキストを作成し、UIレイヤーに追加する
    private createButtonLabel(x: number, y: number, text: string): Phaser.GameObjects.Text {
        const label = new Phaser.GameObjects.Text(this.scene, x, y, text, this.text_style).setOrigin(0.5);
        this.ui_layer.add(label);
        return label;
    }

    // 選択肢ボタンをセット
    private setChoiceButtons(choices: Choice[], scoreKey: string = "score") {
        // 表示条件を満たす選択肢のみに絞り込む
        const visible_choices = choices.filter((choice) => !choice.condition || evaluateCondition(choice.condition));

        if (visible_choices.length === 0) {
            return;
        }
        this.hit_area.disableInteractive(); // hitAreaのクリックを無効化

        // ボタンを中央に配置するようにボタングループのY原点を計算
        const button_height = 40,
            button_margin = 40;
        const { width, height } = this.scene.game.canvas;
        const button_group_height =
            button_height * visible_choices.length + button_margin * (visible_choices.length - 1);
        const button_group_origin_y = height / 2 - button_group_height / 2;

        visible_choices.forEach((choice, index) => {
            const y = button_group_origin_y + button_height * (index + 0.5) + button_margin * index;

            const button = this.createHoverButton(
                width / 2,
                y,
                width - button_margin * 2,
                button_height,
                0x000000,
                0x333333,
            );

            // ボタンクリックでシーンをリスタートし、指定のタイムラインを実行する
            button.on("pointerdown", () => {
                // pointが設定されていればscoreKeyへ加算する(correctKey相当の分岐は+point/incorrectKey相当は未設定のため+0)
                if (choice.point !== undefined) {
                    addScore(scoreKey, choice.point);
                }
                // 選択結果を回答履歴に記録
                recordAnswer("choice", choice.key, choice.text);
                // restart()の引数がシーンのinit()の引数に渡される
                this.scene.scene.restart({ id: choice.key });
            });

            this.createButtonLabel(width / 2, y, choice.text);
        });
    }

    // 複数選択肢ボタンをセット
    private setMultiChoiceButtons(
        multiChoices: MultiChoice[],
        correctKey: string,
        incorrectKey: string,
        shuffle: boolean = false,
        minSelect: number = 0,
        maxSelect?: number,
        scoreKey: string = "score",
    ) {
        // 表示条件を満たす選択肢のみに絞り込む
        const visible_choices = multiChoices.filter(
            (choice) => !choice.condition || evaluateCondition(choice.condition),
        );

        if (visible_choices.length === 0) {
            return;
        }
        this.hit_area.disableInteractive();

        const button_height = 80;
        const button_margin = 10;
        const { width, height } = this.scene.game.canvas;
        const button_group_height =
            button_height * visible_choices.length + button_margin * (visible_choices.length - 1);
        // ダイアログ領域分を下部に確保して、ボタン群を上にシフト
        const dialogReserve = 180; // 必要に応じて調整（ダイアログ高さに合わせる）
        const button_group_origin_y = Math.max(20, height / 2 - button_group_height / 2 - dialogReserve);

        const selected = new Set<number>();

        // 表示順序を作成（shuffle=true の場合は Fisher-Yates で並び替え）
        const order = visible_choices.map((_, i) => i);
        if (shuffle) {
            for (let i = order.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                const tmp = order[i];
                order[i] = order[j];
                order[j] = tmp;
            }
        }

        // order に従って表示（order 要素は visible_choices のインデックス）
        order.forEach((origIndex, displayIndex) => {
            const choice = visible_choices[origIndex];
            const y = button_group_origin_y + button_height * (displayIndex + 0.5) + button_margin * displayIndex;

            // 選択済みかどうかでpointerout時の色が変わるため、hoverColorはpointerout側で都度setFillStyleし直す
            const button = this.createHoverButton(
                width / 2,
                y,
                width - button_margin * 2,
                button_height,
                0x000000,
                0x222222,
            );
            button.on("pointerout", () => {
                // 選択済みなら強い色、未選択なら黒
                button.setFillStyle(selected.has(origIndex) ? 0x663333 : 0x000000);
            });

            button.on("pointerdown", () => {
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

            this.createButtonLabel(width / 2, y, choice.text);
        });

        // 下部に「選択完了」ボタンを追加
        const finishY = Math.max(60, height - dialogReserve - 40);
        const finishButton = this.createHoverButton(width / 2, finishY, 240, 40, 0x000000, 0x222222);
        this.createButtonLabel(width / 2, finishY, "選択完了(採点する)");

        finishButton.on("pointerdown", () => {
            // 最低選択数チェック
            if (selected.size < minSelect) {
                // 必要ならフィードバックを出す（現状は何もしない）
                return;
            }

            // 正解インデックス集合を作る（visible_choices のインデックス基準）
            const correctIndices = new Set<number>();
            visible_choices.forEach((c, i) => {
                if (c.correct) correctIndices.add(i);
            });

            // 判定: 選択集合が正解集合と一致しているか
            let isCorrect = selected.size === correctIndices.size;
            if (isCorrect) {
                for (const idx of correctIndices) {
                    if (!selected.has(idx)) {
                        isCorrect = false;
                        break;
                    }
                }
            }

            // 正誤に応じてscoreKeyへ加点する(correctKey相当なら+1、incorrectKey相当なら+0)
            addScore(scoreKey, isCorrect ? 1 : 0);

            // 選択結果を回答履歴に記録
            const selectedTexts = Array.from(selected)
                .sort((a, b) => a - b)
                .map((idx) => visible_choices[idx].text);
            recordAnswer("multi_choice", isCorrect ? correctKey : incorrectKey, selectedTexts);

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
    }

    // 並び替えボタンの左側に表示する順序ラベル文字列を生成する("number"なら1始まり、"alphabet"なら A,B,...,Z,AA,AB,... )
    private formatSortOrderLabel(slotIndex: number, labelStyle: "number" | "alphabet"): string {
        if (labelStyle === "number") {
            return String(slotIndex + 1);
        }

        // アルファベット(26進数風)に変換する。26個を超えたらAA, AB, ...と桁上がりする
        let n = slotIndex;
        let label = "";
        do {
            label = String.fromCharCode(65 + (n % 26)) + label;
            n = Math.floor(n / 26) - 1;
        } while (n >= 0);
        return label;
    }

    // 並び替えUIをセット(ドラッグ&ドロップで選択肢の順序を入れ替えさせ、正しい順序かどうかを判定する)
    private setSortOrderButtons(
        items: SortOrderItem[],
        correctKey: string,
        incorrectKey: string,
        shuffle: boolean = true,
        scoreKey: string = "score",
        labelStyle: "number" | "alphabet" = "number",
    ) {
        if (items.length === 0) {
            return;
        }
        this.hit_area.disableInteractive();

        const button_height = 60;
        const button_margin = 10;
        const { width, height } = this.scene.game.canvas;
        const button_group_height = button_height * items.length + button_margin * (items.length - 1);
        const dialogReserve = 180; // ダイアログ領域分を下部に確保して、ボタン群を上にシフト
        const button_group_origin_y = Math.max(20, height / 2 - button_group_height / 2 - dialogReserve);
        const slotY = (slotIndex: number) =>
            button_group_origin_y + button_height * (slotIndex + 0.5) + button_margin * slotIndex;

        // 順序ラベル(左側に固定表示する番号/アルファベット)の分だけボタン本体の横幅と中心Xをずらす
        const order_label_width = 44;
        const order_label_x = order_label_width / 2 + button_margin;
        const button_center_x = width / 2 + order_label_width / 2;
        const button_width = width - button_margin * 2 - order_label_width;

        // スロット位置(表示上の順番)を示すラベルは並び替えても位置が動かないようスロットに固定表示する
        items.forEach((_, slotIndex) => {
            const label = this.createButtonLabel(
                order_label_x,
                slotY(slotIndex),
                this.formatSortOrderLabel(slotIndex, labelStyle),
            );
            label.setFontStyle("bold");
        });

        // 初期の表示順序を作成(shuffleの場合はFisher-Yatesで並び替え、正解順のまま出さないようにする)
        const order = items.map((_, i) => i); // orderIndex(表示スロット) -> items配列上のインデックス
        if (shuffle) {
            for (let i = order.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                const tmp = order[i];
                order[i] = order[j];
                order[j] = tmp;
            }
        }

        type SortButton = {
            itemIndex: number;
            button: Phaser.GameObjects.Rectangle;
            label: Phaser.GameObjects.Text;
        };

        // order[slotIndex]のitemIndexに対応するSortButtonをslotIndexの位置へ配置する
        const buttons: SortButton[] = order.map((itemIndex) => {
            const button = this.createHoverButton(
                button_center_x,
                0, // 位置は直後のlayout()で設定する
                button_width,
                button_height,
                0x000000,
                0x333333,
            );
            const label = this.createButtonLabel(button_center_x, 0, items[itemIndex].text);
            return { itemIndex, button, label };
        });

        let dragging: SortButton | undefined;

        // 現在のorderに従って、ドラッグ中以外のボタン位置をアニメーションさせながら揃える
        const layout = (animate: boolean) => {
            buttons.forEach((sortButton) => {
                if (sortButton === dragging) {
                    return;
                }
                const slotIndex = order.indexOf(sortButton.itemIndex);
                const y = slotY(slotIndex);
                if (animate) {
                    this.scene.tweens.add({ targets: [sortButton.button, sortButton.label], y, duration: 150 });
                } else {
                    sortButton.button.y = y;
                    sortButton.label.y = y;
                }
            });
        };
        layout(false);

        buttons.forEach((sortButton) => {
            this.scene.input.setDraggable(sortButton.button);

            sortButton.button.on("dragstart", () => {
                dragging = sortButton;
                this.ui_layer.bringToTop(sortButton.button);
                this.ui_layer.bringToTop(sortButton.label);
            });

            sortButton.button.on("drag", (_pointer: Phaser.Input.Pointer, _dragX: number, dragY: number) => {
                sortButton.button.y = dragY;
                sortButton.label.setPosition(button_center_x, dragY);

                // ドラッグ中のY座標から現在配置すべきスロットを求め、orderを組み替える
                const fromSlot = order.indexOf(sortButton.itemIndex);
                let toSlot = Math.round((dragY - button_group_origin_y) / (button_height + button_margin) - 0.5);
                toSlot = Math.max(0, Math.min(items.length - 1, toSlot));
                if (toSlot !== fromSlot) {
                    order.splice(fromSlot, 1);
                    order.splice(toSlot, 0, sortButton.itemIndex);
                    layout(true);
                }
            });

            sortButton.button.on("dragend", () => {
                dragging = undefined;
                layout(true);
            });
        });

        // 下部に「判定する」ボタンを追加
        const finishY = Math.max(60, height - dialogReserve - 40);
        const finishButton = this.createHoverButton(width / 2, finishY, 240, 40, 0x000000, 0x222222);
        this.createButtonLabel(width / 2, finishY, "この順番で判定する");

        finishButton.on("pointerdown", () => {
            // orderがitemsの元の並び(0,1,2,...)と一致していれば正解
            const isCorrect = order.every((itemIndex, slotIndex) => itemIndex === slotIndex);

            addScore(scoreKey, isCorrect ? 1 : 0);

            // 判定時点の並び順(表示テキスト)を回答履歴に記録
            const orderedTexts = order.map((itemIndex) => items[itemIndex].text);
            recordAnswer("sort_order", isCorrect ? correctKey : incorrectKey, orderedTexts);

            if (isCorrect && correctKey) {
                this.scene.scene.restart({ id: correctKey });
            } else if (!isCorrect && incorrectKey) {
                this.scene.scene.restart({ id: incorrectKey });
            } else {
                this.hit_area.setInteractive({ useHandCursor: true });
            }
        });
    }

    // 数値入力UIをセット
    private setNumberInput(
        key: string,
        min: number | undefined,
        max: number | undefined,
        defaultValue: number | undefined,
        step: number,
    ) {
        this.hit_area.disableInteractive(); // hitAreaのクリックを無効化

        const { width, height } = this.scene.game.canvas;

        let value = defaultValue ?? min ?? 0;
        if (min !== undefined) value = Math.max(min, value);
        if (max !== undefined) value = Math.min(max, value);

        // 表示用の文字列バッファ(キー入力中の未確定値をそのまま表示するためnumberではなくstringで保持)
        let inputText = String(value);

        const created: Phaser.GameObjects.GameObject[] = [];

        const centerY = height / 2 - 40;
        const buttonSize = 50;
        const valueBoxWidth = 160;
        const gap = 20;

        // マイナスボタン
        const minusButton = this.createHoverButton(
            width / 2 - valueBoxWidth / 2 - gap - buttonSize / 2,
            centerY,
            buttonSize,
            buttonSize,
            0x000000,
            0x333333,
        );
        created.push(minusButton);
        created.push(this.createButtonLabel(minusButton.x, centerY, "-"));

        // プラスボタン
        const plusButton = this.createHoverButton(
            width / 2 + valueBoxWidth / 2 + gap + buttonSize / 2,
            centerY,
            buttonSize,
            buttonSize,
            0x000000,
            0x333333,
        );
        created.push(plusButton);
        created.push(this.createButtonLabel(plusButton.x, centerY, "+"));

        // 値表示ボックス
        const valueBox = new Phaser.GameObjects.Rectangle(
            this.scene,
            width / 2,
            centerY,
            valueBoxWidth,
            buttonSize,
            0x000000,
        ).setStrokeStyle(1, 0xffffff);
        this.ui_layer.add(valueBox);
        created.push(valueBox);

        const valueText = this.createButtonLabel(width / 2, centerY, inputText);
        created.push(valueText);

        // 決定ボタン
        const decideY = centerY + buttonSize + 40;
        const decideButton = this.createHoverButton(width / 2, decideY, 160, 40, 0x000000, 0x333333);
        created.push(decideButton);
        created.push(this.createButtonLabel(width / 2, decideY, "決定"));

        // -/+ボタンがmin/maxに達しているかを視覚的に反映
        const refreshButtonState = () => {
            const current = Number(inputText);
            const atMin = min !== undefined && Number.isFinite(current) && current <= min;
            const atMax = max !== undefined && Number.isFinite(current) && current >= max;
            minusButton.setAlpha(atMin ? 0.4 : 1);
            plusButton.setAlpha(atMax ? 0.4 : 1);
        };
        refreshButtonState();

        minusButton.on("pointerdown", () => {
            let current = Number(inputText);
            if (!Number.isFinite(current)) current = min ?? 0;
            current -= step;
            if (min !== undefined) current = Math.max(min, current);
            if (max !== undefined) current = Math.min(max, current);
            inputText = String(current);
            valueText.setText(inputText);
            refreshButtonState();
        });

        plusButton.on("pointerdown", () => {
            let current = Number(inputText);
            if (!Number.isFinite(current)) current = min ?? 0;
            current += step;
            if (min !== undefined) current = Math.max(min, current);
            if (max !== undefined) current = Math.min(max, current);
            inputText = String(current);
            valueText.setText(inputText);
            refreshButtonState();
        });

        // このメソッドで生成した全GameObjectとキーボードリスナーを破棄する
        const cleanup = () => {
            for (const obj of created) {
                obj.destroy();
            }
            this.scene.input.keyboard?.off("keydown", keydownHandler);
        };

        // 決定処理(決定ボタン押下 / Enterキー共通)
        // キー入力中はmin/maxチェックを行わず、決定時にのみ数値へ変換しクランプする
        const confirm = () => {
            const parsed = Number(inputText);
            const finalValueRaw =
                inputText !== "" && inputText !== "-" && Number.isFinite(parsed) ? parsed : (min ?? 0);
            let finalValue = finalValueRaw;
            if (min !== undefined) finalValue = Math.max(min, finalValue);
            if (max !== undefined) finalValue = Math.min(max, finalValue);
            setVariable(key, finalValue);
            recordAnswer("input_number", key, finalValue);
            cleanup();
            this.hit_area.setInteractive({ useHandCursor: true });
            this.next();
        };

        decideButton.on("pointerdown", () => {
            confirm();
        });

        // キーボード入力(0-9で追記、Backspaceで削除、Enterで決定)
        const allowNegative = min === undefined || min < 0;
        const keydownHandler = (event: KeyboardEvent) => {
            if (event.key >= "0" && event.key <= "9") {
                inputText += event.key;
            } else if (event.key === "-" && allowNegative && inputText === "") {
                inputText = "-";
            } else if (event.key === "Backspace") {
                inputText = inputText.slice(0, -1);
            } else if (event.key === "Enter") {
                confirm();
                return;
            } else {
                return;
            }
            valueText.setText(inputText);
            refreshButtonState();
        };
        this.scene.input.keyboard?.on("keydown", keydownHandler);
    }

    // 複数行テキスト入力UIをセット
    // 同keyの変数値が既に存在する場合はそれを初期表示値として優先する(再入力時に前回値を修正できるようにするため)
    // 実際の文字入力は透明なHTML textareaに任せ、IME(日本語入力)をブラウザ標準機能でそのまま使えるようにする
    private setTextInput(
        key: string,
        defaultValue: string | undefined,
        maxLength: number | undefined,
        placeholder: string | undefined,
        required: boolean,
    ) {
        this.hit_area.disableInteractive(); // hitAreaのクリックを無効化

        const canvas = this.scene.game.canvas;
        const { width, height } = canvas;

        const existing = getVariable(key);
        const initialText = existing !== undefined ? String(existing) : (defaultValue ?? "");

        const created: Phaser.GameObjects.GameObject[] = [];

        const boxWidth = width - 160;
        const boxHeight = 160;
        const boxY = height / 2 - 60;

        // 入力欄の背景ボックス
        const inputBox = new Phaser.GameObjects.Rectangle(
            this.scene,
            width / 2,
            boxY,
            boxWidth,
            boxHeight,
            0x000000,
        ).setStrokeStyle(1, 0xffffff);
        this.ui_layer.add(inputBox);
        created.push(inputBox);

        // 入力テキスト(複数行・折返し表示。実体はtextareaのvalueを反映するだけの表示用)
        const inputDisplay = new Phaser.GameObjects.Text(this.scene, width / 2, boxY, "", {
            fontSize: "16px",
            color: "#ffffff",
            wordWrap: { width: boxWidth - 40 },
            ...this.text_style,
        }).setOrigin(0.5);
        this.ui_layer.add(inputDisplay);
        created.push(inputDisplay);

        const placeholderColor = "#888888";
        const textColor = "#ffffff";
        const refreshDisplay = (text: string) => {
            if (text === "") {
                inputDisplay.setColor(placeholderColor);
                inputDisplay.setText(placeholder ?? "");
            } else {
                inputDisplay.setColor(textColor);
                inputDisplay.setText(text);
            }
        };
        refreshDisplay(initialText);

        // 決定ボタン
        const decideY = boxY + boxHeight / 2 + 40;
        const decideButton = this.createHoverButton(width / 2, decideY, 160, 40, 0x000000, 0x333333);
        created.push(decideButton);
        created.push(this.createButtonLabel(width / 2, decideY, "決定"));

        // 入力必須時の警告テキスト(未入力のまま決定しようとした場合のみ表示する)
        const warningText = new Phaser.GameObjects.Text(this.scene, width / 2, decideY + 40, "入力してください", {
            fontSize: "16px",
            color: "#ff6666",
            ...this.text_style,
        })
            .setOrigin(0.5)
            .setVisible(false);
        this.ui_layer.add(warningText);
        created.push(warningText);

        // 実入力を受け持つ透明なtextarea(IMEはブラウザ標準機能にそのまま任せる)
        const textarea = document.createElement("textarea");
        textarea.value = initialText;
        if (maxLength !== undefined) {
            textarea.maxLength = maxLength;
        }
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        textarea.style.resize = "none";
        textarea.style.border = "none";
        textarea.style.outline = "none";
        textarea.style.padding = "0";
        textarea.style.zIndex = "1000";
        document.body.appendChild(textarea);

        // canvasの表示位置・スケールに合わせてtextareaを重ねる(CSSでcanvasが拡縮されていても位置がずれないようにする)
        const syncPosition = () => {
            const rect = canvas.getBoundingClientRect();
            const scaleX = rect.width / width;
            const scaleY = rect.height / height;
            textarea.style.left = `${rect.left + (width / 2 - boxWidth / 2) * scaleX}px`;
            textarea.style.top = `${rect.top + (boxY - boxHeight / 2) * scaleY}px`;
            textarea.style.width = `${boxWidth * scaleX}px`;
            textarea.style.height = `${boxHeight * scaleY}px`;
        };
        syncPosition();
        textarea.focus();

        window.addEventListener("resize", syncPosition);

        // このメソッドで生成した全GameObject・textarea・イベントリスナーを破棄する
        const cleanup = () => {
            for (const obj of created) {
                obj.destroy();
            }
            window.removeEventListener("resize", syncPosition);
            textarea.removeEventListener("input", inputHandler);
            textarea.removeEventListener("keydown", keydownHandler);
            textarea.remove();
            this.scene.events.off("shutdown", cleanup);
        };
        // シーンが途中で破棄された場合でもtextareaが残留しないようにする
        this.scene.events.once("shutdown", cleanup);

        // 決定処理(決定ボタン押下 / Ctrl+Enter・Cmd+Enter共通)
        const confirm = () => {
            const finalValue = textarea.value;
            // 入力必須の場合、空文字・空白のみの入力は決定させず警告を表示して入力欄へ戻す
            if (required && finalValue.trim() === "") {
                warningText.setVisible(true);
                textarea.focus();
                return;
            }
            setVariable(key, finalValue);
            recordAnswer("input_text", key, finalValue);
            cleanup();
            this.hit_area.setInteractive({ useHandCursor: true });
            this.next();
        };

        decideButton.on("pointerdown", () => {
            confirm();
        });

        // textareaの入力内容をPhaser側の表示テキストへ反映(IME変換中の文字も含めそのまま表示)
        const inputHandler = () => {
            refreshDisplay(textarea.value);
            // 入力が行われたら警告を消す(修正操作中に警告が出続けないようにする)
            if (warningText.visible && textarea.value.trim() !== "") {
                warningText.setVisible(false);
            }
        };
        textarea.addEventListener("input", inputHandler);

        // Ctrl+Enter/Cmd+Enterで決定(IME変換確定のEnterと区別するためisComposing中は無視する)
        const keydownHandler = (event: KeyboardEvent) => {
            if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && !event.isComposing) {
                event.preventDefault();
                confirm();
            }
        };
        textarea.addEventListener("keydown", keydownHandler);
    }

    private showWebLink(url: string, text: string | undefined, target: string | undefined = "_blank") {
        // 既存のWebリンクボックスがあれば削除
        this.hideWebLink();

        const { width, height } = this.scene.game.canvas;
        const box_x = width / 2;
        const box_y = height / 2;

        // パディング設定
        const padding_horizontal = 30;
        const padding_vertical = 20;
        const max_width = width - 100; // 画面幅から余裕を取る

        // リンクテキストを作成（サイズ計測用）
        const display_text = text || url;
        const temp_text = new Phaser.GameObjects.Text(this.scene, 0, 0, display_text, {
            fontSize: "16px",
            color: "#00ccff",
            wordWrap: { width: max_width },
            ...this.text_style,
        });

        // テキストサイズを取得
        const text_bounds = temp_text.getBounds();
        const text_width = text_bounds.width;
        const text_height = text_bounds.height;

        // ボックスサイズを計算（テキストサイズ + パディング）
        let box_width = Math.min(text_width + padding_horizontal * 2, max_width);
        const box_height = text_height + padding_vertical * 2;

        // 最小サイズを設定
        if (box_width < 200) {
            box_width = 200;
        }

        // Webリンクボックスを作成（画面ほぼ中央）
        this.weblink_box = new Phaser.GameObjects.Rectangle(
            this.scene,
            box_x,
            box_y,
            box_width,
            box_height,
            0x1a1a1a,
        ).setStrokeStyle(2, 0x00ccff);

        this.weblink_box.setInteractive({ useHandCursor: true });

        // ホバーエフェクト
        this.weblink_box.on("pointerover", () => {
            this.weblink_box?.setFillStyle(0x333333);
        });
        this.weblink_box.on("pointerout", () => {
            this.weblink_box?.setFillStyle(0x1a1a1a);
        });

        // クリック時にリンクを開く
        this.weblink_box.on("pointerdown", () => {
            window.open(url, target);
        });

        this.ui_layer.add(this.weblink_box);

        // リンクテキストを配置（テンポラリテキストは削除）
        temp_text.destroy();

        this.weblink_text = new Phaser.GameObjects.Text(this.scene, box_x, box_y, display_text, {
            fontSize: "16px",
            color: "#00ccff",
            wordWrap: { width: box_width - padding_horizontal * 2 },
            ...this.text_style,
        }).setOrigin(0.5);

        this.ui_layer.add(this.weblink_text);
    }

    private hideWebLink() {
        // Webリンクボックスを削除
        if (this.weblink_box) {
            this.weblink_box.destroy();
            this.weblink_box = undefined;
        }
        if (this.weblink_text) {
            this.weblink_text.destroy();
            this.weblink_text = undefined;
        }
    }

    // ゲーム結果送信中インジケータを表示し、hitAreaのクリックを無効化する
    private showSendingIndicator() {
        this.hit_area.disableInteractive();

        const { width, height } = this.scene.game.canvas;
        this.sending_indicator = new Phaser.GameObjects.Text(this.scene, width / 2, height / 2, "送信中...", {
            fontSize: "20px",
            color: "#ffffff",
            ...this.text_style,
        }).setOrigin(0.5);

        this.ui_layer.add(this.sending_indicator);
    }

    // ゲーム結果送信中インジケータを削除し、hitAreaのクリックを再度有効化する
    private hideSendingIndicator() {
        if (this.sending_indicator) {
            this.sending_indicator.destroy();
            this.sending_indicator = undefined;
        }
        this.hit_area.setInteractive({ useHandCursor: true });
    }

    // Soundの再生
    private playSound(key: string, loop: boolean) {
        const sound = this.scene.sound.get(key) as Phaser.Sound.BaseSound;
        if (sound?.isPlaying) {
            return;
        }
        this.scene.sound.play(key, { loop: loop });
    }

    // Soundの再生を停止
    private clearSound(key: string) {
        const sound = this.scene.sound.get(key) as Phaser.Sound.BaseSound;
        if (sound?.isPlaying) {
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
                this.message_dialog.setText(interpolateVariables(currentEvent.text));
            }
        }

        // タイムラインのイベントを取得してから、timelineIndexをインクリメント
        const timeline_event = this.timeline[this.timeline_index++];

        let color: string;
        let alpha: number;
        switch (timeline_event.event) {
            case EventTypeEnum.ClickWait: // クリック待機イベント(hit_areaのクリックでnext()が呼ばれるまで何もしない)
                break;

            case EventTypeEnum.SetDialog: // ダイアログイベント
                // initialize actor box fill color
                color = "#000000";
                alpha = 1.0;
                if (timeline_event.actorFillColor?.startsWith("#")) {
                    // actorFillColorが設定されていたら名前背景の色を変更
                    color = timeline_event.actorFillColor;
                }
                if (timeline_event.actorFillAlpha !== undefined && typeof timeline_event.actorFillAlpha === "number") {
                    // actorFillAlphaが設定されていたら名前背景の透明度を変更
                    alpha = timeline_event.actorFillAlpha;
                }
                this.message_dialog.setActorBoxFillColor(color, alpha);

                if (timeline_event.actorName) {
                    // actorNameが設定されていたら名前を表示
                    this.message_dialog.setActorNameText(timeline_event.actorName);
                } else {
                    // actorNameが設定されていなかったら名前を非表示
                    this.message_dialog.clearActorNameText();
                }

                // initialize text box fill color
                color = "#000000";
                alpha = 1.0;
                if (timeline_event.textFillColor?.startsWith("#")) {
                    // textFillColorが設定されていたら名前背景の色を変更
                    color = timeline_event.textFillColor;
                }
                if (timeline_event.textFillAlpha !== undefined && typeof timeline_event.textFillAlpha === "number") {
                    // textFillAlphaが設定されていたら名前背景の透明度を変更
                    alpha = timeline_event.textFillAlpha;
                }
                this.message_dialog.setTextBoxFillColor(color, alpha);

                // タイピングエフェクトを開始し、タイマーを保存
                this.typing_timer = this.message_dialog.setTextWithTypingEffect(
                    interpolateVariables(timeline_event.text),
                    50,
                );
                break;

            case EventTypeEnum.ClearDialog: // ダイアログ削除イベント
                this.message_dialog.clearActorNameText();
                this.message_dialog.clearText();
                this.next(); // すぐに次のタイムラインを実行する
                break;

            case EventTypeEnum.SetBackground: // 背景設定イベント
                this.setBackground(timeline_event.key, timeline_event.x, timeline_event.y, timeline_event.effect);
                this.next(); // すぐに次のタイムラインを実行する
                break;

            case EventTypeEnum.ClearBackground: // 背景クリアイベント
                this.clearBackground();
                this.next(); // すぐに次のタイムラインを実行する
                break;

            case EventTypeEnum.SetFrame: // 画面枠設定イベント
                this.setFrame(timeline_event.key);
                this.next(); // すぐに次のタイムラインを実行する
                break;

            case EventTypeEnum.AddForeground: // 前景追加イベント
                this.addForeground(timeline_event.key, timeline_event.x, timeline_event.y);
                this.next(); // すぐに次のタイムラインを実行する
                break;

            case EventTypeEnum.ClearForeground: // 前景クリアイベント
                this.clearForeground();
                this.next(); // すぐに次のタイムラインを実行する
                break;

            case EventTypeEnum.TimelineTransition: // タイムライン遷移イベント
                // シーンをリスタートし、指定のタイムラインを実行する
                // restart()の引数がシーンのinit()の引数に渡される
                this.scene.scene.restart({ id: timeline_event.key });
                break;

            case EventTypeEnum.SceneTransition: // シーン遷移イベント
                // 指定のシーンに遷移する
                // start()の第2引数がシーンのinit()の引数に渡される
                this.scene.scene.start(timeline_event.key, timeline_event.data);
                break;

            case EventTypeEnum.Choice: // 選択肢イベント
                this.setChoiceButtons(timeline_event.choices, timeline_event.scoreKey ?? "score");
                break;

            case EventTypeEnum.MultiChoice: // 選択肢イベント
                this.setMultiChoiceButtons(
                    timeline_event.choices,
                    timeline_event.correctKey,
                    timeline_event.incorrectKey,
                    timeline_event.shuffle,
                    timeline_event.minSelect,
                    timeline_event.maxSelect,
                    timeline_event.scoreKey ?? "score",
                );
                break;

            case EventTypeEnum.SortOrder: // 並び替えイベント
                this.setSortOrderButtons(
                    timeline_event.items,
                    timeline_event.correctKey,
                    timeline_event.incorrectKey,
                    timeline_event.shuffle,
                    timeline_event.scoreKey ?? "score",
                    timeline_event.labelStyle ?? "number",
                );
                break;

            case EventTypeEnum.ShowWebLink: // Webリンク表示イベント
                this.showWebLink(timeline_event.url, timeline_event.text, timeline_event.target);
                this.next(); // すぐに次のタイムラインを実行する
                break;

            case EventTypeEnum.HideWebLink: // Webリンククリアイベント
                this.hideWebLink();
                this.next(); // すぐに次のタイムラインを実行する
                break;

            case EventTypeEnum.PlaySound: // Sound再生イベント
                this.playSound(timeline_event.key, timeline_event.loop ?? false);
                this.next(); // すぐに次のタイムラインを実行する
                break;

            case EventTypeEnum.ClearSound: // Soundクリアイベント
                this.clearSound(timeline_event.key);
                this.next(); // すぐに次のタイムラインを実行する
                break;

            case EventTypeEnum.SetVariable: // 変数設定イベント
                setVariable(timeline_event.key, timeline_event.value);
                this.next(); // すぐに次のタイムラインを実行する
                break;

            case EventTypeEnum.ClearVariable: // 変数クリアイベント
                clearVariable(timeline_event.key);
                this.next(); // すぐに次のタイムラインを実行する
                break;

            case EventTypeEnum.IncrementVariable: // 数値変数加算イベント
                incrementVariable(timeline_event.key, timeline_event.value ?? 1);
                this.next(); // すぐに次のタイムラインを実行する
                break;

            case EventTypeEnum.DecrementVariable: // 数値変数減算イベント
                decrementVariable(timeline_event.key, timeline_event.value ?? 1);
                this.next(); // すぐに次のタイムラインを実行する
                break;

            case EventTypeEnum.SetVariableList: // リスト変数設定イベント
                setVariableList(timeline_event.key, timeline_event.values);
                this.next(); // すぐに次のタイムラインを実行する
                break;

            case EventTypeEnum.ClearVariableList: // リスト変数クリアイベント
                clearVariableList(timeline_event.key);
                this.next(); // すぐに次のタイムラインを実行する
                break;

            case EventTypeEnum.PushVariableList: // リスト変数末尾追加イベント
                pushVariableList(timeline_event.key, timeline_event.value);
                this.next(); // すぐに次のタイムラインを実行する
                break;

            case EventTypeEnum.PopVariableList: {
                // リスト変数末尾取り出しイベント
                const popped = popVariableList(timeline_event.key);
                if (popped !== undefined && timeline_event.resultKey) {
                    setVariable(timeline_event.resultKey, popped);
                }
                this.next(); // すぐに次のタイムラインを実行する
                break;
            }

            case EventTypeEnum.InputNumber: // 数値入力イベント
                this.setNumberInput(
                    timeline_event.key,
                    timeline_event.min,
                    timeline_event.max,
                    timeline_event.defaultValue,
                    timeline_event.step ?? 1,
                );
                break;

            case EventTypeEnum.InputText: // 複数行テキスト入力イベント
                this.setTextInput(
                    timeline_event.key,
                    timeline_event.defaultValue,
                    timeline_event.maxLength,
                    timeline_event.placeholder,
                    timeline_event.required ?? false,
                );
                break;

            case EventTypeEnum.SendGameResultWithPhaserWorks: // ゲーム結果送信イベント(結果送信先が設定されていればPhaserWorksへ全データを送信する)
                // 送信完了(リトライ含む)を待ってから次のタイムラインへ進む。
                // 直後にSceneTransitionが続く場合、送信中にシーンが破棄されるとリトライが完遂しないため
                this.showSendingIndicator();
                void sendGameResultWithPhaserWorks(timeline_event.variables).then(() => {
                    this.hideSendingIndicator();
                    this.next();
                });
                break;

            case EventTypeEnum.SendGameResultWithPowerAutomate: // ゲーム結果送信イベント(指定URLへPower Automate向け形式でPOST送信する)
                // 送信完了(リトライ含む)を待ってから次のタイムラインへ進む(理由は上記と同様)
                this.showSendingIndicator();
                void sendGameResultWithPowerAutomate(timeline_event.url, timeline_event.variables).then(() => {
                    this.hideSendingIndicator();
                    this.next();
                });
                break;

            case EventTypeEnum.CheckPreferredUsername: // preferredUsername判定イベント
                if (hasPreferredUsername()) {
                    // OKの場合はそのまま次のタイムラインへ進む
                    this.next();
                } else {
                    // NGの場合はngTextを表示し、タイムラインの進行を停止する
                    if (timeline_event.ngActorName) {
                        this.message_dialog.setActorNameText(timeline_event.ngActorName);
                    } else {
                        this.message_dialog.clearActorNameText();
                    }
                    this.hit_area.disableInteractive();
                    this.typing_timer = this.message_dialog.setTextWithTypingEffect(
                        interpolateVariables(timeline_event.ngText),
                        50,
                    );
                }
                break;

            case EventTypeEnum.CheckCondition: {
                // 変数条件判定イベント: 判定結果に応じて遷移先タイムラインキーを出し分け、シーンをリスタートする
                const condition_result = evaluateCondition(timeline_event.condition);
                this.scene.scene.restart({
                    id: condition_result ? timeline_event.trueKey : timeline_event.falseKey,
                });
                break;
            }

            default:
                break;
        }
    }
}
