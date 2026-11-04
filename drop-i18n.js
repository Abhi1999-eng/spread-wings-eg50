// Copy for the story page in each language. English is the client's original text;
// Chinese and Japanese are translations of it and should be checked by a native speaker.
//
// Headlines are lists of word chunks that animate in one by one; '|' is a line break.
// Each part entry is [name, description, [[label, value] x3]].

export const LANGS = {
  en: { html: 'en', label: 'EN' },
  zh: { html: 'zh-Hans', label: '中文' },
  ja: { html: 'ja', label: '日本語' },
};

export const L10N = {
  en: {
    title: 'Spreadwings | From Vision to Impact',
    op: 'FROM VISION TO IMPACT',
    eyebrow: 'Spreadwings · Engineering the Future of Defence',
    hero: ['From', 'Vision', '|', 'to', 'Innovation.'],
    finale: ['From', 'Engineering', '|', 'to', 'Impact.'],
    tagline: 'Engineering Beyond Boundaries.',
    ctaCapabilities: 'Discover Our Capabilities',
    ctaTeam: 'Connect With Our Team',
    replay: '↺ Replay the story',
    disclaimer: 'Cinematic concept visualisation. The payload shown is illustrative. Aerial footage: Pexels.',
    cue: 'Scroll to begin',
    partsHint: 'Hover any part · or pick one',
    ch: [
      { name: 'The Vision', mega: 'Vision', title: 'Every great advancement begins with a question.', body: [
        'What if technology could help nations see further, respond smarter and prepare for the challenges of tomorrow?',
        'The vision was simple: to push the boundaries of aerospace engineering and develop advanced technologies that address the evolving needs of modern defence.',
        'We believed that the future would belong to those who dared to innovate.',
        'And that belief became the beginning of our journey.'] },
      { name: 'The Foundation', mega: 'Foundation', title: 'From an idea to an engineering vision.', body: [
        'What began as an ambition gradually took shape through research, engineering and a commitment to technological excellence.',
        'Our focus was to bring together innovation, precision and purposeful engineering under one vision.',
        'Every concept represented a possibility. Every prototype represented progress. Every challenge became an opportunity to rethink what was possible.',
        'We were not just building technology. We were building the foundation for what comes next.'] },
      { name: 'The Evolution', mega: 'Evolution', title: 'Progress is not a destination. It is a continuous pursuit.', body: [
        'As technology evolved, so did our ambitions.',
        'Our journey expanded across multiple domains of aerospace and defence technology, exploring new possibilities in unmanned systems, advanced aerial platforms and defence solutions.',
        'Through a culture of research, engineering and continuous improvement, our vision grew into a broader technological ecosystem.',
        'One idea became many possibilities. One direction became a journey of innovation.'] },
      { name: 'The Capabilities', mega: 'Capabilities', title: 'Designed with purpose. Engineered for demanding environments.', body: [
        'Today, our vision extends across a diverse portfolio of advanced aerospace and defence technologies.',
        'Every product represents a commitment to engineering excellence, reliability and mission-oriented innovation.'],
        list: ['Unmanned Aerial Systems', 'Advanced Drone Platforms', 'Missile Systems', 'Aerospace Engineering', 'Integrated Defence Technologies'],
        cta: 'Explore Our Products' },
      { name: 'The Purpose', mega: 'Purpose', title: 'Technology has a greater purpose.', body: [
        'In an increasingly complex world, technological advancement plays a critical role in strengthening national capabilities.',
        'We believe that meaningful innovation comes from understanding real-world requirements, engineering with precision and building solutions with long-term purpose.',
        'Our focus goes beyond developing individual products. It is about contributing to a stronger, more technologically capable future.'] },
      { name: 'The Future', mega: 'Future', title: 'We are only getting started.', body: [
        'The future of aerospace and defence will be shaped by those who continue to question limitations and explore new possibilities.',
        'At Spreadwings, we see every challenge as an opportunity to advance.',
        'Our journey continues with a commitment to innovation, engineering excellence and technologies that shape tomorrow.'] },
    ],
    parts: {
      nose: ['Nose fairing', 'Ceramic-composite nose cone. It meets the air first, takes the heat, and keeps the forward sensor window clean all the way down.', [['Material', 'Ceramic'], ['Mass', '6.2 kg'], ['Skin temp', '410 °C']]],
      sensor: ['Ground-sense ring', 'Six small radar heads in a ring. They read height above ground and stream it up to the EG-50 for the record.', [['Heads', '6'], ['Update', '200 Hz'], ['Range', '3 km']]],
      telemetry: ['Telemetry bay', 'The payload’s voice. Spin, attitude, temperature and position, sent to the EG-50 forty times a second.', [['Link', 'Encrypted'], ['Rate', '40 Hz'], ['Channels', '12']]],
      power: ['Power cell stack', 'Seven cells that keep every sensor alive for the fall, and not a second longer.', [['Cells', '7'], ['Runtime', '240 s'], ['Bus', '28 V']]],
      core: ['Sealed core', 'Sealed vessel at the heart of the payload. The scan shows its outline and nothing else. Even this page does not know what is inside.', [['Access', 'None'], ['Clearance', 'L-5'], ['Contents', '████']]],
      cradle: ['Shock cradle', 'Three titanium rails and two rings that hold every module in line through release, spin and buffeting.', [['Rails', '3'], ['Material', 'Ti-6Al'], ['Rated', '40 g']]],
      shell: ['Outer casing', 'Two-piece steel-composite casing. In the scan it opens like a book. In reality it never opens at all.', [['Pieces', '2'], ['Length', '3.2 m'], ['Finish', 'Matte']]],
      tail: ['Tail fin assembly', 'Four fins and a box ring. They keep the payload nose-down and give it a slow, steady spin.', [['Fins', '4'], ['Spin', '1.5 rev/s'], ['Ring', 'Ø 1.2 m']]],
      lug: ['Release lug', 'The single hook that holds the payload to the EG-50’s pylon. Opened at T+00:00 and never used again.', [['Rated', '50 kg'], ['Opened', 'T+00:00'], ['Reuse', 'None']]],
    },
  },

  zh: {
    title: 'Spreadwings | 从愿景到影响力',
    op: '从愿景到影响力',
    eyebrow: 'Spreadwings · 以工程塑造国防的未来',
    hero: ['从愿景', '|', '到创新。'],
    finale: ['从工程', '|', '到影响力。'],
    tagline: '工程，超越边界。',
    ctaCapabilities: '探索我们的能力',
    ctaTeam: '联系我们的团队',
    replay: '↺ 重新播放',
    disclaimer: '概念影像演示。所示载荷仅为示意。航拍素材：Pexels。',
    cue: '向下滚动开始',
    partsHint: '悬停任意部件 · 或直接选择',
    ch: [
      { name: '愿景', mega: '愿景', title: '每一次伟大的进步，都始于一个问题。', body: [
        '如果科技能够帮助国家看得更远、反应更敏捷，并为明天的挑战做好准备，会怎样？',
        '我们的愿景很简单：突破航空航天工程的边界，开发先进技术，满足现代国防不断变化的需求。',
        '我们相信，未来属于敢于创新的人。',
        '而这份信念，开启了我们的旅程。'] },
      { name: '根基', mega: '根基', title: '从一个想法，到一个工程愿景。', body: [
        '最初的抱负，在研究、工程和对技术卓越的执着追求中逐渐成形。',
        '我们的重点，是将创新、精准与有目标的工程汇聚于同一个愿景之下。',
        '每一个概念都代表一种可能。每一个原型都代表一次进步。每一次挑战，都是重新思考可能性的机会。',
        '我们不只是在打造技术，更是在为未来奠定基础。'] },
      { name: '演进', mega: '演进', title: '进步不是终点，而是一场持续的追求。', body: [
        '随着技术的发展，我们的抱负也在不断扩展。',
        '我们的旅程延伸至航空航天与国防技术的多个领域，在无人系统、先进空中平台和国防解决方案中探索新的可能。',
        '依托研究、工程与持续改进的文化，我们的愿景发展成为一个更广阔的技术生态系统。',
        '一个想法，化作无数可能。一个方向，化作一段创新之旅。'] },
      { name: '能力', mega: '能力', title: '为目标而设计，为严苛环境而打造。', body: [
        '如今，我们的愿景涵盖多元化的先进航空航天与国防技术组合。',
        '每一款产品，都体现了我们对卓越工程、可靠性以及以任务为导向的创新的承诺。'],
        list: ['无人航空系统', '先进无人机平台', '导弹系统', '航空航天工程', '综合国防技术'],
        cta: '探索我们的产品' },
      { name: '使命', mega: '使命', title: '科技承载着更远大的使命。', body: [
        '在日益复杂的世界中，技术进步在增强国家能力方面发挥着关键作用。',
        '我们相信，有意义的创新源于对现实需求的深刻理解、精准的工程，以及着眼长远的解决方案。',
        '我们关注的不只是开发单个产品，更是为一个更强大、技术能力更强的未来贡献力量。'] },
      { name: '未来', mega: '未来', title: '我们才刚刚起步。', body: [
        '航空航天与国防的未来，将由那些不断挑战极限、探索新可能的人来塑造。',
        '在 Spreadwings，我们将每一次挑战都视为前进的机会。',
        '我们的旅程仍在继续，始终致力于创新、卓越工程，以及塑造明天的技术。'] },
    ],
    parts: {
      nose: ['头锥整流罩', '陶瓷复合材料头锥。它最先迎风、承受高温，并在整个下落过程中保持前视传感器窗口清洁。', [['材料', '陶瓷'], ['质量', '6.2 kg'], ['表面温度', '410 °C']]],
      sensor: ['近地感应环', '六个小型雷达探头围成一圈，测量离地高度，并实时传回 EG-50 记录。', [['探头', '6'], ['刷新率', '200 Hz'], ['量程', '3 km']]],
      telemetry: ['遥测舱', '载荷的“声音”。自旋、姿态、温度和位置，每秒 40 次发送给 EG-50。', [['链路', '加密'], ['速率', '40 Hz'], ['通道', '12']]],
      power: ['电池组', '七个电池单元，在整个下落过程中为所有传感器供电，一秒不多。', [['单元', '7'], ['续航', '240 s'], ['总线', '28 V']]],
      core: ['密封核心', '位于载荷中心的密封容器。扫描只能显示它的轮廓，别无其他。就连这个页面也不知道里面是什么。', [['权限', '无'], ['密级', 'L-5'], ['内容', '████']]],
      cradle: ['减震支架', '三根钛合金导轨和两个环，在释放、自旋和颠簸中让所有模块保持对齐。', [['导轨', '3'], ['材料', 'Ti-6Al'], ['额定', '40 g']]],
      shell: ['外壳', '两件式钢复合外壳。在扫描中它像书一样打开；现实中它从不打开。', [['部件', '2'], ['长度', '3.2 m'], ['表面', '哑光']]],
      tail: ['尾翼组件', '四片尾翼加一个箱形环，让载荷保持头部朝下，并缓慢、稳定地自旋。', [['尾翼', '4'], ['转速', '1.5 rev/s'], ['环径', 'Ø 1.2 m']]],
      lug: ['释放挂钩', '将载荷固定在 EG-50 挂架上的唯一挂钩。在 T+00:00 打开，此后不再使用。', [['额定', '50 kg'], ['打开', 'T+00:00'], ['复用', '无']]],
    },
  },

  ja: {
    title: 'Spreadwings | ビジョンからインパクトへ',
    op: 'ビジョンからインパクトへ',
    eyebrow: 'Spreadwings · 防衛の未来をエンジニアリングする',
    hero: ['ビジョンから、', '|', 'イノベーションへ。'],
    finale: ['エンジニアリングから、', '|', 'インパクトへ。'],
    tagline: '境界を越えるエンジニアリング。',
    ctaCapabilities: 'ケイパビリティを見る',
    ctaTeam: 'チームに相談する',
    replay: '↺ もう一度見る',
    disclaimer: 'コンセプト映像です。表示されているペイロードはイメージです。空撮映像：Pexels。',
    cue: 'スクロールして開始',
    partsHint: 'パーツにホバー · または選択',
    ch: [
      { name: 'ビジョン', mega: 'ビジョン', title: 'すべての偉大な進歩は、ひとつの問いから始まる。', body: [
        'もしテクノロジーが、国がより遠くを見渡し、より賢く対応し、明日の課題に備える力になれるとしたら？',
        'ビジョンはシンプルでした。航空宇宙工学の限界を押し広げ、変化し続ける現代の防衛ニーズに応える先進技術を開発すること。',
        '未来は、革新に挑む者のものだと私たちは信じていました。',
        'そしてその信念が、私たちの旅の始まりとなりました。'] },
      { name: '基盤', mega: '基盤', title: 'ひとつのアイデアから、エンジニアリングのビジョンへ。', body: [
        '志として始まったものは、研究とエンジニアリング、そして技術的卓越性への献身を通じて、少しずつ形になっていきました。',
        '私たちが目指したのは、革新と精密さ、そして目的あるエンジニアリングを、ひとつのビジョンのもとに結集することでした。',
        'すべてのコンセプトは可能性を、すべてのプロトタイプは前進を意味していました。すべての課題は、可能性を考え直す機会となりました。',
        '私たちが築いていたのは、技術だけではありません。次に来るものの基盤でした。'] },
      { name: '進化', mega: '進化', title: '進歩とは到達点ではなく、絶え間ない追求である。', body: [
        'テクノロジーが進化するにつれ、私たちの志も広がっていきました。',
        '私たちの歩みは航空宇宙・防衛技術の多様な領域へと広がり、無人システム、先進航空プラットフォーム、防衛ソリューションにおける新たな可能性を探ってきました。',
        '研究、エンジニアリング、そして継続的改善の文化を通じて、私たちのビジョンはより大きな技術エコシステムへと成長しました。',
        'ひとつのアイデアが、数多くの可能性に。ひとつの方向性が、革新の旅に。'] },
      { name: 'ケイパビリティ', mega: '能力', title: '目的のために設計され、過酷な環境のために作られた。', body: [
        '今日、私たちのビジョンは、先進的な航空宇宙・防衛技術の多様なポートフォリオへと広がっています。',
        'すべての製品は、エンジニアリングの卓越性、信頼性、そしてミッション志向の革新への約束を体現しています。'],
        list: ['無人航空システム', '先進ドローンプラットフォーム', 'ミサイルシステム', '航空宇宙エンジニアリング', '統合防衛技術'],
        cta: '製品を見る' },
      { name: 'パーパス', mega: '使命', title: 'テクノロジーには、より大きな目的がある。', body: [
        'ますます複雑化する世界において、技術の進歩は国家の能力を強化するうえで重要な役割を果たしています。',
        '意味のある革新は、現実の要件を理解し、精密にエンジニアリングし、長期的な目的をもってソリューションを築くことから生まれると私たちは信じています。',
        '私たちが目指すのは、個々の製品開発にとどまりません。より強く、より技術力のある未来に貢献することです。'] },
      { name: '未来', mega: '未来', title: '私たちの挑戦は、まだ始まったばかり。', body: [
        '航空宇宙と防衛の未来は、限界に問いを投げかけ、新たな可能性を探り続ける者によって形づくられます。',
        'Spreadwingsは、あらゆる課題を前進の機会と捉えています。',
        '革新、エンジニアリングの卓越性、そして明日を形づくる技術への取り組みとともに、私たちの旅は続きます。'] },
    ],
    parts: {
      nose: ['ノーズフェアリング', 'セラミック複合材のノーズコーン。最初に空気を受けて熱に耐え、落下中ずっと前方センサー窓をクリアに保ちます。', [['材料', 'セラミック'], ['質量', '6.2 kg'], ['表面温度', '410 °C']]],
      sensor: ['地上検知リング', 'リング状に並ぶ6基の小型レーダー。対地高度を計測し、記録用にEG-50へ送信します。', [['ヘッド', '6'], ['更新', '200 Hz'], ['範囲', '3 km']]],
      telemetry: ['テレメトリーベイ', 'ペイロードの「声」。回転、姿勢、温度、位置を毎秒40回EG-50へ送信します。', [['リンク', '暗号化'], ['レート', '40 Hz'], ['チャンネル', '12']]],
      power: ['パワーセルスタック', '落下の間、すべてのセンサーを動かし続ける7つのセル。それ以上は持ちません。', [['セル', '7'], ['稼働', '240 s'], ['バス', '28 V']]],
      core: ['密閉コア', 'ペイロード中心の密閉容器。スキャンで見えるのは輪郭だけ。このページですら中身を知りません。', [['アクセス', 'なし'], ['機密', 'L-5'], ['内容', '████']]],
      cradle: ['ショッククレードル', '3本のチタンレールと2つのリングが、分離・回転・揺れの中でも全モジュールを一直線に保ちます。', [['レール', '3'], ['材料', 'Ti-6Al'], ['定格', '40 g']]],
      shell: ['外殻', '2ピースの鋼複合ケーシング。スキャンでは本のように開きますが、実際に開くことはありません。', [['パーツ', '2'], ['全長', '3.2 m'], ['仕上げ', 'マット']]],
      tail: ['テールフィン', '4枚のフィンとボックスリングが機首を下に保ち、ゆっくり安定した回転を与えます。', [['フィン', '4'], ['回転', '1.5 rev/s'], ['リング', 'Ø 1.2 m']]],
      lug: ['リリースラグ', 'ペイロードをEG-50のパイロンに固定する唯一のフック。T+00:00に開放され、二度と使われません。', [['定格', '50 kg'], ['開放', 'T+00:00'], ['再使用', 'なし']]],
    },
  },
};
