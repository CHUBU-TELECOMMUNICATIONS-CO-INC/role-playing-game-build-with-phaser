import type { VariableValue } from "../types/timeline";
import { encryptResultPayload } from "./result_encryption";
import { getVariable, getVariableList } from "./variable_store";

// 回答の種類
export type AnswerRecordType = "choice" | "multi_choice" | "sort_order" | "input_number" | "input_text";

// 1回分の回答履歴
export type AnswerRecord = {
    type: AnswerRecordType;
    key: string; // 回答対象を識別するキー(選択肢の遷移先key、InputNumber/InputTextの変数keyなど)
    value: VariableValue | VariableValue[]; // 選択したテキスト・数値・複数選択の配列など
    elapsedMs: number; // ゲーム開始からこの回答までの経過時間(ms)
};

// ゲーム結果(シナリオ側の変数 result_success/result_score から組み立てる)
export type GameResult = {
    success: boolean;
    score: number | null;
};

// シナリオ側でSetVariableを使って設定する変数名
const RESULT_SUCCESS_KEY = "resultSuccess";
const RESULT_SCORE_KEY = "resultScore";

// 変数ストアからresult_success/result_scoreを読み取り、GameResultを組み立てる
// 未設定の場合は標準値 { success: true, score: null } を返す
function buildGameResult(): GameResult {
    const success = getVariable(RESULT_SUCCESS_KEY);
    const score = getVariable(RESULT_SCORE_KEY);

    return {
        success: success !== false,
        score: typeof score === "number" ? score : null,
    };
}

// 結果送信先の設定(URLクエリパラメータから取得)
let resultUrl: string | undefined;
let resultToken: string | undefined;
let resultPublicKey: string | undefined;
let preferredUsername: string | undefined;
let started_at: number | undefined;

const answers: AnswerRecord[] = [];

// ゲーム開始からの経過時間(ms)を返す(未開始の場合は0)
function elapsedSinceStart(): number {
    return started_at !== undefined ? Date.now() - started_at : 0;
}

// リトライ設定(指数バックオフ): 最大3回試行、待機時間は 0.5s → 1s → 2s
const RETRY_MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 500;

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// 指定URLへJSONをPOST送信する(通信エラー・HTTPエラー応答時は指数バックオフでリトライし、全試行失敗時のみコンソールにエラーを出力する)
async function postResult(url: string, body: unknown, errorMessage: string): Promise<void> {
    const payload = JSON.stringify(body);

    for (let attempt = 1; attempt <= RETRY_MAX_ATTEMPTS; attempt++) {
        try {
            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: payload,
            });

            if (response.ok) {
                return;
            }

            throw new Error(`HTTP ${response.status} ${response.statusText}`);
        } catch (error) {
            if (attempt >= RETRY_MAX_ATTEMPTS) {
                console.error(errorMessage, error);
                return;
            }

            const delayMs = RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
            console.warn(
                `${errorMessage} (${attempt}/${RETRY_MAX_ATTEMPTS}回目、${delayMs}ms後にリトライします)`,
                error,
            );
            await sleep(delayMs);
        }
    }
}

// preferredUsername(起動URLのクエリパラメータ)が設定されているかどうかを返す
export function hasPreferredUsername(): boolean {
    return !!preferredUsername;
}

// URLクエリパラメータ(resultUrl, token, publicKey, preferredUsername)から結果送信先を読み取り、プレイ開始時刻を記録する
export function initGameSession(): void {
    const params = new URLSearchParams(window.location.search);
    resultUrl = params.get("resultUrl") ?? undefined;
    resultToken = params.get("token") ?? undefined;
    resultPublicKey = params.get("publicKey") ?? undefined;
    preferredUsername = params.get("preferredUsername") ?? undefined;
    started_at = Date.now();
    answers.length = 0;
}

// 回答を時系列履歴に追加する
export function recordAnswer(type: AnswerRecordType, key: string, value: VariableValue | VariableValue[]): void {
    answers.push({ type, key, value, elapsedMs: elapsedSinceStart() });
}

// 結果送信先が設定されている場合、回答履歴・プレイ時間をJSONでPhaserWorksへPOST送信する
// publicKeyが指定されている場合はECIES(ECDH + AES-GCM)で本文を暗号化してから送信する
// variablesを指定すると、そのkeyに対応する通常変数(文字列・数値・真偽値)・list変数の値を送信データに追加できる
export async function sendGameResultWithPhaserWorks(variables?: string[]): Promise<void> {
    if (!resultUrl) {
        return;
    }

    const body = {
        token: resultToken,
        playTimeMs: elapsedSinceStart(),
        //answers, //すべての回答
        result: buildGameResult(),
        ...(variables ? { variables: collectVariables(variables) } : {}),
    };

    // encryptResultPayload()の失敗もpostResult()と同じメッセージで捕捉する(postResult自体はfetch失敗を内部で捕捉済み)
    try {
        const requestBody = resultPublicKey ? await encryptResultPayload(body, resultPublicKey) : body;
        await postResult(resultUrl, requestBody, "[ERROR] ゲーム結果の送信に失敗しました");
    } catch (error) {
        console.error("[ERROR] ゲーム結果の送信に失敗しました", error);
    }
}

// 指定されたkey一覧を変数ストアから読み取り、key→値のマップを組み立てる
// 通常変数(文字列・数値・真偽値)として見つかればその値、見つからない場合はlist変数として調べその配列、どちらにも該当しなければnullを格納する
function collectVariables(keys: string[]): Record<string, VariableValue | VariableValue[] | null> {
    return Object.fromEntries(
        keys.map((key) => {
            const value = getVariable(key);
            if (value !== undefined) {
                return [key, value];
            }
            const list = getVariableList(key);
            return [key, list ?? null];
        }),
    );
}

// 指定URLへPower AutomateのHTTP Webhookトリガーが受け取れる形式でJSONをPOST送信する(暗号化は行わない)
// preferredUsername(起動URLのクエリパラメータ)が未設定の場合は、ユーザーを特定できないため送信を中断する
// variablesを指定すると、そのkeyに対応する通常変数(文字列・数値・真偽値)・list変数の値を送信データに追加できる
export async function sendGameResultWithPowerAutomate(url: string, variables?: string[]): Promise<void> {
    if (!preferredUsername) {
        console.error("[ERROR] preferredUsernameが未設定のため、Power Automateへのゲーム結果送信を中断しました");
        return;
    }

    const gameResult = buildGameResult();

    const body = {
        preferredUsername,
        success: gameResult.success,
        score: gameResult.score,
        playTimeMs: elapsedSinceStart(),
        ...(variables ? { variables: collectVariables(variables) } : {}),
    };

    await postResult(url, body, "[ERROR] ゲーム結果(Power Automate)の送信に失敗しました");
}
