import { EventTypeEnum } from './types/timeline';
import { PreloadFileDict, Timelines } from './types/timelines';

export const illustrationFiles: PreloadFileDict = {
    'sample01': 'assets/image/common/sample01.png',
    'sample02': 'assets/image/common/sample02.png',
};

export const musicFiles: PreloadFileDict = {
};

export const senarioData: Timelines = {
    start: [
        { event: EventTypeEnum.ClearForeground },
        { event: EventTypeEnum.ClearBackground },
        { event: EventTypeEnum.SetDialog, text: 'シナリオサンプルを始めます' },
        { event: EventTypeEnum.SetDialog, text: 'どこから始めますか？' },
        {
            event: EventTypeEnum.Choice, choices: [
                { text: 'unit01へ', key: 'unit01' },
                { text: 'test', key: 'test' }
            ]
        }
    ],

    unit01: [
        { event: EventTypeEnum.SetBackground, key: 'sample01' },
        { event: EventTypeEnum.ClearDialog }, //一旦画面を止めるためにクリア
        { event: EventTypeEnum.TimelineTransition, key: 'unit02' },
    ],
    unit02: [
        { event: EventTypeEnum.SetBackground, key: 'sample02' },
        { event: EventTypeEnum.ClearDialog },
        { event: EventTypeEnum.SetDialog, text: 'テストに進みますか？' },
        {
            event: EventTypeEnum.Choice, choices: [
                { text: 'はい', key: 'test' },
                { text: 'いいえ', key: 'unit01' }
            ]
        }
    ],
    test: [
        { event: EventTypeEnum.SetDialog, text: '問題です。\n野菜なのはどれ？\n”正しいもの” を全て選択しなさい。' },
        {
            event: EventTypeEnum.MultiChoice,
            choices: [
                { text: '植物油', correct: false },
                { text: 'バナナ', correct: true },
                { text: 'リンゴ', correct: true },
                { text: '白米', correct: false },
                { text: '牛肉', correct: false },
            ],
            correctKey: 'test_correct',
            incorrectKey: 'test_incorrect',
            shuffle: true
        },
        { event: EventTypeEnum.TimelineTransition, key: 'ending' },
    ],
    test_correct: [
        { event: EventTypeEnum.SetDialog, text: '正解です！' },
        { event: EventTypeEnum.SetDialog, text: '以上でテストは終了です\n終了しますか？' },
        {
            event: EventTypeEnum.Choice, choices: [
                { text: 'はい(終了)', key: 'ending' },
                { text: 'いいえ(もう一度テスト)', key: 'test' }
            ]
        }
    ],
    test_incorrect: [
        { event: EventTypeEnum.SetDialog, text: '残念、不正解です' },
        { event: EventTypeEnum.SetDialog, text: '再度テストに挑みますか？' },
        {
            event: EventTypeEnum.Choice, choices: [
                { text: 'はい(もう一度テスト)', key: 'test' },
                { text: 'いいえ(最初に戻る)', key: 'unit01' }
            ]
        }
    ],
    ending: [
        { event: EventTypeEnum.SceneTransition, key: 'ending' }
    ]
}
