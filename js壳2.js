/**
 * CardScriptLoader - 卡片资源加载器（压缩版）
 * 功能特点：同时支持JS和CSS加载，避免重复加载，完善的错误处理和超时控制，详细的加载统计和日志
 */

class CardScriptLoader {
  constructor(options = {}) {
    this.config = {
      timeout: 10000,           // 超时时间（毫秒）
      enableCache: true,        // 启用缓存
      logLevel: 'warn',         // 日志级别：'debug' | 'info' | 'warn' | 'error' | 'none'
      version: '',              // 版本号（用于缓存控制）
      crossorigin: 'anonymous', // crossorigin属性
      ...options
    };

    // 加载状态缓存
    this.loadedResources = new Set();      // 已加载成功的资源
    this.failedResources = new Set();      // 已加载失败的资源
    this.loadingPromises = new Map();      // 正在加载的Promise
    this.resourceTypes = new Map();        // 资源类型映射
    
    // 加载统计
    this.loadStats = {
      js: { total: 0, cached: 0, success: 0, failed: 0, time: 0 },
      css: { total: 0, cached: 0, success: 0, failed: 0, time: 0 },
      total: 0
    };

    // 性能监控
    this.performanceEntries = [];
    
    // 事件监听器
    this.eventListeners = new Map();
    
    this._init();
  }

  // 初始化
  _init() {
    this._log('debug', 'CardScriptLoader 初始化完成');
    if ('PerformanceObserver' in window) {
      try {
        new PerformanceObserver(list => {
          list.getEntries().forEach(entry => {
            if (entry.initiatorType === 'script' || entry.initiatorType === 'link') {
              this.performanceEntries.push(entry);
            }
          });
        }).observe({ entryTypes: ['resource'] });
      } catch (e) {
        this._log('warn', '性能监控初始化失败:', e);
      }
    }
  }

  // 日志记录
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

  // 触发事件
  _emit(eventName, data) {
    const listeners = this.eventListeners.get(eventName) || [];
    listeners.forEach(callback => {
      try { callback(data); } catch (error) {
        this._log('error', `事件监听器执行失败 (${eventName}):`, error);
      }
    });
  }

  // 添加事件监听器
  on(eventName, callback) {
    if (!this.eventListeners.has(eventName)) this.eventListeners.set(eventName, []);
    this.eventListeners.get(eventName).push(callback);
  }

