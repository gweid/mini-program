#  小程序

本文是深入学习小程序的一些个人记录：包括小程序架构原理、各大小程序框架(预编译型、半编译半运行时框架、运行时框架)的一些理解、CI 持续集成等。



可参考：

[微信小程序技术原理分析](https://zhaomenghuan.js.org/blog/wechat-miniprogram-principle-analysis.html)

[深入浅出主流的几款小程序跨端框架原理](https://juejin.cn/post/6881597846307635214)



## 小程序基础



#### 带着问题来看一下小程序的三大块：

- js 逻辑（运行在 JsCore 或 v8 里）
  - 问题：为什么需要一个单独的线程进行 js 的运行
  - 问题：为什么不能直接通过 js 操纵 dom
  - 问题：...
- wxml 视图模板
  - 问题：微信小程序是怎么识别 wxml 的，是直接有一个可以执行 wxml 的环境还是将 wxml 转换为 html
  - 问题：为什么小程序只提供有效的标签和自定义组件的方式，而不像原生 html 有那么多丰富的标签属性
  - 问题：...
- wxss 样式文件
  - 问题： 同样，微信小程序是怎么识别 wxss 的
  - 问题：微信小程序的 rpx 单位是怎么实现的
  - 问题：...



#### 基础架构图

![小程序基础架构图](/images/img1.jpg)

- 视图层主要负责页面的渲染
- 逻辑层负责js的执行



#### 双线程模型



##### webView 视图线程

处理 wxml 和 wxss，然后显示页面。

1、通过**微信开发者工具-->调试-->调试微信开发者工具**打开，检查 Element 栏

可以发现，视图层就是一层 webview ，webview 标签中通过 src 引入了页面路径，route 定义路由

而 webview 里面其实就是一个 iframe。

![](/images/img2.png)



接下来，点击跳转：

![](./images/img29.png)

发现，里面多了一个 webview，而多出来的那个 webview 就是跳转的那个页面。而这个新的 webview 通过 z-index 实现了对第一个页面的覆盖。这就是小程序的页面栈。也是因为新打开一个页面，是通过添加一个 webview 的原因，所以小程序才有打开页面个数限制。

也是因为这个原因，可以说小程序也是 spa 单页面的。

这么做的意义：每个小程序页面 page 都是用不同的 WebView 去渲染，这样可以提供更好的交互体验，更贴近原生体验，也避免了单个 WebView 的任务过于繁重。



2、 iframe 里面封装的是一些 html 代码，通过在调试开发者工具中执行 document.getElementsByTagName('webview')[0].showDevTools(true, null)就可以打开小程序渲染层：

 ![](/images/img3.png)

- 这里面有 wx-view 这些东西，类似 web component 组件，是小程序自定义的组件。这些就是真正运行在 iframe 中的东西。而解析 wx-view 这些东西依赖于微信的基础库，关于基础库的内容下一节再详细描述



##### jscore 逻辑线程

1、 在开发者工具中输入 document 就可以看到逻辑层代码

 <img src="/images/img7.png" style="zoom:80%;" />

可以发现，这里面加载了 pages/index/index.js 和 pages/logs/logs.js 等等，也就是说，把所有 js 逻辑都放到了一个逻辑线程里面。



#### jscore 逻辑层和 webview 视图层的通讯

逻辑层和视图层之间的通讯方式并非跟 vue/react 一样直接通过两者之间传递数据和事件，而是由 native 作为中间媒介进行转发，这个过程就是一个**事件驱动模式**

- 视图层通过与用户的交互触发特定事件 event，然后将 事件 event 传递给逻辑层
- 逻辑层通过一系列的逻辑处理、数据请求，接口调用等将加工好的数据 data 传给视图层
- 视图层将数据 data 数据可视化展示



#### 小程序从架构设计层面做的性能优化

- 逻辑层、视图层分离，避免 JS 运算阻塞视图渲染
- 单独定义组件标签（wxml），减少 DOM 复杂度
- 精简样式（wxss），提升渲染性能
- 复杂组件原生化（video/map 等），解决 web 组件的功能/体验缺失



#### 双线程模型的相对于浏览器的一些优缺点

- 更加安全

  首先，如果是浏览器，如果要保证 js 代码是线程安全的，那么有一个基本的就是禁止第三方 js 操作网站 dom，这个就例如回复留言是一段 js 代码，这段 js 代码如果直接操作的网站的 dom，那么就是不安全的，有点 xss 攻击的意思。而小程序 js 线程独立，更新 ui 视图的方式与 vue/react 类似，不能直接通过 js 代码操作 dom，而是通过更新状态(setState)的方式异步更新视图。微信小程序阻止开发者使用一些浏览器提供的，诸如跳转页面、操作 DOM、动态执行脚本的开放性接口，可以防止开发者随意操作界面，更好的保证了用户数据安全。

- 更加高效

  1、正常的**浏览器渲染过程**：当打开一个网页，首先有一个主线程去下载 html，然后解析 html 文档，而 html 文档里面有 js 脚本和 css，当遇到 js脚本，那么会去加载 js，那么就会**阻塞**主线程解析 html，影响视图渲染，造成常见的白屏现象。而小程序的双线程模型，js 和 wxml、wxss **不在一个线程之中**，所以 js 的加载不会阻塞视图层的渲染。

  2、通过 setState 方式异步更新视图，会使用到 vdom 和高效的 diff 算法，能过有效减少重绘与回流。

- 缺点

  1、同时因为视图和逻辑是两个线程，视图线程没法运行 js ，逻辑线程没法直接访问到视图层的 dom，那么对于需要频繁通信的场景，性能消耗就很严重；例如拖拽，就需要频繁地进行线程通信。但是后面小程序又推出了 wxs（允许在渲染层写 js 代码）
  
  2、JS 沙箱，只提供有限的方法。



## 小程序基础库

小程序是运行在基础库之上的。



#### 基础库整体架构

小程序的基础库是 JavaScript 编写的，基础库提供组件和 API，处理数据绑定、组件系统、事件系统、通信系统等一系列框架逻辑，可以被注入到渲染层和逻辑层运行。在渲染层可以用各类组件组建界面的元素，在逻辑层可以用各类 API 来处理各种逻辑。PageView 可以是 WebView、React-Native-Like、Flutter 来渲染。

**基础库架构设计参考:  ** [基于小程序技术栈的微信客户端跨平台实践](https://ppt.geekbang.org/slide/show?cid=42&pid=2338)

![](/images/img5.png)



#### 获取基础库

可以直接在开发者工具里的 console 控制台通过 openVendor() 打开基础库文件夹；（每一个 .wxvpkg 文件对应一个基础库，微信小程序是运行在基础库之上的，才可以实现小程序代码的各种解析和各种功能）

> openVendor() 打开可能报错，切换一下基础库再试一下

 <img src="/images/img4.png" style="zoom: 80%;" />

openVender() 打开的文件夹里面有三样东西非常重要：

- xxx.wxvpkg：这种对应的就是各种版本的微信小程序基础库
- wcc：用于将 wxml 编译成对应的 js，因为要识别动态数据，然后再转换为 html
- wcsc 将 css 编译成对应的 js，因为要将 rpx 识别，然后再转换为 css



解开 .wxvpkg 包，里面是小程序基础库源码，主要两个模块。利用 [wechat-app-unpack](https://github.com/leo9960/wechat-app-unpack) 解压基础库 .wxvpkg 包

- WAWebview：小程序视图层基础库，提供视图层基础能力

- WAService：小程序逻辑层基础库，提供逻辑层基础能力

  ![](/images/img8.png)



#### 小程序的基础库主要分为

- WAWebview：小程序视图层基础库，提供视图层基础能力
- WAService：小程序逻辑层基础库，提供逻辑层基础能力



#### WAWebview 基础库源码源码

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

- Foundation：基础模块(发布订阅、通信桥梁 ready 事件)
- WeixinJSBridge：消息通信模块（js 和 native 通讯） Webview 和 Service都有相同的一套
- exparser：组件系统模块，实现了一套自定义的组件模型，比如实现了 wx-view、wx-picker-view、wx-ad 等组件
- `__virtualDOM__`：将虚拟 Dom 转换为真实 DOM；这里特别的地方在于它生成的并不是原生 DOM，而是各种模拟了 DOM 接口的 wx- element 对象
- `__webViewSDK__`：WebView SDK 模块
- Reporter：日志上报模块(异常和性能统计数据)



#### WAService 基础库源码源码

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
- WeixinJSBridge：消息通信模块(js 和 native 通讯) Webview 和 Service都有相同的一套
- WeixinNativeBuffer：原生缓冲区
- WeixinWorker：Worker 线程
- JSContext：JS Engine Context
- Protect：JS 保护的对象
- `__subContextEngine__`：提供 App、Page、Component、Behavior、getApp、getCurrentPages 等方法



#### Foundation 模块

基础模块提供环境变量 env、发布订阅 EventEmitter、配置/基础库/通信桥 Ready 事件。



#### Exparser 模块

小程序的视图是在 WebView 里渲染的，为解决管控与安全，小程序里面不能使用 Web 组件和动态执行 JavaScript。Exparser 是微信小程序的组件组织框架，内置在小程序基础库中，为小程序的各种组件提供基础的支持。小程序内的所有组件，包括内置组件和自定义组件，都由 Exparser 组织管理。Exparser 的组件模型与 WebComponents 标准中的 ShadowDOM 高度相似。**Exparser 会维护整个页面的节点树相关信息，包括节点的属性、事件绑定等**，相当于一个简化版的 Shadow DOM 实现。

小程序中，所有节点树相关的操作都依赖于 Exparser，包括 WXML 到页面最终节点树的构建、createSelectorQuery 调用和自定义组件特性等。



#### WeixinJSBridge 模块

|         方法名          |            作用             |
| :---------------------: | :-------------------------: |
|         invoke          |     JS 调用 Native API      |
|  invokeCallBackHandler  | Native 传递 invoke 方法回调 |
|           on            |     JS 监听 Native 消息     |
|         publish         |       视图层发布消息        |
|        subscribe        |      订阅逻辑层的消息       |
|    subscribeHandler     | 订阅层和逻辑层消息订阅转发  |
| setCustomPublistHandler |       自定义消息转发        |



## 小程序编译

在开发者工具里的 console 控制台通过 openVendor() 打开的文件夹，除了基础库的文件，还有两个很重要的文件 wcc.exe 和 wcsc.exe，这两个文件承担起了小程序的编译。



#### wcc：wxml 转换器

整体流程图：

 ![](/images/img12.png)

为什么需要将 wxml 转换为 js 呢？

因为  wxml 中会有动态绑定的值，例如： {{ name }}，所以需要转换成 js 文件，再转换成虚拟 DOM。



首先，通过 wcc.exe 执行以下 .wxml 文件，得到一个 js，这个就是  wcc.exe 编译 wxml 文件的结果

```
./wcc -d index.wxml >> index-wxml.js    // 将编译后的结果写入 index-wxml.js
```

 ![](/images/img9.png)



编译结果文件 index-wxml.js 中主要的就是一个 $gwx 函数

```
var $gwxc
var $gaic={}
$gwx=function(path, global){
  ...
  return root;
}
```



然后新建一个**html文件：** wxml.html，在其中引入 index-wxml.js，然后在浏览器中打开，控制台执行：

```
let res = $gwx('index.wxml')
res()
```

可以看到：

 ![](/images/img10.png)

这就是典型的虚拟 DOM 格式。



wcc 转换 wxml 的过程就是：

1. wcc 编译 wxml 文件得到一个 js 文件
2. 这个 js 文件主体是一个 $gwx() 函数，这个函数接收一个 wxml 文件路径，返回的也是一个函数，执行这个返回的函数，可以得到一个虚拟 DOM
3. 然后是 exparser 将虚拟 DOM 解析成真实 DOM 后渲染到页面



#### wcsc： wxss 转换器

 ![](/images/img13.png)

首先，通过 wcsc.exe 执行以下 .wxss 文件，得到一个 js，这个就是  wcsc.exe 编译 wxss 文件的结果

```js
./wcsc -js index.wxss >> index-wxss.js
```

 ![](/images/img11.png)



编译结果文件 index-wxss.js :

```js
// rpx 转换
var BASE_DEVICE_WIDTH = 750;
var isIOS=navigator.userAgent.match("iPhone");
var deviceWidth = window.screen.width || 375;
var deviceDPR = window.devicePixelRatio || 2;
var checkDeviceWidth = window.__checkDeviceWidth__ || function() {
var newDeviceWidth = window.screen.width || 375
var newDeviceDPR = window.devicePixelRatio || 2
var newDeviceHeight = window.screen.height || 375
if (window.screen.orientation && /^landscape/.test(window.screen.orientation.type || '')) newDeviceWidth = newDeviceHeight
if (newDeviceWidth !== deviceWidth || newDeviceDPR !== deviceDPR) {
deviceWidth = newDeviceWidth
deviceDPR = newDeviceDPR
}
}
...
var transformRPX = window.__transformRpx__ || function(number, newDeviceWidth) {}

...
// 将 css 插入标签头部
var setCssToHead = function(file, _xcInvalid, info) {
   ...
}
   
...
if ( !style )
{
var head = document.head || document.getElementsByTagName('head')[0];
// 创建 css 标签
style = document.createElement('style');
style.type = 'text/css';
style.setAttribute( "wxss:path", info.path );
head.appendChild(style);
window.__rpxRecalculatingFuncs__.push(function(size){
opt.deviceWidth = size.width;
rewritor(suffix, opt, style);
});
}
if (style.styleSheet) {
style.styleSheet.cssText = css;
} else {
if ( style.childNodes.length == 0 )
style.appendChild(document.createTextNode(css));
else
style.childNodes[0].nodeValue = css;
}
}
return rewritor;
}

setCssToHead([".",[1],"userinfo { display: flex; flex-direction: column; align-items: center; }\n.",[1],"userinfo-avatar { width: ",[0,128],"; height: ",[0,128],"; margin: ",[0,20],"; border-radius: 50%; }\n.",[1],"userinfo-nickname { color: #aaa; }\n.",[1],"usermotto { margin-top: 200px; }\n",])( typeof __wxAppSuffixCode__ == "undefined"? undefined : __wxAppSuffixCode__ );

```



wcsc 转换 wxss 的流程就是：

1. wcsc 编译 wxss 得到一个 js 文件
2. 这个 js 文件主要做的就是
   - rpx 转换
   - 创建一个 style 标签，插入到 head



## 小程序渲染流程



#### 初始化流程

**1、渲染层初始化：**

1. 微信开发者工具 ---> 调试 ---> 调试微信开发者工具 ---> document.getElementsByTagName('webview')[0].showDevTools(true, null) 打开，可以看到：

   ![](/images/img14.png)

2. 可以看到有一段：

   ```js
   var decodeName = decodeURI("./pages/index/index.wxml");
   var generateFunc = $gwx(decodeName);
   if (generateFunc) {
       var CE = (typeof __global === 'object') ? (window.CustomEvent || __global.CustomEvent) : window.CustomEvent;
       document.dispatchEvent(new CE("generateFuncReady", {
           detail: {
               generateFunc: generateFunc
           }
       })) __global.timing.addPoint('PAGEFRAME_GENERATE_FUNC_READY', Date.now())
   } else {
       document.body.innerText = decodeName + " not found"console.error(decodeName + " not found")
   };
   ```

   - `var generateFunc = $gwx(decodeName)` 创建了一个生成虚拟 dom 的函数
   - `var CE = window.CustomEvent`  window.CustomEvent 作用：创建自定义事件，js 中自定义事件的方法
   - `document.dispatchEvent` 播报一个自定义事件

3. 然后在 WAWebview.js 中 监听这个自定义事件，并且通过 WeixinJSBridge.publish 通知 js 逻辑层当前视图已经准备好

   ```js
   c = function() {
      setTimeout(function() {
           ! function() {
             var e = arguments;
             r(function() {
               WeixinJSBridge.publish.apply(WeixinJSBridge, o(e))
             })
         }("GenerateFuncReady", {})
      }, 20)
   }
   document.addEventListener("generateFuncReady", c)
   ```



**2、逻辑层初始化**

> 渲染层与逻辑层初始化是同时进行的，这就是双线程的好处之一

1. \_\_subContextEngine\_\_ 初始化 App、Page 实例等

2. 加载所有页面的 js

    <img src="./images/img30.png" style="zoom: 50%;" />



逻辑层初始化完成之后，并且收到渲染层发出的视图准备好的通知，执行下面步骤：

1. 逻辑层进入到对应页面的生命周期，执行生命周期函数处理逻辑，然后 setData，并通过 WeixinJsBridge 通知并返回数据给视图层。

2. 视图层接收到数据，将数据传入生成虚拟 dom 的函数 generateFunc 内, 这就实现了动态数据，然后通过基础库的 `__virtualDOM__` 将虚拟 DOM 转换为真实 DOM（小程序也有相应的 diff 算法），然后衔接 exparser 组件系统，最后渲染页面。

3. 初始化完成后，就会走对应的其他生命周期，或者用户在渲染线程触发事件，那么会1将时间名称以及页面 id 发送给 js 逻辑线程，那么逻辑线程根据页面 id 及时间名称找到对应事件，处理数据，处理完成后通过 WeixinJsBridge 通知视图层，视图层再次调用生成虚拟 dom 的函数，更新页面



下面是一幅生命周期图：

 <img src="/images/img6.png" style="zoom: 67%;" />



#### 整体流程

补充一张整体流程图

![](./images/img27.png)




## 小程序框架

原生小程序开发存在的问题：

- 原生使用的是 WXML、WXSS 这类语法，需要一定的学习成本
- 对 npm 包支持不友好，那么就意味着不可使用 less、ts 等
- 没有工程化，难以做到自定义代码压缩、tree shaking 等
- 现在小程序生态过于繁杂，有微信、阿里、头条等多个平台，每个平台语法还不太一致



#### 小程序框架分类

一般来讲，可以从两个维度对目前的小程序框架进行分类：

1. 从语法来分类，一般是类 vue 小程序框架和类 react 小程序框架

2. 从实现原理来分，一般有编译时、半编译半运行时、运行时 这几种
   -  编译时的框架，主要的工作量在编译阶段。他们框架约定了一套自己的 `DSL` ，在编译打包的过程中，利用 babel 工具通过 AST 进行转译，生成符合小程序规则的代码；这种需要在规定的范围内开发，比如需要遵循规定的框架语法，开发限制过多，不够灵活。但其好处是大部分工作在编译的时候做好，性能相对高。
   - 运行时的框架真正的在小程序的逻辑层中运行起来 React 或者是 Vue 的运行时，然后通过适配层，实现自定义渲染器



#### 预编译型框架

目前比较流行的预编译型框架是

1. wepy
2. Taro1.x/Taro2.x(严格来讲，Taro1.x/Taro2.x 也有运行时，但是它重编译，轻运行，大部分功能是在编译阶段完成，所以可以看成是编译时)

##### wepy

这个就是单纯的编译时框架，它有自己的一套`DSL`，在编译打包过程，将 wepy 编译成小程序可执行的代码。

 ![](/images/img16.png)

具体就是：

- wepy 拆解成 style、script、template
- 通过编译，生成小程序的 wxml、wxss、js、json 文件
- 然后处理加强功能的插件，最后生成完整功能的可被小程序识别的代码



##### Taro1.x/Taro2.x



#### 编译时+运行时

目前主流的编译时+运行时框架是 mpvue、uni-app 还有 megalo，这些都是类 vue 框架，其实小程序的编译时+运行时框架主要以类 vue 为主，而这些类 vue 框架的原理都相似



##### 类 vue 小程序框架

类 vue 的跨端框架核心原理都差不多，都是把 Vue 框架拿过来强行的改了一波，借助了 vue 的能力。比如说，vue 的编译打包流程（也就是 vue-loader 的能力）, vue 的响应式双向绑定、虚拟 dom、diff 算法。上面这些东西跨端框架都没有修改，直接拿来用的。而修改的东西是把原本 vue 框架中原生 javascript 操作 DOM 的方法，替换成小程序平台的 setState。然后还有各家平台的内部做的优化。



##### vue ---> 小程序

从 vue 文件转换到小程序（Vue 文件主要是单文件，三段式结构），这些类 vue 框架主要就是将 vue 文件的三大块 `template`、`script`、`style` 拆出来，分别编译，转换成小程序的 `wxml`、`wxss`、`js`、`json`

 ![](/images/img17.png)

<img src="/images/img18.png" style="zoom: 50%;" />



- style ---> wxss: 正常情况下，css 样式大部分可以直接挪到 wxss 文件，但是需要去除有些小程序不支持的还有小程序 `rpx` 单位转换

- template ---> wxml: 需要进行模板替换，把 h5 的标签还有 vue 语法转换成小程序的标签和语法

   vue 使用的 template 和小程序的 template 基本上相似，但也有不同，不同的地方就需要转换

   ![](/images/img19.png)

  而模板的转化主要使用了 `ast` 来解析转化模板，实际上就是两侧对齐语法的过程，把语法不一致的地方改成一样的，是一个 case by case 的过程，只要匹配到不同情况下语法即可:

  <img src="/images/img20.png" style="zoom: 67%;" />



- script ---> js

  要将 vue 的 script 移到小程序的 js 文件中，其实只要引入 vue.js 即可。如下 vue 初始化代码：

  ```js
  new Vue({
    data(){},
    methods: {},
    components: {}  
  })
  ```

  在引入 vue.js 后，上面代码完全可以在小程序里面执行，因为 vue 代码本身大部分就是 js，小程序的渲染层里面是完全可以直接运行起来 Vue 运行时的；但是小程序有一个主要的问题，就是：小程序平台还规定，要在小程序页面中调用 `Page()` 方法生成一个 `page` 实例， `Page()` 方法是小程序官方提供的 API。

  在一个小程序页面中，必须要有一个 `Page()` 方法。微信小程序会在进入一个页面时，扫描该页面中的 `.js` 文件，如果没有调用 `Page()` 这个方法，页面会报错。

  而这些类 vue 框架的普遍做法是将 vue 源码拷贝一份，然后拓展 vue 框架，修改 vue 的初始化方法，在其中调用 `Page()`

  ```js
  // 初始化 vue 时调用 Page() 方法
  Vue.init = () => {
    ...
    Page()
  }
  new Vue()
  ```

  这样子，在 new Vue() 时就会调用 Page()，生成一个小程序的 Page() 实例；因此，在一个小程序页面，就存在一个小程序 Page 实例和 Vue 实例。然后就是两个实例之间进行融合、数据管理、通信等。



##### 类 vue 小程序核心

核心流程图：

<img src="/images/img21.png" style="zoom:80%;" />

由图可以看出，这种类 vue 小程序框架，整体上和 vue 类似，只是将 vue 运行时 copy 了一份，然后改造。

在小程序中，隔离了逻辑线程和视图线程，因此，并不能直接操作 dom，所以就在 patch 之后，不再去直接操作 dom，而是改由小程序提供的 setData 去更新视图。



使用 vue 中 diff 的好处：

```vue
<template>
  <div>{{ name }}</div>
</template>

<script>
export default {
  data() {
    returrn {
      name: 'jack',
        age: 20
    }
  },
  methods: {
    setAge() {
      this.age = 30
    }
  }
}
</script>
```

在模板编译的时候，就知道需要使用的是 name 这个变量，而没有使用到 age。那么在后面就算触发了 setAge 事件，也不会进行小程序的 setData，这就提高了 setData 的性能。



**Vue 实例和小程序 Page 实例的分工协同: 通过 runtime 运行时串联**

 ![](/images/img22.png)

首先，在页面初始化的时候，先实例化一个 Vue；然后在 Vue.init 中调用小程序的 Page() 生成小程序 page 实例；后在 Vue 的 moutend 中把数据同步到小程序的 page 实例上。所以，实际上会同时存在 vue 实例和小程序的 page 实例，并且在 Vue 的 moutend 中同步之后，两个实例的初始数据就会一致。

然后，在 vue 中数据发生变化，会进行下列流程：

1. 先触发 vue 响应式
2. 接着重新执行 render 生成一份新的 vnode
3. 然后去 diff 两份新旧 vnode，得出修改 dom 的最优解
4. 最后调用 setData 方法修改小程序实例的数据，触发小程序视图层重新渲染

总结：

- **数据是归 Vue 管：**Vue 数据变更后，通过框架的 `runtime` 运行时来做中间桥接，把数据同步到小程序中。
- **事件及渲染由小程序管：**用户在小程序触发各种事件，比如说滚动，事件点击，先触发小程序事件函数，接着通过框架 `runtime` 运行时代理机制，触发 vue 中的函数，将逻辑处理收敛在 vue 中。
- **小程序生命周期纳入到 vue 生命周期**



##### mpvue

在 mpvue 观望中

mpvue 是一个典型的编译时 + 运行时的类 vue 小程序框架。看看 mpvue 官方的说明：

<img src="./images/img31.png" style="zoom:80%;" />

下面来简单分析 mpvue 源码，了解 mpvue 的编译跟运行时层面分别做了什么。



 <img src="./images/img32.png" style="zoom:80%;" />

可以看到，首先是 fork 了一分 vue 的 runtime 代码，然后在平台判断里面添加多了一个 mp 平台。mp 里面主要就是两个文件夹，一个是 compiler 代表编译，runtime 代表运行时。



**编译阶段：**

> mpvue\src\platforms\mp\compiler\index.js

 <img src="./images/img33.png" style="zoom: 50%;" />

判断是什么平台的小程序，现在基本支持微信、百度、阿里等



> mpvue\src\platforms\mp\compiler\wx\config\astMap.js

 <img src="./images/img34.png" style="zoom: 50%;" />

一些 vue 与小程序的指令映射，当然，不止这一点，还有相关事件、attr 属性等的映射，具体可以查看 `mpvue\src\platforms\mp\compiler\wx` 这个目录下的代码



除了上面哪些特定平台的指令，还有一些通用便签的：

> mpvue\src\platforms\mp\compiler\common\tagMap.js

```js
// 与小程序标签进行映射
export default {
  'br': 'view',
  'hr': 'view',

  'p': 'view',
  'h1': 'view',
  'h2': 'view',
  'h3': 'view',
  'h4': 'view',
  'h5': 'view',
  'h6': 'view',
  'abbr': 'view',
  'address': 'view',
  'b': 'view',
  'bdi': 'view',
  'bdo': 'view',
  'blockquote': 'view',
  'cite': 'view',
  'code': 'view',
  'del': 'view',
  'ins': 'view',
  'dfn': 'view',
  'em': 'view',
  'strong': 'view',
  'samp': 'view',
  'kbd': 'view',
  'var': 'view',
  'i': 'view',
  'mark': 'view',
  'pre': 'view',
  'q': 'view',
  'ruby': 'view',
  'rp': 'view',
  'rt': 'view',
  's': 'view',
  'small': 'view',
  'sub': 'view',
  'sup': 'view',
  'time': 'view',
  'u': 'view',
  'wbr': 'view',

  // 表单元素
  'form': 'form',
  'input': 'input',
  'textarea': 'textarea',
  'button': 'button',
  'select': 'picker',
  'option': 'view',
  'optgroup': 'view',
  'label': 'label',
  'fieldset': 'view',
  'datalist': 'picker',
  'legend': 'view',
  'output': 'view',

  // 框架
  'iframe': 'view',
  // 图像
  'img': 'image',
  'canvas': 'canvas',
  'figure': 'view',
  'figcaption': 'view',

  // 音视频
  'audio': 'audio',
  'source': 'audio',
  'video': 'video',
  'track': 'video',
  // 链接
  'a': 'navigator',
  'nav': 'view',
  'link': 'navigator',
  // 列表
  'ul': 'view',
  'ol': 'view',
  'li': 'view',
  'dl': 'view',
  'dt': 'view',
  'dd': 'view',
  'menu': 'view',
  'command': 'view',

  // 表格table
  'table': 'view',
  'caption': 'view',
  'th': 'view',
  'td': 'view',
  'tr': 'view',
  'thead': 'view',
  'tbody': 'view',
  'tfoot': 'view',
  'col': 'view',
  'colgroup': 'view',

  // 样式
  'div': 'view',
  'main': 'view',
  'span': 'label',
  'header': 'view',
  'footer': 'view',
  'section': 'view',
  'article': 'view',
  'aside': 'view',
  'details': 'view',
  'dialog': 'view',
  'summary': 'view',

  'progress': 'progress',
  'meter': 'progress',
  'head': 'view',
  'meta': 'view',
  'base': 'text',
  'area': 'navigator',

  'script': 'view',
  'noscript': 'view',
  'embed': 'view',
  'object': 'view',
  'param': 'view',

  // https://mp.weixin.qq.com/debug/wxadoc/dev/component/
  // [...document.querySelectorAll('.markdown-section tbody td:first-child')].map(v => v.textContent).join(',\n')
  'view': 'view',
  'scroll-view': 'scroll-view',
  'swiper': 'swiper',
  'icon': 'icon',
  'text': 'text',
  'checkbox': 'checkbox',
  'radio': 'radio',
  'picker': 'picker',
  'picker-view': 'picker-view',
  'slider': 'slider',
  'switch': 'switch',
  'navigator': 'navigator',
  'image': 'image',
  'map': 'map',
  'contact-button': 'contact-button',
  'block': 'block'
}
```



通过这些映射关系，那么在编译的时候，就可以进行转换了。



**运行时阶段：**

先来看运行时的入口文件

> mpvue\src\platforms\mp\runtime\index.js

 <img src="./images/img35.png" style="zoom:50%;" />

往 Vue 身上挂载了一些方法：

- initMP：初始化小程序一些事件：onLaunch、onLoad、onReady
- updateDataToMP：调用 setData 通知小程序进行更新



> mpvue\src\platforms\mp\runtime\index.js

 <img src="./images/img36.png" style="zoom:50%;" />

可以看到，重写了 Vue 的 $mount 方法，在 mount 的时候调用 initMP 进行小程序初始化事件



那么什么时候初始化小程序的 App、Page 这些实例？答案在 createMP 里

> mpvue\src\platforms\mp\runtime\lifecycle.js

```js
export function createMP ({ mpType, init }) {
  if (!mpType) mpType = 'page'
  if (mpType === 'app') {
    global.App({
      // 页面的初始数据
      globalData: {
        appOptions: {}
      },

      handleProxy (e) {
        return this.rootVueVM.$handleProxyWithVue(e)
      },

      // Do something initial when launch.
      onLaunch (options = {}) {
        if (!this.rootVueVM) {
          this.rootVueVM = init()
          this.rootVueVM.$mp = {}
        }
        const mp = this.rootVueVM.$mp
        mp.mpType = 'app'
        mp.app = this
        mp.status = 'launch'
        this.globalData.appOptions = mp.appOptions = options
        this.rootVueVM.$mount()
      },

      // Do something when app show.
      onShow (options = {}) {
        // 百度小程序onLaunch与onShow存在bug
        // 如果this.rootVueVM不存在则初始化
        if (!this.rootVueVM) {
          this.rootVueVM = init()
          this.rootVueVM.$mp = {}
        }
        const mp = this.rootVueVM.$mp
        mp.status = 'show'
        this.globalData.appOptions = mp.appOptions = options
        callHook(this.rootVueVM, 'onShow', options)
      },

      // Do something when app hide.
      onHide () {
        const mp = this.rootVueVM.$mp
        mp.status = 'hide'
        callHook(this.rootVueVM, 'onHide')
      },

      onError (err) {
        callHook(this.rootVueVM, 'onError', err)
      },

      onPageNotFound (err) {
        callHook(this.rootVueVM, 'onPageNotFound', err)
      }
    })
  }
  if (mpType === 'page') {
    const app = global.getApp()
    global.Page({
      // 页面的初始数据
      data: {
        $root: {}
      },

      handleProxy (e) {
        return this.rootVueVM.$handleProxyWithVue(e)
      },

      // mp lifecycle for vue
      // 生命周期函数--监听页面加载
      onLoad (query) {
        this.rootVueVM = init()
        const mp = this.rootVueVM.$mp = {}
        mp.mpType = 'page'
        mp.page = this
        mp.query = query
        mp.status = 'load'
        getGlobalData(app, this.rootVueVM)
        this.rootVueVM.$mount()
      },

      // 生命周期函数--监听页面显示
      onShow () {
        const mp = this.rootVueVM.$mp
        mp.page = this
        mp.status = 'show'
        callHook(this.rootVueVM, 'onShow')
        // 只有页面需要 setData
        this.rootVueVM.$nextTick(() => {
          this.rootVueVM._initDataToMP()
        })
      },

      // 生命周期函数--监听页面初次渲染完成
      onReady () {
        const mp = this.rootVueVM.$mp
        mp.status = 'ready'
        return _next(this.rootVueVM)
      },

      // 生命周期函数--监听页面隐藏
      onHide () {
        const mp = this.rootVueVM.$mp
        mp.status = 'hide'
        callHook(this.rootVueVM, 'onHide')
        mp.page = null
      },

      // 生命周期函数--监听页面卸载
      onUnload () {
        const mp = this.rootVueVM.$mp
        mp.status = 'unload'
        callHook(this.rootVueVM, 'onUnload')
        mp.page = null
      },

      // 页面相关事件处理函数--监听用户下拉动作
      onPullDownRefresh () {
        callHook(this.rootVueVM, 'onPullDownRefresh')
      },

      // 页面上拉触底事件的处理函数
      onReachBottom () {
        callHook(this.rootVueVM, 'onReachBottom')
      },

      // 用户点击右上角分享
      onShareAppMessage (options) {
        if (this.rootVueVM.$options.onShareAppMessage) {
          callHook(this.rootVueVM, 'onShareAppMessage', options)
        }
      },

      // Do something when page scroll
      onPageScroll (options) {
        callHook(this.rootVueVM, 'onPageScroll', options)
      },

      // 当前是 tab 页时，点击 tab 时触发
      onTabItemTap (options) {
        callHook(this.rootVueVM, 'onTabItemTap', options)
      }
    })
  }
  if (mpType === 'component') {
    global.Component({
      // 小程序原生的组件属性
      properties: {},
      // 页面的初始数据
      data: {
        $root: {}
      },
      methods: {
        handleProxy (e) {
          return this.rootVueVM.$handleProxyWithVue(e)
        }
      },
      // mp lifecycle for vue
      // 组件生命周期函数，在组件实例进入页面节点树时执行，注意此时不能调用 setData
      created () {
        this.rootVueVM = init()
        initMpProps(this.rootVueVM)
        this.properties = normalizeProperties(this.rootVueVM)
        const mp = this.rootVueVM.$mp = {}
        mp.mpType = 'component'
        mp.status = 'created'
        mp.page = this
        this.rootVueVM.$mount()
        callHook(this.rootVueVM, 'created')
      },
      // 组件生命周期函数，在组件实例进入页面节点树时执行
      attached () {
        const mp = this.rootVueVM.$mp
        mp.status = 'attached'
        callHook(this.rootVueVM, 'attached')
      },
      // 组件生命周期函数，在组件布局完成后执行，此时可以获取节点信息（使用 SelectorQuery ）
      ready () {
        const mp = this.rootVueVM.$mp
        mp.status = 'ready'
        callHook(this.rootVueVM, 'ready')
        _next(this.rootVueVM)

        // 只有页面需要 setData
        this.rootVueVM.$nextTick(() => {
          this.rootVueVM._initDataToMP()
        })
      },
      // 组件生命周期函数，在组件实例被移动到节点树另一个位置时执行
      moved () {
        callHook(this.rootVueVM, 'moved')
      },
      // 组件生命周期函数，在组件实例被从页面节点树移除时执行
      detached () {
        const mp = this.rootVueVM.$mp
        mp.status = 'detached'
        callHook(this.rootVueVM, 'detached')
      }
    })
  }
}
```

可以看到，在这里，会判断是 Page 还是 App，分别初始化。



最后就是数据发生变化，怎么去 setData 了

> mpvue\src\platforms\mp\runtime\patch.js

```js
// patch ，最后没有去操作 dom，而是调用了 $updateDataToMP 去 setData
export function patch () {
  // 先执行 corePatch【就是 createPatchFunction 的返回值 patch 函数】
  // 也就是执行 patch
  corePatch.apply(this, arguments)
  // 再执行 updateDataToMP 去 setData
  this.$updateDataToMP()
}
```



> mpvue\src\platforms\mp\runtime\render.js

```js
// 优化js变量动态变化时候引起全量更新
// 优化每次 setData 都传递大量新数据
export function updateDataToMP () {
  const page = getPage(this)
  if (!page) {
    return
  }

  // 用来存储需要更新的数据
  const data = {}
  // 比较 data、props 数据
  diffData(this, data)
  // 添加防抖，防止频繁更新
  throttleSetData(page.setData.bind(page), data)
}
```



> mpvue\src\platforms\mp\runtime\diff-data.js

```js
export function diffData (vm, data) {
  const vmData = vm._data || {}
  const vmProps = vm._props || {}

  // ...

  if (vm._mpValueSet === 'done') {
    // 第二次赋值才进行缩减操作
    Object.keys(vmData).forEach((vmDataItemKey) => {
      if (vmData[vmDataItemKey] instanceof Object) {
        // 引用类型
        minifyDeepData(rootKey, vmDataItemKey, vmData[vmDataItemKey], data, vm._mpValueSet, vm)
      } else if (vmData[vmDataItemKey] !== undefined) {
        // _data上的值属性只有要更新的时候才赋值
        if (__keyPathOnThis[vmDataItemKey] === true) {
          data[rootKey + '.' + vmDataItemKey] = vmData[vmDataItemKey]
        }
      }
    })

    Object.keys(vmProps).forEach((vmPropsItemKey) => {
      if (vmProps[vmPropsItemKey] instanceof Object) {
        // 引用类型
        minifyDeepData(rootKey, vmPropsItemKey, vmProps[vmPropsItemKey], data, vm._mpValueSet, vm)
      } else if (vmProps[vmPropsItemKey] !== undefined) {
        data[rootKey + '.' + vmPropsItemKey] = vmProps[vmPropsItemKey]
      }
      // _props上的值属性只有要更新的时候才赋值
    })
    
    // ...
}
```

就是将 data、props 中需要更新的数据拿出来，放到 data = {} 中



> mpvue\src\platforms\mp\runtime\render.js

```js
throttleSetData(page.setData.bind(page), data)
```

最后，setData，加了防抖，防止频繁 setData



到此，mpvue 的编译、运行时的大概脉络已经出来了。跟上面说的类 vue 小程序原理基本是一样的。



##### uni-app

uni-app 是一个典型的编译时 + 运行时的类 vue 小程序框架，这就意味着跟上面说的类 vue 小程序框架基本保持一致，不同的是 uni-app 内部做的优化。

**uni-app 内部优化策略：**

- **renderjs 解决通讯阻塞**(wxs 解决小程序频繁通信问题)

  如图，如果需要将 A 模块拖拽到 B，要想在小程序中实现路畅的跟手滑动是很困难的，因为小程序视图层和逻辑层分离，视图层不能运行 js，逻辑层没法直接操作 dom，只能通过线程通信，而线程通信成本是很高的

   ![](/images/img24.png)

  一次 touchmove，小程序内部响应过程：

  - 首先是触发 webview 的 touchmove 事件，经过 native 中间层通知逻辑层，即1、2

  - 逻辑层计算好需要移动的位置，通过 setData 和 native 中间层通知视图层，即3、4

     ![](/images/img25.png)

  而在 touchmove 过程中，会出现频繁的通信，每一次通信都需要四个步骤，这频繁通信带来的时间成本很可能会造成视图没办法在 16.7 毫秒内完成绘制，就会造成页面抖动或者卡顿。

  除了拖拽交互，还有滚动、在 for 循环里对数据做格式修改，也会造成逻辑层和视图层频繁通讯。

  其实，对于小程序来讲，webview 是有 js 环境的，但是不开放给开发者而已。大量开放 webview 里的 js 编写，开发者会直接操作 dom，影响性能体验和宿主微信的安全。所以小程序平台提出一种新规范，可以在 webview 里使用 js 操作 dom，这就是 wxs。本质上，wxs 其实可以认为是被限制过的运行在 webview 环境里面的 js。

  **wxs 有如下特征：**

  - WXS 是被限制过的 JavaScript，可以进行一些简单的逻辑运算
  - WXS 的运行环境和其他 JavaScript 代码是隔离的，WXS 中不能调用其他 JavaScript 文件中定义的函数，也不能调用小程序提供的 API
  
  - WXS 可以监听 touch 事件，处理滚动、拖动交
  
  **uni-app 对 wxs 的支持：**
  
  ```js
    // 在里面写 wxs 即可
    <script module="swipe" lang="wxs"></script>
  ```




- **改造 vue，移除 vnode**(vue 瘦身：提升运行性能和加载性能)

  根据 uni-app 的运行时原理，可以得知，vue 实例负责数据管理，小程序 page 实例负责视图渲染，页面 dom 由小程序负责生成，小程序实例只接受 data 数据。而 vue 维护的 vnode 无法和小程序的真实 dom 对应，也就是说 vue 的 vnode 在小程序端没用，可以移除。

  所以，对应 uni-app 改造的 vue 在三方面做了优化

  - compiler：取消 optimize 步骤，因为这一步是为了标记静态节点，而 uni-app 中的 vue 只负责数据，不需要关注 dom 节点

  - render： 不生成 vnode

  - patch：不对比 vnode，只比对 data，因为 setData 只能传递数据

    ![](/images/img26.png)
    
    >  改造后的 vue 源码，vue runtime 大小减少了 1/3 左右，同时提升了小程序的运行性能和加载性能。
    

  

- **减少 setData 调用次数**(Vue.nextTick)

  对于以下代码：

  ```js
  handleChange: () => {
      this.a = 1;
      this.b = 2;
      this.c = 3;
      ...
  }
  ```

  uni-app 运行时会自动合并成 {"a": 1, "b": 2, "c": 3}，只调用一次 setData 传递数据，减少 setData 的调用。

  

- **数据差量更新**(diff data：减少 setData 传递数据量)

  场景：上拉加载，页面初始有 3 条数据，上拉加载后需要追加 3 条。

  ```js
  page({
      data: {
          list: ['item1', 'item2', 'item3']
      },
      handleLoad() => {
          let newList = ['item4', 'item5', 'item6'];
          this.data.list.push(...newList);
          this.setData({
              list: this.data.list
          });
      }
  })
  ```

  如果像上面那样，setData 会把 item1~item6 六条数据全量传递，而实际只是追加了 item4~item6 三条

  一般这种场景，需要开发者手动进行差量更新：

  ```js
  page({
      data: {
          list: ['item1', 'item2', 'item3']
      },
      handleLoad() => {
          let idx = this.data.list.length;
          let newList = ['item4', 'item5', 'item6'];
          let newObj = {};
          newList.forEach(item => {
             newObj[`list[${idx++}]`] = item; 
          });
          this.setData(newObj);
      }
  })
  
  // 实际上传递的
  this.setData({
      list[3]: 'item3',
      list[4]: 'item4'
  })
  ```

  这样差量更新更多的是依赖于开发者的意识，并不能很好地控制叫程序上拉加载的性能。因此 uni-app 借鉴 `westore-json-diff` ，在 setData 之前，**先对比数据，找出需要差量更新的数据**，在通过 setData 传递；这样就可以放心使用：

  ```js
  export default {
      data() {
          return {
              list: ['item1', 'item2', 'item3']
          }
      },
      methods: {
          handleLoad() => {
              let newList = ['item4', 'item5', 'item6'];
              this.data.list.push(...newList);
          }
      }
  }
  ```

  

- **组件差量更新**(自定义组件：减少 data diff 范围)

  场景：一个列表页，列表的每一项都有一个收藏按钮，如果当前列表页有几百条数据，那么点击某一条的收藏按钮，那么会进行 data diff 差量更新，比较的范围过大。

  而 uni-app 的自定义组件方式，把每一条微博抽成一个组件，那么就会在当前组件内进行 data diff。




#### 运行时



## CI 持续集成

源码托管可以在 gitlab 等代码仓库，但是小程序的代码是部署到微信的服务器，目前唯一可用的部署工具是官方提供的 [miniprogram-ci](https://developers.weixin.qq.com/miniprogram/dev/devtools/ci.html)。

[TODO]完善文档

