import Routes from './routes'
import Navigator from './navigator'
import NavComponent from './components/Navigation'
import { genKey, isObjEqual } from './utils'

export default {
  // install 钩子函数
  install: (Vue, { router, store, moduleName = 'navigation', keyName = 'VNK' } = {}) => {
    if (!router) {
      console.error('vue-navigation need options: router')
      return
    }
    // 定义一个微型的事件总线
    const bus = new Vue()
    /** 
     * 动态注册一个 vuex 模块
     * - 1 提供路由变化的mutation函数，将路由信息记录在Vuex和数组中，并通过事件总线 bus 触发对应的监听事件。
     * */ 
    const navigator = Navigator(bus, store, moduleName, keyName)

    // 劫持 vue-router 的 replace 方法 hack vue-router replace for replaceFlag
    // 保持this指向
    const routerReplace = router.replace.bind(router) 
    // 用于记录是否调用的了 router.replace 方法
    let replaceFlag = false
    router.replace = (location, onComplete, onAbort) => {
      replaceFlag = true
      routerReplace(location, onComplete, onAbort)
    }

    // init router`s keyName 在router上监听路由变化事件。
    router.beforeEach((to, from, next) => {
      // 如果路由参数中有VNK标识，则直接next；否则生成并标识并next
      if (!to.query[keyName]) {
        const query = { ...to.query }
        // go to the same route will be set the same key
        if (to.path === from.path && isObjEqual(
          { ...to.query, [keyName]: null },
          { ...from.query, [keyName]: null },
        ) && from.query[keyName]) {
          query[keyName] = from.query[keyName]
        } else {
          // 如果from与to的路由不一致，就重新生成VNK路由标识
          query[keyName] = genKey()
        }
        // replace有两种情况，初始访问链接没有VNK标识，或就是调用了replace方法。(这是RawLocation中的参数，在路由next中传入参数)
        next({ name: to.name, params: to.params, query, replace: replaceFlag || !from.query[keyName] })
      } else {
        next()
      }
    })

    // record router change
    // 在afterEach中获取到路由标识之后统一进行记录 到 vuex中或数组中。
    router.afterEach((to, from) => {
      navigator.record(to, from, replaceFlag)
      replaceFlag = false
    })

    // TODO:: 注册一个 Vue 组件 待研究其实现，实现的是页面的缓存
    Vue.component('navigation', NavComponent(keyName))
    // 将事件总线上的方法挂载到VUe上，便捷触发监听的事件
    Vue.navigation = Vue.prototype.$navigation = {
      // 暴露同名 on 方法
      on: (event, callback) => {
        // Vue 上的自带的 $on 方法，当Vue对象中通过$emit()触发事件时，此处监听事件的回调会被触发。
        bus.$on(event, callback)
      },
      once: (event, callback) => {
        bus.$once(event, callback)
      },
      off: (event, callback) => {
        bus.$off(event, callback)
      },
      getRoutes: () => Routes.slice(),
      cleanRoutes: () => navigator.reset()
    }
  }
}