  // 移除事件监听器
  off(eventName, callback) {
    const listeners = this.eventListeners.get(eventName);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) listeners.splice(index, 1);
    }
  }

  // 生成带版本号的URL
  _getVersionedUrl(src) {
    if (!this.config.version) return src;
    const separator = src.includes('?') ? '&' : '?';
    return `${src}${separator}v=${this.config.version}`;
  }

  // 标准化URL
  _normalizeSrc(src) {
    try {
      return new URL(src, window.location.origin).href;
    } catch {
      return src;
    }
  }

  // 检查资源是否已存在
  _isResourceInDOM(src, type) {
    const normalizedSrc = this._normalizeSrc(src);
    
    if (type === 'js') {
      return Array.from(document.getElementsByTagName('script')).some(script => 
        this._normalizeSrc(script.src) === normalizedSrc
      );
    } else if (type === 'css') {
      return Array.from(document.getElementsByTagName('link')).some(link => 
        link.rel === 'stylesheet' && this._normalizeSrc(link.href) === normalizedSrc
      );
    }
    return false;
  }

  // 检测资源类型
  _detectResourceType(src) {
    const normalizedSrc = this._normalizeSrc(src).toLowerCase();
    if (normalizedSrc.endsWith('.js') || normalizedSrc.includes('.js?')) return 'js';
    if (normalizedSrc.endsWith('.css') || normalizedSrc.includes('.css?')) return 'css';
    return 'js'; // 默认返回js
  }

  // 加载JavaScript脚本
  loadScript(src, options = {}) {
    return this._loadResource(src, 'js', options);
  }

  // 加载CSS样式表
  loadStyle(href, options = {}) {
    return this._loadResource(href, 'css', options);
  }

  // 加载资源（内部方法）
  _loadResource(src, type, options = {}) {
    const startTime = performance.now();
    const mergedOptions = { ...this.config, ...options };
    const versionedSrc = mergedOptions.version ? this._getVersionedUrl(src) : src;
    const normalizedSrc = this._normalizeSrc(versionedSrc);
    
    // 更新统计
    const stats = this.loadStats[type];
    stats.total++;
    this.loadStats.total++;
    this.resourceTypes.set(normalizedSrc, type);

    // 1. 检查是否已加载成功
    if (mergedOptions.enableCache && this.loadedResources.has(normalizedSrc)) {
      stats.cached++;
      this._log('debug', `${type.toUpperCase()}已缓存，跳过加载: ${normalizedSrc}`);
      this._emit('cached', { src: normalizedSrc, type, fromCache: true });
      return Promise.resolve();
    }

    // 2. 检查是否已加载失败
    if (this.failedResources.has(normalizedSrc)) {
      this._log('warn', `${type.toUpperCase()}之前加载失败，跳过重试: ${normalizedSrc}`);
      return Promise.reject(new Error(`${type.toUpperCase()}之前加载失败: ${normalizedSrc}`));
    }

    // 3. 检查是否正在加载中
    if (this.loadingPromises.has(normalizedSrc)) {
      this._log('debug', `${type.toUpperCase()}正在加载中，返回现有Promise: ${normalizedSrc}`);
      return this.loadingPromises.get(normalizedSrc);
    }

    // 4. 检查是否已在DOM中但未记录
    if (this._isResourceInDOM(normalizedSrc, type)) {
      this._log('debug', `${type.toUpperCase()}已在DOM中，标记为已加载: ${normalizedSrc}`);
      this.loadedResources.add(normalizedSrc);
      this._emit('loadedFromDOM', { src: normalizedSrc, type });
      return Promise.resolve();
    }

    // 5. 创建新的加载Promise
    const promise = new Promise((resolve, reject) => {
      let element;
      
      if (type === 'js') {
        element = this._createScriptElement(versionedSrc, normalizedSrc, mergedOptions);
      } else if (type === 'css') {
        element = this._createStyleElement(versionedSrc, normalizedSrc, mergedOptions);
      } else {
        reject(new Error(`不支持的资源类型: ${type}`));
        return;
      }
      
      // 设置超时
      const timeoutId = setTimeout(() => {
        this._cleanupResource(element, normalizedSrc, type);
        const error = new Error(`${type.toUpperCase()}加载超时 (${mergedOptions.timeout}ms): ${normalizedSrc}`);
        error.code = 'TIMEOUT'; error.src = normalizedSrc; error.type = type;
        reject(error);
        this._log('error', `${type.toUpperCase()}加载超时: ${normalizedSrc}`);
        this._emit('timeout', { src: normalizedSrc, type, timeout: mergedOptions.timeout, error });
      }, mergedOptions.timeout);

      // 加载成功
      const onLoad = () => {
        clearTimeout(timeoutId);
        const loadTime = performance.now() - startTime;
        stats.success++; stats.time += loadTime;
        this.loadedResources.add(normalizedSrc);
        this.loadingPromises.delete(normalizedSrc);
        this._log('info', `${type.toUpperCase()}加载成功: ${normalizedSrc} (${loadTime.toFixed(2)}ms)`);
        this._emit('loaded', { src: normalizedSrc, type, loadTime, element });
        resolve();
      };

      // 加载失败
      const onError = (event) => {
        clearTimeout(timeoutId);
        this._cleanupResource(element, normalizedSrc, type);
        stats.failed++;
        this.failedResources.add(normalizedSrc);
        this.loadingPromises.delete(normalizedSrc);
        const error = new Error(`${type.toUpperCase()}加载失败: ${normalizedSrc}`);
        error.code = 'LOAD_ERROR'; error.src = normalizedSrc; error.type = type; error.event = event;
        this._log('error', `${type.toUpperCase()}加载失败: ${normalizedSrc}`, error);
        this._emit('error', { src: normalizedSrc, type, error, element });
        reject(error);
      };

      // 设置事件监听
      if (type === 'js') {
        element.onload = onLoad;
        element.onerror = onError;
      } else if (type === 'css') {
        // CSS没有标准的onload事件，使用以下方式
        if ('onload' in element) {
          element.onload = onLoad;
          element.onerror = onError;
        } else {
          // 降级方案：检查样式表是否加载
          setTimeout(() => {
            try {
              const sheets = document.styleSheets;
              for (let i = 0; i < sheets.length; i++) {
                if (sheets[i].href === element.href) {
                  onLoad();
                  return;
                }
              }
              onError(new Event('error'));
            } catch (e) {
              onLoad();
            }
          }, 100);
        }
      }
      
      // 添加到DOM
      const insertPosition = mergedOptions.insertPosition || 'head';
      (insertPosition === 'head' ? document.head : document.body).appendChild(element);
      
      this._log('debug', `开始加载${type.toUpperCase()}: ${normalizedSrc}`);
      this._emit('start', { src: normalizedSrc, type, element });
    });

    // 缓存Promise
    this.loadingPromises.set(normalizedSrc, promise);
    
    // 确保Promise结束后清理
    promise.finally(() => {
      setTimeout(() => {
        if (this.loadingPromises.get(normalizedSrc) === promise) {
          this.loadingPromises.delete(normalizedSrc);
        }
      }, 100);
    });

    return promise;
  }

  // 创建Script元素
  _createScriptElement(src, normalizedSrc, options) {
    const script = document.createElement('script');
    script.src = src;
    script.async = options.async !== false;
    script.defer = options.defer !== false;
    if (options.crossorigin) script.crossOrigin = options.crossorigin;
    script.dataset.loader = 'card-resource-loader';
    script.dataset.src = src;
    script.dataset.timestamp = Date.now();
    return script;
  }

  // 创建Style元素
  _createStyleElement(href, normalizedSrc, options) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    if (options.crossorigin) link.crossOrigin = options.crossorigin;
    link.dataset.loader = 'card-resource-loader';
    link.dataset.href = href;
    link.dataset.timestamp = Date.now();
    return link;
  }

  // 清理资源元素
  _cleanupResource(element, src, type) {
    try {
      if (element.parentNode) element.parentNode.removeChild(element);
    } catch (error) {
      this._log('debug', `清理${type.toUpperCase()}元素失败: ${src}`, error);
    }
  }

  // 批量加载脚本（顺序执行）
  async loadAllScripts(scripts, options = {}) {
    return this._loadAllResources(scripts, 'js', options);
  }

  // 批量加载样式表（顺序执行）
  async loadAllStyles(styles, options = {}) {
    return this._loadAllResources(styles, 'css', options);
  }

  // 批量加载资源（顺序执行）
  async _loadAllResources(resources, type, options = {}) {
    const startTime = performance.now();
    const results = { success: [], failed: [], skipped: [], total: resources.length, time: 0 };
    const typeName = type.toUpperCase();

    this._log('info', `开始批量加载 ${resources.length} 个${typeName}`);
    this._emit('batchStart', { resources, type, options });

    for (let i = 0; i < resources.length; i++) {
      const src = resources[i];
      try {
        await (type === 'js' ? this.loadScript(src, options) : this.loadStyle(src, options));
        results.success.push(src);
        this._log('debug', `[${i + 1}/${resources.length}] ${typeName}加载成功: ${src}`);
        this._emit('progress', { current: i + 1, total: resources.length, src, type, success: true });
      } catch (error) {
        if (error.message.includes('已缓存') || error.message.includes('已在DOM中')) {
          results.skipped.push(src);
          this._log('debug', `[${i + 1}/${resources.length}] ${typeName}跳过: ${src}`);
        } else {
          results.failed.push({ src, type, error: error.message, code: error.code });
          this._log('warn', `[${i + 1}/${resources.length}] ${typeName}加载失败: ${src}`, error);
        }
        this._emit('progress', { current: i + 1, total: resources.length, src, type, success: false, error });
        if (options.stopOnError) {
          this._log('warn', `遇到错误，停止后续${typeName}加载: ${src}`);
          break;
        }
      }
    }

    results.time = performance.now() - startTime;
    this._log('info', `${typeName}批量加载完成`, results);
    this._emit('batchComplete', { ...results, type });
    return results;
  }

  // 并行加载脚本
  async loadAllScriptsParallel(scripts, options = {}) {
    return this._loadAllResourcesParallel(scripts, 'js', options);
  }

  // 并行加载样式表
  async loadAllStylesParallel(styles, options = {}) {
    return this._loadAllResourcesParallel(styles, 'css', options);
  }

  // 并行加载资源
  async _loadAllResourcesParallel(resources, type, options = {}) {
    const startTime = performance.now();
    const typeName = type.toUpperCase();
    this._log('info', `开始并行加载 ${resources.length} 个${typeName}`);
    this._emit('parallelStart', { resources, type, options });

    const promises = resources.map(src => {
      const loadFunc = type === 'js' ? this.loadScript.bind(this) : this.loadStyle.bind(this);
      return loadFunc(src, options)
        .then(() => ({ src, type, success: true }))
        .catch(error => ({ src, type, success: false, error: error.message, code: error.code }));
    });

    const settledResults = await Promise.allSettled(promises);
    const results = { success: [], failed: [], skipped: [], total: resources.length, time: performance.now() - startTime };

    settledResults.forEach((result, index) => {
      const src = resources[index];
      if (result.status === 'fulfilled') {
        if (result.value.success) {
          results.success.push(src);
        } else {
          if (result.value.error.includes('已缓存') || result.value.error.includes('已在DOM中')) {
            results.skipped.push(src);
          } else {
            results.failed.push({ src, type, error: result.value.error, code: result.value.code });
          }
        }
      } else {
        results.failed.push({ src, type, error: result.reason?.message || 'Unknown error', code: result.reason?.code });
      }
    });

    this._log('info', `${typeName}并行加载完成`, results);
    this._emit('parallelComplete', { ...results, type });
    return results;
  }

  // 混合加载：同时加载JS和CSS
  async loadMixedResources(resources, options = {}) {
    const startTime = performance.now();
    const jsResources = resources.js || [];
    const cssResources = resources.css || [];
    const allResources = [...jsResources, ...cssResources];
    
    this._log('info', `开始混合加载: ${jsResources.length}个JS, ${cssResources.length}个CSS`);
    this._emit('mixedStart', { resources, options });

    const jsPromises = jsResources.map(src => 
      this.loadScript(src, options)
        .then(() => ({ src, type: 'js', success: true }))
        .catch(error => ({ src, type: 'js', success: false, error: error.message, code: error.code }))
    );

    const cssPromises = cssResources.map(src => 
      this.loadStyle(src, options)
        .then(() => ({ src, type: 'css', success: true }))
        .catch(error => ({ src, type: 'css', success: false, error: error.message, code: error.code }))
    );

    const settledResults = await Promise.allSettled([...jsPromises, ...cssPromises]);
    const results = {
      js: { success: [], failed: [], skipped: [] },
      css: { success: [], failed: [], skipped: [] },
      total: allResources.length,
      time: performance.now() - startTime
    };

    settledResults.forEach((result, index) => {
      const src = index < jsResources.length ? jsResources[index] : cssResources[index - jsResources.length];
      const type = index < jsResources.length ? 'js' : 'css';
      const target = results[type];
      
      if (result.status === 'fulfilled') {
        if (result.value.success) {
          target.success.push(src);
        } else {
          if (result.value.error.includes('已缓存') || result.value.error.includes('已在DOM中')) {
            target.skipped.push(src);
          } else {
            target.failed.push({ src, error: result.value.error, code: result.value.code });
          }
        }
      } else {
        target.failed.push({ src, error: result.reason?.message || 'Unknown error', code: result.reason?.code });
      }
    });

    this._log('info', '混合加载完成', results);
    this._emit('mixedComplete', results);
    return results;
  }

  // 检查资源加载状态
  getResourceStatus(src) {
    const normalizedSrc = this._normalizeSrc(src);
    const type = this._detectResourceType(normalizedSrc);
    let status = 'none';
    if (this.loadedResources.has(normalizedSrc)) status = 'loaded';
    else if (this.loadingPromises.has(normalizedSrc)) status = 'loading';
    else if (this.failedResources.has(normalizedSrc)) status = 'failed';
    else if (this._isResourceInDOM(normalizedSrc, type)) status = 'loaded';
    return { src: normalizedSrc, type, status };
  }

  // 检查脚本加载状态（兼容旧版）
  getScriptStatus(src) {
    const status = this.getResourceStatus(src);
    return status.type === 'js' ? status.status : 'none';
  }

  // 检查样式表加载状态
  getStyleStatus(src) {
    const status = this.getResourceStatus(src);
    return status.type === 'css' ? status.status : 'none';
  }

  // 获取加载统计信息
  getStats() {
    const stats = { ...this.loadStats };
    stats.totalSuccess = stats.js.success + stats.css.success;
    stats.totalFailed = stats.js.failed + stats.css.failed;
    stats.totalCached = stats.js.cached + stats.css.cached;
    stats.totalTime = stats.js.time + stats.css.time;
    
    if (stats.totalSuccess > 0) stats.avgLoadTime = stats.totalTime / stats.totalSuccess;
    if (stats.total > 0) stats.cacheHitRate = (stats.totalCached / stats.total * 100).toFixed(2) + '%';
    if (stats.totalSuccess + stats.totalFailed > 0) {
      stats.successRate = (stats.totalSuccess / (stats.totalSuccess + stats.totalFailed) * 100).toFixed(2) + '%';
    }
    
    ['js', 'css'].forEach(type => {
      const typeStats = stats[type];
      if (typeStats.success > 0) typeStats.avgLoadTime = typeStats.time / typeStats.success;
      if (typeStats.total > 0) typeStats.cacheHitRate = (typeStats.cached / typeStats.total * 100).toFixed(2) + '%';
      if (typeStats.success + typeStats.failed > 0) {
        typeStats.successRate = (typeStats.success / (typeStats.success + typeStats.failed) * 100).toFixed(2) + '%';
      }
    });
    
    stats.performanceEntries = this.performanceEntries.length;
    return stats;
  }

  // 清理所有缓存
  clearCache() {
    this.loadedResources.clear();
    this.failedResources.clear();
    this.loadingPromises.clear();
    this.resourceTypes.clear();
    this._log('info', '所有缓存已清理');
    this._emit('cacheCleared');
  }

  // 重置统计信息
  resetStats() {
    this.loadStats = {
      js: { total: 0, cached: 0, success: 0, failed: 0, time: 0 },
      css: { total: 0, cached: 0, success: 0, failed: 0, time: 0 },
      total: 0
    };
    this.performanceEntries = [];
    this._log('info', '统计信息已重置');
    this._emit('statsReset');
  }

  // 更新配置
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    this._log('info', '配置已更新', this.config);
    this._emit('configUpdated', this.config);
  }

  // 销毁实例
  destroy() {
    this.clearCache();
    this.eventListeners.clear();
    this._log('info', '实例已销毁');
    this._emit('destroyed');
  }
}

