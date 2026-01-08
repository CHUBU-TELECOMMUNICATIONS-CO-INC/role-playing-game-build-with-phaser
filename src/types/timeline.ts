// イベントタイプのenum定義
export enum EventTypeEnum {
    SetDialog = 'dialog',
    ClearDialog = 'clear_dialog',
    SetBackground = 'set_background',
    ClearBackground = 'clear_background',
    SetFrame = 'set_frame',
    AddForeground = 'add_foreground',
    ClearForeground = 'clear_foreground',
    TimelineTransition = 'timeline_transition',
    SceneTransition = 'scene_transition',
    Choice = 'choice',
    MultiChoice = "multi_choice",
    ShowWebLink = 'show_weblink',
    HideWebLink = 'hide_weblink',
    PlaySound = 'play_sound',
    ClearSound = 'clear_sound',
}

// ダイアログ表示イベント
type SetDialogEvent = {
    event: EventTypeEnum.SetDialog,
    text: string,
    textFillColor?: string,
    textFillAlpha?: number,
    actorName?: string,
    actorFillColor?: string,
    actorFillAlpha?: number,
};

// ダイアログ非表示イベント
type ClearDialogEvent = {
    event: EventTypeEnum.ClearDialog
};

// 背景設定イベント
type SetBackgroundEvent = {
    event: EventTypeEnum.SetBackground,
    x?: number,
    y?: number,
    key: string,
    effect?: string
};

// 背景非表示イベント
type ClearBackgroundEvent = {
    event: EventTypeEnum.ClearBackground
};

// 枠設定イベント
type SetFrameEvent = {
    event: EventTypeEnum.SetFrame,
    x?: number,
    y?: number,
    key: string
};

// 前景追加イベント
type AddForegroundEvent = {
    event: EventTypeEnum.AddForeground,
    x?: number,
    y?: number,
    key: string
};

// 前景クリアイベント
type ClearForegroundEvent = {
    event: EventTypeEnum.ClearForeground
};

// タイムライン遷移イベント
type TimelineTransitionEvent = {
    event: EventTypeEnum.TimelineTransition,
    key: string
};

// シーン遷移イベント
type SceneTransitionEvent = {
    event: EventTypeEnum.SceneTransition,
    key: string,
    data?: object
};

// 選択肢イベント
type ChoiceEvent = {
    event: EventTypeEnum.Choice,
    choices: Choice[]
};
export type Choice = {
    text: string,
    key: string // 選択肢選択時の遷移先キー
};

// 複数選択肢イベント
type MultiChoiceEvent = {
    event: EventTypeEnum.MultiChoice,
    choices: MultiChoice[],
    correctKey: string, // 正解時のキー
    incorrectKey: string, // 不正解時のキー
    minSelect?: number,  // 最小選択数(デフォルトは0)
    maxSelect?: number,  // 最大選択数(デフォルトは全選択可能)
    shuffle?: boolean // 選択肢をシャッフルするかどうか(デフォルトはfalse)
};
export type MultiChoice = {
    text: string,
    correct: boolean, // 正解選択肢かどうか
    contraindication?: boolean // 禁忌選択肢かどうか(選択すると強制的に不正解扱いになる)
    point?: number // 選択肢のポイント(スコア計算用)
};

// ウェブリンク表示イベント
type ShowWebLinkEvent = {
    event: EventTypeEnum.ShowWebLink,
    url: string,
    text?: string, // リンクテキスト(デフォルトはurl)
    target?: string // デフォルトは"_blank"
};

type HideWebLinkEvent = {
    event: EventTypeEnum.HideWebLink
};

type PlaySoundEvent = {
    event: EventTypeEnum.PlaySound,
    key: string,
    loop?: boolean
};

type ClearSoundEvent = {
    event: EventTypeEnum.ClearSound,
    key: string
};

// Timelineはイベントの配列
export type Timeline = (
    SetDialogEvent |
    ClearDialogEvent |
    SetBackgroundEvent |
    ClearBackgroundEvent |
    SetFrameEvent |
    AddForegroundEvent |
    ClearForegroundEvent |
    TimelineTransitionEvent |
    SceneTransitionEvent |
    ChoiceEvent |
    MultiChoiceEvent |
    ShowWebLinkEvent |
    HideWebLinkEvent |
    PlaySoundEvent |
    ClearSoundEvent
)[];
