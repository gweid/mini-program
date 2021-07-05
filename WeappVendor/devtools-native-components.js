const params = (new URL(document.location)).searchParams
const name = params.get('name')

const videoComponent = {
  init() {
    this.videoPlayerId = params.get('videoPlayerId')

    const dom = this.dom = exparser.createElement('wx-video')
    dom.$$.setAttribute('style', 'height:100%;width:100%;')

    const hiddenVideoCenterBtnStyle = document.createElement('style')
    hiddenVideoCenterBtnStyle.innerHTML = `
      wx-video .wx-video-cover {
        display: none;
      }
    `
    this.hiddenVideoCenterBtnStyle = hiddenVideoCenterBtnStyle

    this.setData(JSON.parse(params.get('data')))
    parent.appendChild(dom)

    this.bindEvent()
  },
  setData(data) {
    this.data = data
    if (!data.showCenterPlayBtn) {
      this.hideCenterPlayBtn()
    } else {
      this.showCenterPlayBtn()
    }
    for (let key in data) {
      this.dom[key] = data[key]
    }
  },
  hideCenterPlayBtn() {
    const el = this.hiddenVideoCenterBtnStyle
    if (!el.parentElement) {
      document.body.appendChild(el)
    }
  },
  showCenterPlayBtn() {
    this.hiddenVideoCenterBtnStyle.remove()
  },
  bindEvent() {
    const { dom } = this

    WeixinJSBridge.on('operateNativeView', data => this.actionChanged(data))
    WeixinJSBridge.on('updateNativeView', data => this.setData(data))

    dom.addListener('play', e => {
      e._hasListeners = true;
      WeixinJSBridge.publish('onNativeViewEvent', {
        eventName: 'onVideoPlay',
        data: {
          timeStamp: e.timeStamp,
          videoPlayerId: this.videoPlayerId,
          data: this.data.data || ''
        }
      })
    }, { capture: false });

    dom.addListener('pause', e => {
      e._hasListeners = true;
      WeixinJSBridge.publish('onNativeViewEvent', {
        eventName: 'onVideoPause',
        data: {
          videoPlayerId: this.videoPlayerId,
          data: this.data.data || ''
        }
      })
    })

    dom.addListener('ended', e => {
      e._hasListeners = true;
      WeixinJSBridge.publish('onNativeViewEvent', {
        eventName: 'onVideoEnded',
        data: {
          videoPlayerId: this.videoPlayerId,
          data: this.data.data || ''
        }
      })
    })

    dom.addListener('timeupdate', e => {
      e._hasListeners = true;
      WeixinJSBridge.publish('onNativeViewEvent', {
        eventName: 'onVideoTimeUpdate',
        data: {
          position: e.detail.currentTime,
          duration: e.detail.duration,
          videoPlayerId: this.videoPlayerId,
          data: this.data.data || ''
        }
      })
    })

    dom.addListener('progress', e => {
      e._hasListeners = true;

      if (e.detail.buffered > 0) {
        // 大于0才有意义
        let buffered = e.detail.buffered
        if (buffered && !Number.isInteger(buffered)) {
          buffered = buffered.toFixed(3)
        }

        WeixinJSBridge.publish('onNativeViewEvent', {
          eventName: 'onVideoProgress',
          data: {
            duration: dom._lastDuration,
            buffered,
            videoPlayerId: this.videoPlayerId,
            data: this.data.data || ''
          }
        })
      }
    })

    dom.addListener('fullscreenchange', e => {
      e._hasListeners = true;
      WeixinJSBridge.publish('onNativeViewEvent', {
        eventName: 'onVideoFullScreenChange',
        data: {
          fullScreen: e.detail.fullScreen,
          direction: dom.direction,
          videoPlayerId: this.videoPlayerId,
          data: this.data.data || ''
        }
      })
    })

    let forcePaused = false
    WeixinJSBridge.on('onAppEnterBackground', () => {
      if (!dom.paused) {
        this.actionChanged({
          method: 'pause'
        })
        forcePaused = true
      }
    })

    WeixinJSBridge.on('onAppEnterForeground', () => {
      if (forcePaused) {
        this.actionChanged({
          method: 'play'
        })
        forcePaused = false
      }
    })
  },
  actionChanged(data) {
    const { dom } = this
    // 兼容旧版本基础库
    if (dom.actionChanged) return dom.actionChanged(data)
    dom._actionChanged(data)
  }
}

const container = document.getElementById('container')
const parent = exparser.createElement('div')
parent.setAttribute('style', 'height:100%;')
exparser.Element.replaceDocumentElement(parent, container)

switch (name) {
  case 'video':
    videoComponent.init();
    break;
}
