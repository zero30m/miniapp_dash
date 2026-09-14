const toolImageCache = require('../../utils/tool_image_cache');
const {
    FAN_TEST_ASSETS,
    FAN_TEST_PASS_SCORE,
    FAN_TEST_QUESTIONS,
    getFanTestQuestions,
    scoreFanTest
} = require('../../utils/fan_test_quiz');

Page({
    data: {
        backgroundUrl: toolImageCache.getCachedToolImage(FAN_TEST_ASSETS.background),
        groupQrFileId: toolImageCache.getCachedToolImage(FAN_TEST_ASSETS.groupQr),
        questions: getFanTestQuestions(),
        questionTotal: FAN_TEST_QUESTIONS.length,
        passScore: FAN_TEST_PASS_SCORE,
        currentIndex: 0,
        currentQuestion: null,
        progressPercent: 0,
        answers: [],
        mode: 'quiz',
        result: null
    },

    onLoad() {
        this._imagePageUnloaded = false;
        toolImageCache.loadToolImage(FAN_TEST_ASSETS.background).then(path => {
            if (!this._imagePageUnloaded) this.setData({ backgroundUrl: path });
        }).catch(error => console.warn('[FanTest] Background image failed:', error));
        wx.setNavigationBarTitle({ title: '读者测试' });
        this._showShareMenu();
        this.resetQuiz();
    },

    onUnload() {
        this._imagePageUnloaded = true;
    },

    _showShareMenu() {
        if (!wx.showShareMenu) return;
        try {
            wx.showShareMenu({
                withShareTicket: true,
                menus: ['shareAppMessage', 'shareTimeline']
            });
        } catch (e) {
            console.warn('[FanTest] showShareMenu failed:', e);
        }
    },

    resetQuiz() {
        const questions = getFanTestQuestions();
        const groupQrFileId = this._pickRandomGroupQr();
        this._answerLocked = false;
        this._selectedQrSource = groupQrFileId;
        this.setData({
            groupQrFileId: toolImageCache.getCachedToolImage(groupQrFileId),
            questions,
            questionTotal: questions.length,
            currentIndex: 0,
            currentQuestion: questions[0],
            progressPercent: 100 / questions.length,
            answers: [],
            mode: 'quiz',
            result: null
        }, () => {
            this._preloadGroupQr(groupQrFileId);
        });
    },

    _pickRandomGroupQr() {
        const qrs = FAN_TEST_ASSETS.groupQrs && FAN_TEST_ASSETS.groupQrs.length
            ? FAN_TEST_ASSETS.groupQrs
            : [FAN_TEST_ASSETS.groupQr];
        const index = Math.floor(Math.random() * qrs.length);
        return qrs[index] || FAN_TEST_ASSETS.groupQr;
    },

    _preloadGroupQr(fileId) {
        return toolImageCache.loadToolImage(fileId).then(path => {
            if (!this._imagePageUnloaded && this._selectedQrSource === fileId) {
                this.setData({ groupQrFileId: path });
            }
        }).catch(error => console.warn('[FanTest] Group QR image failed:', error));
    },

    onOptionTap(e) {
        if (this._answerLocked || this.data.mode !== 'quiz') return;

        const key = e.currentTarget.dataset.key;
        if (!key) return;

        this._answerLocked = true;

        const questions = this.data.questions && this.data.questions.length
            ? this.data.questions
            : getFanTestQuestions();
        const answers = this.data.answers.slice(0, this.data.currentIndex).concat(key);
        const nextIndex = this.data.currentIndex + 1;

        if (nextIndex >= questions.length) {
            this.finishQuiz(answers);
            this._answerLocked = false;
            return;
        }

        this.setData({
            answers,
            currentIndex: nextIndex,
            currentQuestion: questions[nextIndex],
            progressPercent: (nextIndex + 1) * 100 / questions.length
        }, () => {
            this._answerLocked = false;
        });
    },

    onBackQuestion() {
        if (this.data.currentIndex <= 0 || this.data.mode !== 'quiz') return;

        const questions = this.data.questions && this.data.questions.length
            ? this.data.questions
            : getFanTestQuestions();
        const previousIndex = this.data.currentIndex - 1;

        this._answerLocked = false;
        this.setData({
            answers: this.data.answers.slice(0, previousIndex),
            currentIndex: previousIndex,
            currentQuestion: questions[previousIndex],
            progressPercent: (previousIndex + 1) * 100 / questions.length
        });
    },

    finishQuiz(answers) {
        const result = scoreFanTest(answers);
        this.setData({
            mode: 'result',
            answers: result.answers,
            result
        });
    },

    onRestart() {
        this.resetQuiz();
    },

    onShareAppMessage() {
        return {
            title: '满分激光枪读者群',
            path: '/pages/fan-test/index',
            imageUrl: FAN_TEST_ASSETS.banner
        };
    },

    onShareTimeline() {
        return {
            title: '满分激光枪读者群',
            query: '',
            imageUrl: FAN_TEST_ASSETS.banner
        };
    },

    preventMove() {
        return false;
    }
});
