const FAN_TEST_PASS_SCORE = 8;

const FAN_TEST_ASSETS = {
    banner: '/image-pack-fan/fan-banner-5e4dafba.png',
    background: '/image-pack-fan/fan-background-6ef9b53a.png',
    groupQr: '/image-pack-fan/gp-65bc4f2d.jpg',
    groupQrs: [
        '/image-pack-fan/gp-65bc4f2d.jpg',
        '/image-pack-fan/gp1-65bc4f2d.jpg',
        '/image-pack-fan/gp2-65bc4f2d.jpg'
    ]
};

const FAN_TEST_QUESTIONS = [
    {
        id: 1,
        text: 'sin²α+cos²α=？',
        answer: 'A',
        options: [
            { key: 'A', text: '1' },
            { key: 'B', text: '0' },
            { key: 'C', text: 'π' }
        ]
    },
    {
        id: 2,
        text: '“无可奈何花落去”，下一句是什么？',
        answer: 'A',
        options: [
            { key: 'A', text: '似曾相识燕归来' },
            { key: 'B', text: '自缘身在最高层' },
            { key: 'C', text: '烟波江上使人愁' }
        ]
    },
    {
        id: 3,
        text: '下面哪个品牌不是设计师品牌？',
        answer: 'C',
        options: [
            { key: 'A', text: 'Rick Owens' },
            { key: 'B', text: 'Yohji Yamamoto' },
            { key: 'C', text: 'Louis Vuitton' }
        ]
    },
    {
        id: 4,
        text: '下面哪位哲学家最富有？',
        answer: 'A',
        options: [
            { key: 'A', text: '叔本华' },
            { key: 'B', text: '尼采' },
            { key: 'C', text: '康德' }
        ]
    },
    {
        id: 5,
        text: '下面哪位是 OpenAI 的创始人？',
        answer: 'A',
        options: [
            { key: 'A', text: 'Sam Altman' },
            { key: 'B', text: 'Zuckerberg' },
            { key: 'C', text: 'Jeff Bezos' }
        ]
    },
    {
        id: 6,
        text: 'Omakase 的意思是什么？',
        answer: 'B',
        options: [
            { key: 'A', text: '以日式风格呈现的中式或西式高档料理' },
            { key: 'B', text: '当天菜品由主厨决定' },
            { key: 'C', text: '套餐制的日式高档料理' }
        ]
    },
    {
        id: 7,
        text: '下面哪个不是世界著名音乐节 IP？',
        answer: 'C',
        options: [
            { key: 'A', text: 'Tomorrowland' },
            { key: 'B', text: 'Coachella' },
            { key: 'C', text: 'Art Basel' }
        ]
    },
    {
        id: 8,
        text: '中国在以下哪个产业拥有较大的国际话语权？',
        answer: 'B',
        options: [
            { key: 'A', text: '芯片' },
            { key: 'B', text: '稀土' },
            { key: 'C', text: '当代艺术' }
        ]
    },
    {
        id: 9,
        text: '下面哪项表述与满分激光枪无关？',
        answer: 'C',
        options: [
            { key: 'A', text: '满分激光枪创作者毕业于上海财经大学' },
            { key: 'B', text: '满分激光枪围绕青年文化创作' },
            { key: 'C', text: '满分激光枪是一个可爱的女生' }
        ]
    }
];

function getFanTestQuestions() {
    return FAN_TEST_QUESTIONS.map(question => ({
        id: question.id,
        text: question.text,
        answer: question.answer,
        options: question.options.map(option => ({ ...option }))
    }));
}

function scoreFanTest(answerKeys) {
    const safeAnswers = Array.isArray(answerKeys) ? answerKeys : [];
    let correctCount = 0;

    const details = FAN_TEST_QUESTIONS.map((question, index) => {
        const selected = safeAnswers[index] || '';
        const correct = selected === question.answer;
        if (correct) correctCount += 1;

        return {
            id: question.id,
            selected,
            answer: question.answer,
            correct
        };
    });

    return {
        correctCount,
        total: FAN_TEST_QUESTIONS.length,
        passed: correctCount >= FAN_TEST_PASS_SCORE,
        answers: safeAnswers.slice(0, FAN_TEST_QUESTIONS.length),
        details
    };
}

module.exports = {
    FAN_TEST_ASSETS,
    FAN_TEST_PASS_SCORE,
    FAN_TEST_QUESTIONS,
    getFanTestQuestions,
    scoreFanTest
};
