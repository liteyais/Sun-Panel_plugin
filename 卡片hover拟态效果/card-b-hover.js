// 单个卡片模糊效果的样式和逻辑
(function () {
    // 创建样式元素
    const style = document.createElement('style');
    style.id = 'card-blur-styles';

    // CSS 样式内容
    style.textContent = `
        /*==图标布局==*/
        .app-icon-small-icon {
            border-radius: 0 !important;
        }
        .item-card-small-icon {
            border-radius: 24px !important;
        }
        .item-card-info {
            border-radius: 16px;
            transition: all 0.4s ease;
            background: rgba(255, 255, 255, 0.80) !important;
            backdrop-filter: blur(2px);
        }
        .item-card-info:hover, .item-card-small-icon:hover {
            transform: translateY(-4px);
            box-shadow: 0 10px 20px rgba(231, 76, 60, 0.2);
            transition: all 0.3s ease;
            box-shadow: none !important;
            background: #fff !important;
        }
        /*==卡片模糊==*/
        .item-icon {
            overflow: inherit !important;
        }
        /* 图片容器样式 */
        .n-image {
            position: relative !important;
            /* 注意：这里没有 overflow: hidden，确保模糊效果完整显示 */
        }
        .n-image img {
            position: relative !important;
            z-index: 2 !important;
            border-radius: 100% !important;
            transition: transform 0.3s ease;
        }
        /* 模糊效果层 */
        .n-image::before {
            content: '';
            position: absolute !important;
            top: -10px; /* 扩大范围确保模糊效果完整 */
            left: -10px;
            right: -10px;
            bottom: -10px;
            background-image: var(--bg-image); /* 由JavaScript设置 */
            background-size: cover;
            background-position: center;
            border-radius: 100% !important;
            filter: blur(8px);
            opacity: 0; /* 默认隐藏 */
            z-index: 1;
            pointer-events: none; /* 不干扰鼠标事件 */
            transform: scale(0) translate(0px);
        }
        /* 鼠标经过卡片时，图片显示模糊效果 */
        .item-card:hover .n-image::before {
            opacity: 0.4; /*  显示模糊效果   */
            border-radius: 100% !important;
            filter: blur(10px);
            transform: scale(1.05);
            transition: transform .3s ease;
        }
        /*==卡片内文字==*/
        .app-icon-info-text-box-title {
            color: #444 !important;
        }
        .app-icon-info-text-box-description {
            display: flex;
        }
        .app-icon-info-text-box-description > span {
            display: flex;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            line-height: 20px;
            color: #999;
        }

        .app-icon-small-icon .item-icon .n-image >img{
            border-radius: 16px !important;
        }
        /*==搜索==*/

    .search-container > input {
        font-size: 14px !important;
        font-weight: 400 !important;
        height: 48px !important;
    }
        .search-container {
            border-radius: 16px !important;
            background: rgba(255, 255, 255, 0.50) !important;
            backdrop-filter: blur(12px) !important;
            border: none !important;
            min-width: 400px !important;
            margin: 0 auto !important;

        }
        .search-container:hover{
            box-shadow: none !important;
            background: rgba(255, 255, 255, 0.80) !important;
            transition: background 0.2s !important;
        }
        .search-container > input::placeholder {
            color: rgba(0, 0, 0, 0.40) !important;
            font-size: 14px !important;
            font-weight: 400 !important;
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

    // 将样式添加到文档头部
    if (document.head) {
        document.head.appendChild(style);
    } else {
        // 如果head还没加载，等待DOM加载完成
        document.addEventListener('DOMContentLoaded', function () {
            document.head.appendChild(style);
        });
    }

    // 可选：添加动态设置背景图片的功能
    function setCardBackgroundImages() {
        document.querySelectorAll('.n-image').forEach(function (imageEl) {
            const img = imageEl.querySelector('img');
            if (img && img.src) {
                imageEl.style.setProperty('--bg-image', 'url(' + img.src + ')');
            }
        });
    }

    // 当DOM加载完成时设置背景图片
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setCardBackgroundImages);
    } else {
        setCardBackgroundImages();
    }

    // 监听动态添加的卡片
    const observer = new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
            if (mutation.addedNodes.length) {
                setCardBackgroundImages();
            }
        });
    });

    // 开始观察整个文档的变化
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // 提供公共API（可选）
    window.CardBlurEffects = {
        refreshBackgrounds: setCardBackgroundImages,
        disable: function () {
            const styleEl = document.getElementById('card-blur-styles');
            if (styleEl) {
                styleEl.disabled = true;
            }
        },
        enable: function () {
            const styleEl = document.getElementById('card-blur-styles');
            if (styleEl) {
                styleEl.disabled = false;
            }
        }
    };
})();
