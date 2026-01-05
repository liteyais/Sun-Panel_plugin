# Sun-Panel_plugin(js)
Sun-Panel相关js插件
<div style="height:200px;" >
```javascript
  /**
 * CardScriptLoader - 卡片脚本加载器（完整稳定版）
 * 功能特点：
 * 1. 避免重复加载和重复请求
 * 2. 完善的错误处理和超时控制
 * 3. 减少服务器负担，优化性能
 * 4. 详细的加载统计和日志
 * 5. 支持版本控制和缓存清理
 */

class CardScriptLoader {
  /**
   * 构造函数
   * @param {Object} options 配置选项
   */
  constructor(options = {}) {
    // 默认配置
    this.config = {
      timeout: 10000,           // 超时时间（毫秒）
      enableCache: true,        // 启用缓存
      logLevel: 'warn',         // 日志级别：'debug' | 'info' | 'warn' | 'error' | 'none'
      version: '',              // 版本号（用于缓存控制）
      crossorigin: 'anonymous', // crossorigin属性
      ...options
    };

    // 加载状态缓存
    this.loadedScripts = new Set();      // 已加载成功的脚本
    this.failedScripts = new Set();      // 已加载失败的脚本
    this.loadingPromises = new Map();    // 正在加载的Promise
    this.loadStats = {                    // 加载统计
      totalRequests: 0,
      cachedRequests: 0,
      successRequests: 0,
      failedRequests: 0,
      totalTime: 0
    };

    // 性能监控
    this.performanceEntries = [];
    
    // 事件监听器
    this.eventListeners = new Map();
    
    // 初始化
    this._init();
  }

  /**
   * 初始化
   * @private
   */
  _init() {
    this._log('debug', 'CardScriptLoader 初始化完成');
    this._setupPerformanceObserver();
  }

  /**
   * 设置性能观察者
   * @private
   */
  _setupPerformanceObserver() {
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          list.getEntries().forEach(entry => {
            if (entry.initiatorType === 'script') {
              this.performanceEntries.push(entry);
            }
          });
        });
        observer.observe({ entryTypes: ['resource'] });
      } catch (e) {
        this._log('warn', '性能监控初始化失败:', e);
      }
    }
  }

  /**
   * 日志记录
   * @private
   */
  _log(level, ...args) {
    const levels = ['debug', 'info', 'warn', 'error', 'none'];
    const configLevel = levels.indexOf(this.config.logLevel);
    const currentLevel = levels.indexOf(level);
    
    if (currentLevel >= configLevel) {
      const prefix = `[CardScriptLoader ${level.toUpperCase()}]`;
      const logMethod = console[level] || console.log;
      logMethod.call(console, prefix, ...args);
    }
  }

  /**
   * 触发事件
   * @private
   */
  _emit(eventName, data) {
    const listeners = this.eventListeners.get(eventName) || [];
    listeners.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        this._log('error', `事件监听器执行失败 (${eventName}):`, error);
      }
    });
  }

  /**
   * 添加事件监听器
   * @param {string} eventName 事件名称
   * @param {Function} callback 回调函数
   */
  on(eventName, callback) {
    if (!this.eventListeners.has(eventName)) {
      this.eventListeners.set(eventName, []);
    }
    this.eventListeners.get(eventName).push(callback);
  }

  /**
   * 移除事件监听器
   * @param {string} eventName 事件名称
   * @param {Function} callback 回调函数
   */
  off(eventName, callback) {
    const listeners = this.eventListeners.get(eventName);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * 生成带版本号的URL
   * @private
   */
  _getVersionedUrl(src) {
    if (!this.config.version) return src;
    
    const separator = src.includes('?') ? '&' : '?';
    return `${src}${separator}v=${this.config.version}`;
  }

  /**
   * 检查脚本是否已存在
   * @private
   */
  _isScriptInDOM(src) {
    const normalizedSrc = this._normalizeSrc(src);
    return Array.from(document.getElementsByTagName('script')).some(script => {
      return this._normalizeSrc(script.src) === normalizedSrc;
    });
  }

  /**
   * 标准化URL
   * @private
   */
  _normalizeSrc(src) {
    try {
      const url = new URL(src, window.location.origin);
      return url.href;
    } catch {
      // 如果URL解析失败，返回原字符串
      return src;
    }
  }

  /**
   * 加载单个脚本
   * @param {string} src 脚本地址
   * @param {Object} options 加载选项
   * @returns {Promise} 加载Promise
   */
  loadScript(src, options = {}) {
    const startTime = performance.now();
    this.loadStats.totalRequests++;
    
    const mergedOptions = { ...this.config, ...options };
    const versionedSrc = mergedOptions.version ? this._getVersionedUrl(src) : src;
    const normalizedSrc = this._normalizeSrc(versionedSrc);

    // 1. 检查是否已加载成功
    if (mergedOptions.enableCache && this.loadedScripts.has(normalizedSrc)) {
      this.loadStats.cachedRequests++;
      this._log('debug', `脚本已缓存，跳过加载: ${normalizedSrc}`);
      this._emit('cached', { src: normalizedSrc });
      return Promise.resolve();
    }

    // 2. 检查是否已加载失败
    if (this.failedScripts.has(normalizedSrc)) {
      this._log('warn', `脚本之前加载失败，跳过重试: ${normalizedSrc}`);
      return Promise.reject(new Error(`脚本之前加载失败: ${normalizedSrc}`));
    }

    // 3. 检查是否正在加载中
    if (this.loadingPromises.has(normalizedSrc)) {
      this._log('debug', `脚本正在加载中，返回现有Promise: ${normalizedSrc}`);
      return this.loadingPromises.get(normalizedSrc);
    }

    // 4. 检查是否已在DOM中但未记录
    if (this._isScriptInDOM(normalizedSrc)) {
      this._log('debug', `脚本已在DOM中，标记为已加载: ${normalizedSrc}`);
      this.loadedScripts.add(normalizedSrc);
      this._emit('loadedFromDOM', { src: normalizedSrc });
      return Promise.resolve();
    }

    // 5. 创建新的加载Promise
    const promise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = versionedSrc;
      
      // 设置属性
      script.async = true;
      script.defer = true;
      if (mergedOptions.crossorigin) {
        script.crossOrigin = mergedOptions.crossorigin;
      }
      
      // 添加data属性便于识别
      script.dataset.loader = 'card-script-loader';
      script.dataset.src = src;
      script.dataset.timestamp = Date.now();

      // 设置超时
      const timeoutId = setTimeout(() => {
        this._cleanupScript(script, normalizedSrc);
        const error = new Error(`脚本加载超时 (${mergedOptions.timeout}ms): ${normalizedSrc}`);
        error.code = 'TIMEOUT';
        error.src = normalizedSrc;
        reject(error);
        
        this._log('error', `加载超时: ${normalizedSrc}`);
        this._emit('timeout', { 
          src: normalizedSrc, 
          timeout: mergedOptions.timeout,
          error 
        });
      }, mergedOptions.timeout);

      // 加载成功
      script.onload = () => {
        clearTimeout(timeoutId);
        
        const loadTime = performance.now() - startTime;
        this.loadStats.successRequests++;
        this.loadStats.totalTime += loadTime;
        
        this.loadedScripts.add(normalizedSrc);
        this.loadingPromises.delete(normalizedSrc);
        
        this._log('info', `脚本加载成功: ${normalizedSrc} (${loadTime.toFixed(2)}ms)`);
        this._emit('loaded', { 
          src: normalizedSrc, 
          loadTime,
          script 
        });
        
        resolve();
      };

      // 加载失败
      script.onerror = (event) => {
        clearTimeout(timeoutId);
        this._cleanupScript(script, normalizedSrc);
        
        this.loadStats.failedRequests++;
        this.failedScripts.add(normalizedSrc);
        this.loadingPromises.delete(normalizedSrc);
        
        const error = new Error(`脚本加载失败: ${normalizedSrc}`);
        error.code = 'LOAD_ERROR';
        error.src = normalizedSrc;
        error.event = event;
        
        this._log('error', `脚本加载失败: ${normalizedSrc}`, error);
        this._emit('error', { 
          src: normalizedSrc, 
          error,
          script 
        });
        
        reject(error);
      };

      // 添加到DOM
      const insertPosition = mergedOptions.insertPosition || 'body';
      if (insertPosition === 'head') {
        document.head.appendChild(script);
      } else {
        document.body.appendChild(script);
      }
      
      this._log('debug', `开始加载脚本: ${normalizedSrc}`);
      this._emit('start', { src: normalizedSrc, script });
    });

    // 缓存Promise
    this.loadingPromises.set(normalizedSrc, promise);
    
    // 确保Promise结束后清理
    promise.finally(() => {
      // 清理超时的Promise引用
      setTimeout(() => {
        if (this.loadingPromises.get(normalizedSrc) === promise) {
          this.loadingPromises.delete(normalizedSrc);
        }
      }, 100);
    });

    return promise;
  }

  /**
   * 清理脚本元素
   * @private
   */
  _cleanupScript(script, src) {
    try {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    } catch (error) {
      this._log('debug', `清理脚本元素失败: ${src}`, error);
    }
  }

  /**
   * 批量加载脚本（顺序执行）
   * @param {Array} scripts 脚本地址数组
   * @param {Object} options 加载选项
   * @returns {Promise<Object>} 加载结果
   */
  async loadAllScripts(scripts, options = {}) {
    const startTime = performance.now();
    const results = {
      success: [],
      failed: [],
      skipped: [],
      total: scripts.length,
      time: 0
    };

    this._log('info', `开始批量加载 ${scripts.length} 个脚本`);
    this._emit('batchStart', { scripts, options });

    for (let i = 0; i < scripts.length; i++) {
      const src = scripts[i];
      
      try {
        await this.loadScript(src, options);
        results.success.push(src);
        
        this._log('debug', `[${i + 1}/${scripts.length}] 加载成功: ${src}`);
        this._emit('progress', {
          current: i + 1,
          total: scripts.length,
          src,
          success: true
        });
        
      } catch (error) {
        // 检查是否因为已加载而跳过
        if (error.message.includes('已缓存') || error.message.includes('已在DOM中')) {
          results.skipped.push(src);
          this._log('debug', `[${i + 1}/${scripts.length}] 跳过: ${src}`);
        } else {
          results.failed.push({
            src,
            error: error.message,
            code: error.code
          });
          this._log('warn', `[${i + 1}/${scripts.length}] 加载失败: ${src}`, error);
        }
        
        this._emit('progress', {
          current: i + 1,
          total: scripts.length,
          src,
          success: false,
          error
        });
        
        // 如果设置了stopOnError，则停止加载
        if (options.stopOnError) {
          this._log('warn', `遇到错误，停止后续加载: ${src}`);
          break;
        }
      }
    }

    results.time = performance.now() - startTime;
    
    this._log('info', `批量加载完成`, results);
    this._emit('batchComplete', results);
    
    return results;
  }

  /**
   * 并行加载脚本
   * @param {Array} scripts 脚本地址数组
   * @param {Object} options 加载选项
   * @returns {Promise<Object>} 加载结果
   */
  async loadAllScriptsParallel(scripts, options = {}) {
    const startTime = performance.now();
    
    this._log('info', `开始并行加载 ${scripts.length} 个脚本`);
    this._emit('parallelStart', { scripts, options });

    const promises = scripts.map(src => 
      this.loadScript(src, options)
        .then(() => ({ src, success: true }))
        .catch(error => ({ 
          src, 
          success: false, 
          error: error.message,
          code: error.code
        }))
    );

    const settledResults = await Promise.allSettled(promises);
    
    const results = {
      success: [],
      failed: [],
      skipped: [],
      total: scripts.length,
      time: performance.now() - startTime
    };

    settledResults.forEach((result, index) => {
      const src = scripts[index];
      
      if (result.status === 'fulfilled') {
        if (result.value.success) {
          results.success.push(src);
        } else {
          if (result.value.error.includes('已缓存') || result.value.error.includes('已在DOM中')) {
            results.skipped.push(src);
          } else {
            results.failed.push({
              src,
              error: result.value.error,
              code: result.value.code
            });
          }
        }
      } else {
        results.failed.push({
          src,
          error: result.reason?.message || 'Unknown error',
          code: result.reason?.code
        });
      }
    });

    this._log('info', `并行加载完成`, results);
    this._emit('parallelComplete', results);
    
    return results;
  }

  /**
   * 检查脚本加载状态
   * @param {string} src 脚本地址
   * @returns {string} 状态：'loaded' | 'loading' | 'failed' | 'none'
   */
  getScriptStatus(src) {
    const normalizedSrc = this._normalizeSrc(src);
    
    if (this.loadedScripts.has(normalizedSrc)) return 'loaded';
    if (this.loadingPromises.has(normalizedSrc)) return 'loading';
    if (this.failedScripts.has(normalizedSrc)) return 'failed';
    if (this._isScriptInDOM(normalizedSrc)) return 'loaded';
    
    return 'none';
  }

  /**
   * 获取加载统计信息
   * @returns {Object} 统计信息
   */
  getStats() {
    const stats = { ...this.loadStats };
    
    // 计算平均加载时间
    if (stats.successRequests > 0) {
      stats.avgLoadTime = stats.totalTime / stats.successRequests;
    }
    
    // 计算缓存命中率
    if (stats.totalRequests > 0) {
      stats.cacheHitRate = (stats.cachedRequests / stats.totalRequests * 100).toFixed(2) + '%';
    }
    
    // 计算成功率
    if (stats.totalRequests > 0) {
      const totalAttempts = stats.successRequests + stats.failedRequests;
      if (totalAttempts > 0) {
        stats.successRate = (stats.successRequests / totalAttempts * 100).toFixed(2) + '%';
      }
    }
    
    // 性能数据
    stats.performanceEntries = this.performanceEntries.length;
    
    return stats;
  }

  /**
   * 清理所有缓存
   */
  clearCache() {
    this.loadedScripts.clear();
    this.failedScripts.clear();
    this.loadingPromises.clear();
    
    this._log('info', '所有缓存已清理');
    this._emit('cacheCleared');
  }

  /**
   * 重置统计信息
   */
  resetStats() {
    this.loadStats = {
      totalRequests: 0,
      cachedRequests: 0,
      successRequests: 0,
      failedRequests: 0,
      totalTime: 0
    };
    
    this.performanceEntries = [];
    
    this._log('info', '统计信息已重置');
    this._emit('statsReset');
  }

  /**
   * 更新配置
   * @param {Object} newConfig 新配置
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    this._log('info', '配置已更新', this.config);
    this._emit('configUpdated', this.config);
  }

  /**
   * 销毁实例
   */
  destroy() {
    this.clearCache();
    this.eventListeners.clear();
    this._log('info', '实例已销毁');
    this._emit('destroyed');
  }
}

// ==================== 使用示例 ====================

// 示例1：基础使用
const loader = new CardScriptLoader({
  timeout: 15000,
  logLevel: 'info',
  version: '1.0.0'
});

// 监听事件
loader.on('loaded', ({ src, loadTime }) => {
  console.log(`脚本加载成功: ${src}，耗时: ${loadTime.toFixed(2)}ms`);
});

loader.on('error', ({ src, error }) => {
  console.error(`脚本加载失败: ${src}`, error);
});

// 批量加载卡片脚本
const cardScripts = [
  '/custom/card-b-hover1.js',
  '/custom/card-b-hover2.js',
  '/custom/card-b-hover3.js',
  '/custom/card-b-hover4.js',
  '/custom/card-b-hover5.js'
];

// 方式1：顺序加载（推荐）
loader.loadAllScripts(cardScripts, { 
  insertPosition: 'body',
  stopOnError: false
}).then(results => {
  console.log('顺序加载完成:', results);
  console.log('统计信息:', loader.getStats());
});

// 方式2：并行加载
// loader.loadAllScriptsParallel(cardScripts).then(results => {
//   console.log('并行加载完成:', results);
// });

// 方式3：动态按需加载
// document.querySelector('.some-card').addEventListener('mouseenter', () => {
//   if (loader.getScriptStatus('/custom/card-b-hover1.js') === 'none') {
//     loader.loadScript('/custom/card-b-hover1.js');
//   }
// });

// 清理缓存（如果需要强制重新加载）
// loader.clearCache();

// 销毁实例（在SPA路由切换时）
      
      
// window.addEventListener('beforeunload', () => loader.destroy());
```
</div>
