// Mock vocabulary data and judgment logic
// Mock词汇数据：硬编码常见词、难词和翻译

(function() {
  'use strict';

  // 前500个最常见的英文单词（不显示翻译）
  const COMMON_WORDS = new Set([
    'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
    'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
    'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
    'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what',
    'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me',
    'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know', 'take',
    'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other',
    'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also',
    'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way',
    'even', 'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most', 'us',
    'is', 'was', 'are', 'been', 'has', 'had', 'were', 'said', 'did', 'having',
    'may', 'should', 'am', 'being', 'does', 'did', 'doing', 'done', 'went', 'gone',
    'got', 'getting', 'made', 'making', 'came', 'coming', 'took', 'taken', 'taking',
    'saw', 'seen', 'seeing', 'knew', 'known', 'knowing', 'gave', 'given', 'giving',
    'find', 'found', 'finding', 'tell', 'told', 'telling', 'ask', 'asked', 'asking',
    'work', 'worked', 'working', 'seem', 'seemed', 'seeming', 'feel', 'felt', 'feeling',
    'try', 'tried', 'trying', 'leave', 'left', 'leaving', 'call', 'called', 'calling',
    'good', 'new', 'first', 'last', 'long', 'great', 'little', 'own', 'other', 'old',
    'right', 'big', 'high', 'different', 'small', 'large', 'next', 'early', 'young', 'important',
    'few', 'public', 'bad', 'same', 'able', 'man', 'woman', 'child', 'world', 'school',
    'state', 'family', 'student', 'group', 'country', 'problem', 'hand', 'part', 'place', 'case',
    'week', 'company', 'system', 'program', 'question', 'work', 'government', 'number', 'night', 'point',
    'home', 'water', 'room', 'mother', 'area', 'money', 'story', 'fact', 'month', 'lot',
    'right', 'study', 'book', 'eye', 'job', 'word', 'business', 'issue', 'side', 'kind',
    'head', 'house', 'service', 'friend', 'father', 'power', 'hour', 'game', 'line', 'end',
    'member', 'law', 'car', 'city', 'community', 'name', 'president', 'team', 'minute', 'idea',
    'kid', 'body', 'information', 'back', 'parent', 'face', 'others', 'level', 'office', 'door',
    'health', 'person', 'art', 'war', 'history', 'party', 'result', 'change', 'morning', 'reason',
    'research', 'girl', 'guy', 'moment', 'air', 'teacher', 'force', 'education', 'foot', 'boy',
    'age', 'policy', 'process', 'music', 'market', 'sense', 'nation', 'plan', 'college', 'interest',
    'death', 'experience', 'effect', 'use', 'class', 'control', 'care', 'field', 'development', 'role',
    'student', 'view', 'society', 'program', 'order', 'rate', 'early', 'number', 'staff', 'evidence',
    'less', 'various', 'much', 'many', 'several', 'such', 'every', 'each', 'both', 'either',
    'neither', 'another', 'though', 'although', 'whether', 'while', 'until', 'unless', 'before', 'after',
    'during', 'through', 'between', 'among', 'under', 'above', 'below', 'across', 'around', 'along',
    'toward', 'towards', 'within', 'without', 'inside', 'outside', 'behind', 'beside', 'besides', 'beyond',
    'however', 'therefore', 'moreover', 'furthermore', 'nevertheless', 'otherwise', 'meanwhile', 'instead', 'thus', 'hence',
    'actually', 'really', 'very', 'quite', 'too', 'enough', 'almost', 'nearly', 'hardly', 'barely',
    'pretty', 'rather', 'fairly', 'somewhat', 'slightly', 'extremely', 'totally', 'completely', 'absolutely', 'entirely',
    'generally', 'usually', 'normally', 'typically', 'commonly', 'often', 'frequently', 'regularly', 'occasionally', 'sometimes',
    'rarely', 'seldom', 'never', 'always', 'ever', 'yet', 'still', 'already', 'soon', 'immediately',
    'quickly', 'slowly', 'suddenly', 'gradually', 'finally', 'eventually', 'recently', 'lately', 'currently', 'presently'
  ]);

  // Mock难词词典（需要显示翻译）
  const DIFFICULT_WORDS = {
    // 中等难度词汇
    'implement': { translation: '实施；执行；实现', phonetic: '/ˈɪmplɪment/' },
    'comprehensive': { translation: '全面的；综合的', phonetic: '/ˌkɒmprɪˈhensɪv/' },
    'significant': { translation: '重大的；显著的', phonetic: '/sɪɡˈnɪfɪkənt/' },
    'facilitate': { translation: '促进；使便利', phonetic: '/fəˈsɪlɪteɪt/' },
    'substantial': { translation: '大量的；实质的', phonetic: '/səbˈstænʃl/' },
    'sophisticated': { translation: '复杂的；精密的', phonetic: '/səˈfɪstɪkeɪtɪd/' },
    'enhance': { translation: '提高；增强', phonetic: '/ɪnˈhɑːns/' },
    'integrate': { translation: '整合；使成整体', phonetic: '/ˈɪntɪɡreɪt/' },
    'fundamental': { translation: '基本的；根本的', phonetic: '/ˌfʌndəˈmentl/' },
    'demonstrate': { translation: '证明；演示', phonetic: '/ˈdemənstreɪt/' },
    'establish': { translation: '建立；确立', phonetic: '/ɪˈstæblɪʃ/' },
    'appropriate': { translation: '适当的；恰当的', phonetic: '/əˈprəʊpriət/' },
    'particular': { translation: '特定的；特别的', phonetic: '/pəˈtɪkjələr/' },
    'maintain': { translation: '维持；保持', phonetic: '/meɪnˈteɪn/' },
    'acquire': { translation: '获得；取得', phonetic: '/əˈkwaɪər/' },
    'contribute': { translation: '贡献；促成', phonetic: '/kənˈtrɪbjuːt/' },
    'determine': { translation: '决定；确定', phonetic: '/dɪˈtɜːmɪn/' },
    'constitute': { translation: '构成；组成', phonetic: '/ˈkɒnstɪtjuːt/' },
    'generate': { translation: '产生；生成', phonetic: '/ˈdʒenəreɪt/' },
    'evaluate': { translation: '评估；评价', phonetic: '/ɪˈvæljueɪt/' },
    
    // 高难度词汇
    'ubiquitous': { translation: '无处不在的；普遍存在的', phonetic: '/juːˈbɪkwɪtəs/' },
    'ephemeral': { translation: '短暂的；瞬息的', phonetic: '/ɪˈfemərəl/' },
    'meticulous': { translation: '一丝不苟的；细致的', phonetic: '/məˈtɪkjələs/' },
    'paradigm': { translation: '范例；典范', phonetic: '/ˈpærədaɪm/' },
    'pragmatic': { translation: '实用的；务实的', phonetic: '/præɡˈmætɪk/' },
    'ambiguous': { translation: '模糊的；含糊的', phonetic: '/æmˈbɪɡjuəs/' },
    'arbitrary': { translation: '任意的；武断的', phonetic: '/ˈɑːbɪtrəri/' },
    'cognitive': { translation: '认知的', phonetic: '/ˈkɒɡnətɪv/' },
    'coherent': { translation: '连贯的；一致的', phonetic: '/kəʊˈhɪərənt/' },
    'empirical': { translation: '实证的；经验主义的', phonetic: '/ɪmˈpɪrɪkl/' },
    'intrinsic': { translation: '内在的；固有的', phonetic: '/ɪnˈtrɪnsɪk/' },
    'manifest': { translation: '显现；表明', phonetic: '/ˈmænɪfest/' },
    'obsolete': { translation: '过时的；废弃的', phonetic: '/ˈɒbsəliːt/' },
    'perpetual': { translation: '永久的；持续的', phonetic: '/pəˈpetʃuəl/' },
    'profound': { translation: '深刻的；深远的', phonetic: '/prəˈfaʊnd/' },
    'resilient': { translation: '有弹性的；能恢复的', phonetic: '/rɪˈzɪliənt/' },
    'trivial': { translation: '琐碎的；不重要的', phonetic: '/ˈtrɪviəl/' },
    'viable': { translation: '可行的；能存活的', phonetic: '/ˈvaɪəbl/' },
    'anomaly': { translation: '异常；反常现象', phonetic: '/əˈnɒməli/' },
    'exacerbate': { translation: '使恶化；加剧', phonetic: '/ɪɡˈzæsəbeɪt/' },
    'mitigate': { translation: '减轻；缓和', phonetic: '/ˈmɪtɪɡeɪt/' },
    'nuance': { translation: '细微差别', phonetic: '/ˈnjuːɑːns/' },
    'scrutiny': { translation: '详细审查；监视', phonetic: '/ˈskruːtəni/' },
    'tangible': { translation: '有形的；实际的', phonetic: '/ˈtændʒəbl/' },
    'augment': { translation: '增加；扩大', phonetic: '/ɔːɡˈment/' },
    'catalyst': { translation: '催化剂；促进因素', phonetic: '/ˈkætəlɪst/' },
    'divergent': { translation: '分歧的；不同的', phonetic: '/daɪˈvɜːdʒənt/' },
    'eloquent': { translation: '雄辩的；有说服力的', phonetic: '/ˈeləkwənt/' },
    'exemplify': { translation: '例证；是...的典范', phonetic: '/ɪɡˈzemplɪfaɪ/' },
    'inherent': { translation: '固有的；内在的', phonetic: '/ɪnˈhɪərənt/' },
    'legitimate': { translation: '合法的；正当的', phonetic: '/lɪˈdʒɪtɪmət/' },
    'pertinent': { translation: '相关的；切题的', phonetic: '/ˈpɜːtɪnənt/' },
    'quintessential': { translation: '典型的；精髓的', phonetic: '/ˌkwɪntɪˈsenʃl/' },
    'superficial': { translation: '表面的；肤浅的', phonetic: '/ˌsuːpəˈfɪʃl/' },
    'unprecedented': { translation: '前所未有的', phonetic: '/ʌnˈpresɪdentɪd/' },
    'versatile': { translation: '多才多艺的；通用的', phonetic: '/ˈvɜːsətaɪl/' }
  };

  // Mock词汇判断器
  class MockVocabulary {
    constructor() {
      this.knownWords = new Set();
      this.loadKnownWords();
    }

    // 从本地存储加载已掌握的词汇
    loadKnownWords() {
      chrome.storage.local.get(['knownWords'], (result) => {
        if (result.knownWords) {
          this.knownWords = new Set(result.knownWords);
        }
      });
    }

    // 判断一个单词是否需要显示翻译
    needsTranslation(word) {
      const lowerWord = word.toLowerCase();
      
      // 1. 用户已标记为"认识"的词
      if (this.knownWords.has(lowerWord)) {
        return false;
      }
      
      // 2. 常见词不显示
      if (COMMON_WORDS.has(lowerWord)) {
        return false;
      }
      
      // 3. 难词词典中的词需要显示
      if (DIFFICULT_WORDS[lowerWord]) {
        return true;
      }
      
      // 4. 其他词默认不显示（假设用户认识）
      return false;
    }

    // 获取单词的翻译信息
    getTranslation(word) {
      const lowerWord = word.toLowerCase();
      return DIFFICULT_WORDS[lowerWord] || null;
    }

    // 标记单词为"已知"
    markAsKnown(word) {
      const lowerWord = word.toLowerCase();
      this.knownWords.add(lowerWord);
      
      // 保存到本地存储
      chrome.storage.local.set({
        knownWords: Array.from(this.knownWords)
      });
    }

    // 标记单词为"未知"（用户主动请求翻译）
    markAsUnknown(word) {
      const lowerWord = word.toLowerCase();
      this.knownWords.delete(lowerWord);
      
      // 保存到本地存储
      chrome.storage.local.set({
        knownWords: Array.from(this.knownWords)
      });
    }

    // 获取所有已掌握的词汇
    getKnownWords() {
      return Array.from(this.knownWords);
    }
  }

  // 导出到全局
  window.MockVocabulary = MockVocabulary;
  window.mockVocabulary = new MockVocabulary();
})();

