/* @flow */

import * as nodeOps from './node-ops'
import { createPatchFunction } from 'core/vdom/patch'
// import baseModules from 'core/vdom/modules/index'
import ref from 'core/vdom/modules/ref'
// const platformModules = []
// import platformModules from 'web/runtime/modules/index'

// the directive module should be applied last, after all
// built-in modules have been applied.
// const modules = platformModules.concat(baseModules)
const modules = [ref]

// 得到 patch 函数
export const corePatch: Function = createPatchFunction({ nodeOps, modules })

// patch ，最后没有去操作 dom，而是调用了 $updateDataToMP 去 setData
export function patch () {
  // 先执行 corePatch【就是 createPatchFunction 的返回值 patch 函数】
  // 也就是执行 patch
  corePatch.apply(this, arguments)
  // 再执行 updateDataToMP 去 setData
  this.$updateDataToMP()
}