// ==================== 你的使用代码从这里开始 ====================

// 创建加载器实例
const loader = new CardScriptLoader({
  timeout: 15000,        // 超时时间15秒
  logLevel: 'info',      // 显示信息级别的日志
  version: '1.0.0',      // 版本号（用于缓存控制）
  enableCache: true      // 启用缓存
});

// 监听加载事件（可选）
loader.on('loaded', ({ src, type, loadTime }) => {
  console.log(`✅ ${type.toUpperCase()}加载成功: ${src} (${loadTime.toFixed(0)}ms)`);
});

loader.on('error', ({ src, type, error }) => {
  console.error(`❌ ${type.toUpperCase()}加载失败: ${src}`, error);
});

loader.on('cached', ({ src, type }) => {
  console.log(`📦 ${type.toUpperCase()}从缓存加载: ${src}`);
});

// 定义你要加载的脚本
const scriptsToLoad = [
  'custom/xxxxx.js',   //把xxx改为你的文件名，例如：custom/card-b-hover.js
  'custom/xxxxx.js'   //注意最后一个js结尾没有逗号，很多人都在这出错了，导致效果没出来。
];

// 定义你要加载的样式表
const stylesToLoad = [
  'custom/xxx.css',
  'custom/xxx.css'
];

// 自动加载所有资源（当页面加载完成后）
document.addEventListener('DOMContentLoaded', function() {
  console.log('🚀 开始加载所有资源...');
  
  // 方式1：混合加载（JS和CSS同时加载）
  loader.loadMixedResources({
    js: scriptsToLoad,
    css: stylesToLoad
  }).then(results => {
    console.log('🎉 所有资源加载完成！', results);
    console.log('📊 统计信息:', loader.getStats());
  }).catch(error => {
    console.error('💥 资源加载过程中出错:', error);
  });
  
  // 或者使用方式2：分别加载
  /*
  loader.loadAllScripts(scriptsToLoad).then(jsResults => {
    console.log('✅ JS加载完成:', jsResults);
    return loader.loadAllStyles(stylesToLoad);
  }).then(cssResults => {
    console.log('✅ CSS加载完成:', cssResults);
    console.log('📊 总统计信息:', loader.getStats());
  });
  */
});

// 将loader暴露给全局，方便在浏览器控制台调试
if (typeof window !== 'undefined') {
  window.loader = loader;
  window.CardScriptLoader = CardScriptLoader;
}

// ==================== 文件结束 ====================