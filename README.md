#  小程序

本文是深入学习小程序的一些个人理解：包括小程序架构原理、优化、各大小程序框架(预编译型、半编译半运行时框架、运行时框架)的一些对比理解等



## 小程序开发最基本的三大块

**带着问题来看一下小程序开发最基本的三大块：**

- js 逻辑
  - 问题：为什么需要一个单独的线程进行 js 的运行
  - 问题：为什么不能直接通过 js 操纵 dom
  - 问题：...
- wxml 视图模板
  - 问题：微信小程序是怎么识别 wxml 的，是直接有一个可以执行 wxml 的环境还是将 wxml 转换为 html
  - 问题：为什么小程序只提供有效的标签和自定义组件的方式，而不像原生 html 有那么多丰富的标签属性
  - 问题：...
- wxss 样式文件
  - 问题： 同样，微信小程序是怎么识别 wxss 的
  - 微信小程序的 rpx 单位是怎么实现的
  - 问题：...



## 小程序一些需要知道的东西

**基础架构图：**

![小程序基础架构图](/images/img1.jpg)



**可以看出，小程序基本的架构，双线程模型：**

- webView 视图线程： 处理 wxml 和 wxss，然后显示页面

  1、在微信小程序中，视图层其实就是一个 iframe，可以通过**微信开发者工具-->调试-->调试微信开发者工具**打开

  ![](/images/img2.png)



​    2、每个小程序页面都是用不同的 WebView 去渲染，这样可以提供更好的交互体验，更贴近原生体验，也避免了单个 WebView 的任务过于繁重。而这个 iframe 里面封装的是一些 html 代码，通过在调试开发者工具中执行 document.getElementsByTagName('webview')[0].showDevTools(true, null) 可以看到如下代码：

  ![](/images/img3.png)

  3、wx-view 这些就类似 web component 组件之类的东西，这些就是真正运行在 iframe 中的东西

 4、 而解析 wx-view 这些东西依赖于微信的基础库，可以直接在开发者工具里通过 openVendor() 打开基础库文件夹；（每一个 .wxvpkg 文件对应一个基础库，微信小程序是运行在基础库之上的，才可以实现小程序代码的各种解析和各种功能）

![](/images/img4.png)

