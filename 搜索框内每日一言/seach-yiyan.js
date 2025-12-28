// 每日一言功能（包含CSS样式）
(function() {
  // 添加CSS样式
  const style = document.createElement('style');
  style.textContent = `
    /*==搜索==*/
    .search-container {
        border-radius: 16px !important;
        background: rgba(255, 255, 255, 0.50) !important;
        backdrop-filter: blur(12px) !important;
        border: none !important;
    }
    .search-container > input {
        font-size: 14px !important;
        font-weight: 400 !important;
        height: 48px !important;
        transform: skewX(-20deg);
    }

.search-container > input:focus,.search-container > input:active {
    transform: skewX(0);
}
    .search-container > input::placeholder {
        color: rgba(0, 0, 0, 0.40) !important;
        font-size: 14px !important;
        font-weight: 400 !important;
    }
    .fixed-element {
        background-color: transparent !important;
        box-shadow: none !important;
        backdrop-filter: 0 !important;
    }
    @media (min-width: 1024px) {
        .lg\\:w-\\[80\\%\\] {
            width: 54% !important;
        }
    }

  `;
  document.head.appendChild(style);

  // 每日一言管理器
  class DailyQuoteManager {
    constructor() {
      this.input = null;
      this.quote = '';
      this.author = '';
      this.onFocusBound = null;
      this.onBlurBound = null;
    }
    
    async init() {
      await this.waitForInput();
      await this.loadQuote();
      this.setupEventListeners();
      this.applyQuoteStyle();
    }
    
    // 等待input元素出现
    waitForInput() {
      return new Promise((resolve) => {
        const checkInput = () => {
          this.input = document.querySelector('.search-container input');
          if (this.input) {
            resolve();
          } else {
            setTimeout(checkInput, 100);
          }
        };
        checkInput();
      });
    }
    
    // 加载每日一言
    async loadQuote() {
      try {
        // 显示加载中
        if (this.input) {
          this.input.placeholder = '加载每日一言中...';
        }
        
        // 从API获取
        const response = await fetch('https://v1.hitokoto.cn?c=a');
        const data = await response.json();
        this.quote = data.hitokoto;
        this.author = data.from || '';
        
      } catch (error) {
        console.warn('获取每日一言失败，使用备用语录:', error);
        // 使用备用语录
        const fallback = this.getFallbackQuote();
        this.quote = fallback.quote;
        this.author = fallback.author;
      }
      
      this.updatePlaceholder();
    }
    
    // 获取备用语录
    getFallbackQuote() {
      const quotes = [
        {quote: "代码是写给人看的，顺便给机器执行", author: "《代码整洁之道》"},
        {quote: "学无止境，每日精进", author: "古训"},
        {quote: "Stay hungry, stay foolish", author: "Steve Jobs"},
        {quote: "简单是可靠的先决条件", author: "Edsger W. Dijkstra"},
        {quote: "实践是检验真理的唯一标准", author: "邓小平"},
        {quote: "探索未知，创造可能", author: "佚名"},
        {quote: "技术为生活赋能", author: "佚名"},
        {quote: "每日进步一点点", author: "古训"},
        {quote: "书山有路勤为径，学海无涯苦作舟", author: "韩愈"},
        {quote: "生活不止眼前的苟且，还有诗和远方", author: "高晓松"}
      ];
      return quotes[Math.floor(Math.random() * quotes.length)];
    }
    
    // 更新placeholder
    updatePlaceholder() {
      if (this.input && this.quote) {
        // 构建完整的每日一言文本
        let fullQuote = `「${this.quote}」`;
        if (this.author && this.author.trim()) {
          fullQuote += ` —— ${this.author}`;
        }
        
        this.input.placeholder = fullQuote;
        this.input.dataset.dailyQuote = fullQuote;
        this.applyQuoteStyle();
      }
    }
    
    // 设置事件监听
    setupEventListeners() {
      if (!this.input) return;
      
      // 移除旧监听器
      if (this.onFocusBound && this.onBlurBound) {
        this.input.removeEventListener('focus', this.onFocusBound);
        this.input.removeEventListener('blur', this.onBlurBound);
      }
      
      // 绑定新监听器
      this.onFocusBound = this.onFocus.bind(this);
      this.onBlurBound = this.onBlur.bind(this);
      
      this.input.addEventListener('focus', this.onFocusBound);
      this.input.addEventListener('blur', this.onBlurBound);
    }
    
    // 焦点处理
    onFocus() {
      if (this.input && !this.input.value) {
        this.input.placeholder = '请输入搜索内容';
        this.removeQuoteStyle();
      }
    }
    
    // 失焦处理
    onBlur() {
      if (this.input && !this.input.value && this.quote) {
        // 重新构建完整的每日一言文本
        let fullQuote = `「${this.quote}」`;
        if (this.author && this.author.trim()) {
          fullQuote += ` —— ${this.author}`;
        }
        
        this.input.placeholder = fullQuote;
        this.applyQuoteStyle();
      }
    }
    
    // 应用每日一言样式
    applyQuoteStyle() {
      if (!this.input) return;
      
      // 添加特殊类名
      this.input.classList.add('daily-quote');
    }
    
    // 移除每日一言样式
    removeQuoteStyle() {
      if (!this.input) return;
      
      this.input.classList.remove('daily-quote');
    }
    
    // 应用基础样式
    applyStyles() {
      if (!this.input) return;
      
      // 初始应用每日一言样式
      this.applyQuoteStyle();
    }
  }
  
  // 初始化每日一言功能
  function initDailyQuote() {
    console.log('=== 每日一言功能初始化开始 ===');
    
    // 清除之前的实例（如果有）
    if (window.dailyQuoteInstance) {
      try {
        // 清理事件监听器
        if (window.dailyQuoteInstance.input && 
            window.dailyQuoteInstance.onFocusBound && 
            window.dailyQuoteInstance.onBlurBound) {
          window.dailyQuoteInstance.input.removeEventListener('focus', window.dailyQuoteInstance.onFocusBound);
          window.dailyQuoteInstance.input.removeEventListener('blur', window.dailyQuoteInstance.onBlurBound);
        }
      } catch (e) {
        console.warn('清理旧实例时出错:', e);
      }
      window.dailyQuoteInstance = null;
    }
    
    // 创建新实例
    window.dailyQuoteInstance = new DailyQuoteManager();
    
    // 初始化
    window.dailyQuoteInstance.init().then(() => {
      console.log('=== 每日一言功能初始化完成 ===');
    }).catch(error => {
      console.error('每日一言初始化失败:', error);
    });
  }
  
  // 页面加载后执行
  window.addEventListener('load', function() {
    // 延迟执行，确保DOM完全加载
    setTimeout(initDailyQuote, 300);
  });
  
  // 监听页面显示事件（兼容单页应用）
  document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
      // 页面从后台切回时，重新初始化每日一言
      setTimeout(initDailyQuote, 100);
    }
  });
  
  // 提供全局方法用于手动初始化
  window.initDailyQuote = initDailyQuote;
  
})();// JavaScript Document