5、解开 .wxvpkg 包，里面是小程序基础库源码，主要两个模块。利用 [wechat-app-unpack](https://github.com/leo9960/wechat-app-unpack) 解压基础库 .wxvpkg 包

- WAWebview：小程序视图层基础库，提供视图层基础能力

- WAService：小程序逻辑层基础库，提供逻辑层基础能力

  ![](/images/img8.png)

6、这里面除了有微信各个版本的基础库，还有两个非常重要的东西，wcc 和 wcsc；**wcc 将 wxml 转换为 html，wcsc 将 wxss 转换为 css**



- jscore 逻辑线程：js 执行引擎

  1、 在开发者工具中输入 document 就可以看到逻辑层代码

  ![](/images/img7.png)



**jscore 逻辑层和 webview 视图层的通讯： 事件驱动的通讯方式**

逻辑层和视图层之间的通讯方式并非跟 vue/react 一样直接通过两者之间传递数据和事件，而是由 native 作为中间媒介进行转发，这个过程就是一个**事件驱动模式**

- 视图层通过与用户的交互触发特定事件 event，然后将 事件 event 传递给逻辑层
- 逻辑层通过一系列的逻辑处理、数据请求，接口调用等将加工好的数据 data 传给视图层
- 视图层将数据 data 数据可视化展示



**双线程交互的生命周期：**

![](/images/img6.png)



**双线程模型的相对于浏览器的一些好处：**

- 更加安全

  首先，如果是浏览器，如果要保证 js 代码是线程安全的，那么有一个基本的就是禁止第三方 js 操作网站 dom，这个就例如回复留言是一段 js 代码，这段 js 代码如果直接操作的网站的 dom，那么就是不安全的，有点 xss 攻击的意思。而小程序 js 线程独立，更新 ui 视图的方式与 vue/react 类似，不能直接通过 js 代码操作 dom，而是通过更新状态(setState)的方式异步更新视图。微信小程序阻止开发者使用一些浏览器提供的，诸如跳转页面、操作 DOM、动态执行脚本的开放性接口，可以防止开发者随意操作界面，更好的保证了用户数据安全。

- 更加高效

  1、正常的**浏览器渲染过程**：当打开一个网页，首先有一个主线程去下载 html，然后解析 html 文档，而 html 文档里面有 js 脚本和 css，当遇到 js脚本，那么会去加载 js，那么就会**阻塞**主线程解析 html，影响视图渲染，造成常见的白屏现象。而小程序的双线程模型，js 和 wxml、wxss **不在一个线程之中**，所以 js 的加载不会阻塞视图层的渲染。

  2、通过 setState 方式异步更新视图，会使用到 vdom 和高效的 diff 算法，能过有效减少重绘与回流。



## 小程序基础库

**基础库整体架构**

小程序的基础库是 JavaScript 编写的，基础库提供组件和 API，处理数据绑定、组件系统、事件系统、通信系统等一系列框架逻辑，可以被注入到渲染层和逻辑层运行。在渲染层可以用各类组件组建界面的元素，在逻辑层可以用各类 API 来处理各种逻辑。PageView 可以是 WebView、React-Native-Like、Flutter 来渲染。

**基础库架构设计参考:  ** [基于小程序技术栈的微信客户端跨平台实践](https://ppt.geekbang.org/slide/show?cid=42&pid=2338)

![](/images/img5.png)



**小程序的基础库主要分为：**

- WAWebview：小程序视图层基础库，提供视图层基础能力
- WAService：小程序逻辑层基础库，提供逻辑层基础能力

**WAWebview 基础库源码源码概览：**

```js
var __wxLibrary = {
  fileName: 'WAWebview.js',
  envType: 'WebView',
  contextType: 'others',
  execStart: Date.now()
};

var __WAWebviewStartTime__ = Date.now();

var __libVersionInfo__ = {
  "updateTime": "2020.11.25 23:32:34",
  "version": "2.13.2",
  "features": {
    "pruneWxConfigByPage": true,
    "injectGameContextPlugin": true,
    "lazyCodeLoading2": true,
    "injectAppSeparatedPlugin": true,
    "nativeTrans": true
  }
};

/**
 * core-js 模块
 */
!function(n, o, Ye) {
  ...
  }, function(e, t, i) {
    var n = i(3),
      o = "__core-js_shared__",
      r = n[o] || (n[o] = {});
    e.exports = function(e) {
      return r[e] || (r[e] = {})
    }
  ...
}(1, 1);

var __wxTest__ = !1,
var __wxConfig;

var wxRunOnDebug = function(e) {
  e()
};

/**
 * 基础模块
 */
var Foundation = function(i) {
  ...
}]).default;

var nativeTrans = function(e) {
  ...
}(this);

/**
 * 消息通信模块
 */
var WeixinJSBridge = function(e) {
  ...
}(this);

/**
 * 监听 nativeTrans 相关事件
 */
function() {
  ...
}();

/**
 * 解析配置
 */
function(r) {
  ...
  __wxConfig = _(__wxConfig), __wxConfig = v(__wxConfig), Foundation.onConfigReady(function() {
    m()
  }), n ? __wxConfig.__readyHandler = A : d ? Foundation.onBridgeReady(function() {
    WeixinJSBridge.on("onWxConfigReady", A)
  }) : Foundation.onLibraryReady(A)
}(this);

/**
 * 异常捕获（error、onunhandledrejection）
 */
function(e) {
  function t(e) {
    Foundation.emit("unhandledRejection", e) || console.error("Uncaught (in promise)", e.reason)
  }
  "object" == typeof e && "function" == typeof e.addEventListener ? (e.addEventListener("unhandledrejection", function(e) {
    t({
      reason: e.reason,
      promise: e.promise
    }), e.preventDefault()
  }), e.addEventListener("error", function(e) {
    var t;
    t = e.error, Foundation.emit("error", t) || console.error("Uncaught", t), e.preventDefault()
  })) : void 0 === e.onunhandledrejection && Object.defineProperty(e, "onunhandledrejection", {
    value: function(e) {
      t({
        reason: (e = e || {}).reason,
        promise: e.promise
      })
    }
  })
}(this);

/**
 * 原生缓冲区
 */
var NativeBuffer = function(e) {
  ...
}(this);
var WeixinNativeBuffer = NativeBuffer;
var NativeBuffer = null;

/**
 * 日志模块：wxConsole、wxPerfConsole、wxNativeConsole、__webviewConsole__
 */
var wxConsole = ["log", "info", "warn", "error", "debug", "time", "timeEnd", "group", "groupEnd"].reduce(function(e, t) {
  return e[t] = function() {}, e
}, {});

var wxPerfConsole = ["log", "info", "warn", "error", "time", "timeEnd", "trace", "profile", "profileSync"].reduce(function(e, t) {
  return e[t] = function() {}, e
}, {});

var wxNativeConsole = function(i) {
  ...
}([function(e, t, i) {
  ...
}]).default;

var __webviewConsole__ = function(i) {
  ...
}([function(e, t, i) {
  ...
}]);

/**
 * 上报模块
 */
var Reporter = function(i) {
  ...
}([function(e, L, O) {
  ...
}]).default;

var Perf = function(i) {
  ...
}([function(e, t, i) {
  ...
}]).default;

/**
 * 视图层 API
 */
var __webViewSDK__ = function(i) {
  ...
}([function(e, L, O) {
  ...
}]).default;
var wx = __webViewSDK__.wx;

/**
 * 组件系统
 */
var exparser = function(i) {
  ...
}([function(e, t, i) {
  ...
}]);

/**
 * 框架粘合层
 * 
 * 使用 exparser.registerBehavior 和 exparser.registerElement 方法注册内置组件
 * 转发 window、wx 对象上到事件转发到 exparser
 */
!function(i) {
  ...
}([function(e, t) {
  ...
}, function(e, t) {}, , function(e, t) {}]);

/**
 * Virtual DOM 
 */
var __virtualDOMDataThread__ = !1,
var __virtualDOM__ = function(i) {
  ...
}([function(e, t, i) {
  ...
}]);

/**
 * __webviewEngine__
 */
var __webviewEngine__ = function(i) {
  ...
}([function(e, t, i) {
  ...
}]);

/**
 * 注入默认样式到页面
 */
!function() {
  ...
  function e() {
     var e = i('...');
    __wxConfig.isReady ? void 0 !== __wxConfig.theme && i(t, e.nextElementSibling) : __wxConfig.onReady(function() {
      void 0 !== __wxConfig.theme && i(t, e.nextElementSibling)
    })
  }
  window.document && "complete" === window.document.readyState ? e() : window.onload = e
}();

var __WAWebviewEndTime__ = Date.now();
typeof __wxLibrary.onEnd === 'function' && __wxLibrary.onEnd();
__wxLibrary = undefined;
```

其中，WAWebview 最主要的几个部分：

- Foundation：基础模块
- WeixinJSBridge：消息通信模块
- exparser：组件系统模块
- `__virtualDOM__`：虚拟 Dom 模块
- `__webViewSDK__`：WebView SDK 模块
- Reporter：日志上报模块(异常和性能统计数据)



**WAService 基础库源码源码概览：**

```js
var __wxLibrary = {
  fileName: 'WAService.js',
  envType: 'Service',
  contextType: 'App:Uncertain',
  execStart: Date.now()
};
var __WAServiceStartTime__ = Date.now();

(function(global) {
  var __exportGlobal__ = {};
  var __libVersionInfo__ = {
    "updateTime": "2020.11.25 23:32:34",
    "version": "2.13.2",
    "features": {
      "pruneWxConfigByPage": true,
      "injectGameContextPlugin": true,
      "lazyCodeLoading2": true,
      "injectAppSeparatedPlugin": true,
      "nativeTrans": true
    }
  };
  var __Function__ = global.Function;
  var Function = __Function__;

  /**
   * core-js 模块
   */
  !function(r, o, Ke) {
  }(1, 1);

  var __wxTest__ = !1;
  wxRunOnDebug = function(A) {
    A()
  };

  var __wxConfig;
  /**
   * 基础模块
   */
  var Foundation = function(n) {
    ...
  }([function(e, t, n) {
    ...
  }]).default;

  var nativeTrans = function(e) {
    ...
  }(this);

  /**
   * 消息通信模块
   */
  var WeixinJSBridge = function(e) {
    ...
  }(this);

  /**
   * 监听 nativeTrans 相关事件
   */
  function() {
    ...
  }();

  /**
   * 解析配置
   */
  function(i) {
    ...
  }(this);

  /**
   * 异常捕获（error、onunhandledrejection）
   */
  !function(A) {
    ...
  }(this);

  /**
   * 原生缓冲区
   */
  var NativeBuffer = function(e) {
    ...
  }(this);
  WeixinNativeBuffer = NativeBuffer;
  NativeBuffer = null;

  var wxConsole = ["log", "info", "warn", "error", "debug", "time", "timeEnd", "group", "groupEnd"].reduce(function(e, t) {
      return e[t] = function() {}, e
    }, {});

  var wxPerfConsole = ["log", "info", "warn", "error", "time", "timeEnd", "trace", "profile", "profileSync"].reduce(function(e, t) {
    return e[t] = function() {}, e
  }, {});

  var wxNativeConsole = function(n) {
    ...
  }([function(e, t, n) {
    ...
  }]).default;

  /**
   * Worker 模块
   */
  var WeixinWorker = function(A) {
    ...
  }(this);

  /**
   * JSContext
   */
  var JSContext = function(n) {
    ...
  }([
    ...
  }]).default;

  var __appServiceConsole__ = function(n) {
    ...
  }([function(e, N, R) {
    ...
  }]).default;

  var Protect = function(n) {
    ...
  }([function(e, t, n) {
    ...
  }]);

  var Reporter = function(n) {
    ...
  }([function(e, N, R) {
    ...
  }]).default;

  var __subContextEngine__ = function(n) {
    ...
  }([function(e, t, n) {
    ...
  }]);

  var __waServiceInit__ = function() {
    ...
  }

  function __doWAServiceInit__() {
    var e;
    "undefined" != typeof wx && wx.version && (e = wx.version), __waServiceInit__(), e && "undefined" != typeof __exportGlobal__ && __exportGlobal__.wx && (__exportGlobal__.wx.version = e)
  }
  __subContextEngine__.isIsolateContext();
  __subContextEngine__.isIsolateContext() || __doWAServiceInit__();
  __subContextEngine__.initAppRelatedContexts(__exportGlobal__);
})(this);

var __WAServiceEndTime__ = Date.now();
typeof __wxLibrary.onEnd === 'function' && __wxLibrary.onEnd();
__wxLibrary = undefined;
```

其中，WAService 最主要的几个部分：

- Foundation：基础模块
- WeixinJSBridge：消息通信模块
- WeixinNativeBuffer：原生缓冲区
- WeixinWorker：Worker 线程
- JSContext：JS Engine Context
- Protect：JS 保护的对象
- `__subContextEngine__`：提供 App、Page、Component、Behavior、getApp、getCurrentPages 等方法

