var app = (function () {
    'use strict';

    function noop() { }
    function assign(tar, src) {
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function create_slot(definition, ctx, fn) {
        if (definition) {
            const slot_ctx = get_slot_context(definition, ctx, fn);
            return definition[0](slot_ctx);
        }
    }
    function get_slot_context(definition, ctx, fn) {
        return definition[1]
            ? assign({}, assign(ctx.$$scope.ctx, definition[1](fn ? fn(ctx) : {})))
            : ctx.$$scope.ctx;
    }
    function get_slot_changes(definition, ctx, changed, fn) {
        return definition[1]
            ? assign({}, assign(ctx.$$scope.changed || {}, definition[1](fn ? fn(changed) : {})))
            : ctx.$$scope.changed || {};
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function detach_before(after) {
        while (after.previousSibling) {
            after.parentNode.removeChild(after.previousSibling);
        }
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else
            node.setAttribute(attribute, value);
    }
    function to_number(value) {
        return value === '' ? undefined : +value;
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_data(text, data) {
        data = '' + data;
        if (text.data !== data)
            text.data = data;
    }
    function set_style(node, key, value) {
        node.style.setProperty(key, value);
    }
    function toggle_class(element, name, toggle) {
        element.classList[toggle ? 'add' : 'remove'](name);
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function createEventDispatcher() {
        const component = current_component;
        return (type, detail) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail);
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
            }
        };
    }

    const dirty_components = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_binding_callback(fn) {
        binding_callbacks.push(fn);
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    function add_flush_callback(fn) {
        flush_callbacks.push(fn);
    }
    function flush() {
        const seen_callbacks = new Set();
        do {
            // first, call beforeUpdate functions
            // and update components
            while (dirty_components.length) {
                const component = dirty_components.shift();
                set_current_component(component);
                update(component.$$);
            }
            while (binding_callbacks.length)
                binding_callbacks.shift()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            while (render_callbacks.length) {
                const callback = render_callbacks.pop();
                if (!seen_callbacks.has(callback)) {
                    callback();
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                }
            }
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
    }
    function update($$) {
        if ($$.fragment) {
            $$.update($$.dirty);
            run_all($$.before_render);
            $$.fragment.p($$.dirty, $$.ctx);
            $$.dirty = null;
            $$.after_render.forEach(add_render_callback);
        }
    }
    let outros;
    function group_outros() {
        outros = {
            remaining: 0,
            callbacks: []
        };
    }
    function check_outros() {
        if (!outros.remaining) {
            run_all(outros.callbacks);
        }
    }
    function on_outro(callback) {
        outros.callbacks.push(callback);
    }

    function bind(component, name, callback) {
        if (component.$$.props.indexOf(name) === -1)
            return;
        component.$$.bound[name] = callback;
        callback(component.$$.ctx[name]);
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_render } = component.$$;
        fragment.m(target, anchor);
        // onMount happens after the initial afterUpdate. Because
        // afterUpdate callbacks happen in reverse order (inner first)
        // we schedule onMount callbacks before afterUpdate callbacks
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_render.forEach(add_render_callback);
    }
    function destroy(component, detaching) {
        if (component.$$) {
            run_all(component.$$.on_destroy);
            component.$$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            component.$$.on_destroy = component.$$.fragment = null;
            component.$$.ctx = {};
        }
    }
    function make_dirty(component, key) {
        if (!component.$$.dirty) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty = blank_object();
        }
        component.$$.dirty[key] = true;
    }
    function init(component, options, instance, create_fragment, not_equal$$1, prop_names) {
        const parent_component = current_component;
        set_current_component(component);
        const props = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props: prop_names,
            update: noop,
            not_equal: not_equal$$1,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_render: [],
            after_render: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty: null
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, props, (key, value) => {
                if ($$.ctx && not_equal$$1($$.ctx[key], $$.ctx[key] = value)) {
                    if ($$.bound[key])
                        $$.bound[key](value);
                    if (ready)
                        make_dirty(component, key);
                }
            })
            : props;
        $$.update();
        ready = true;
        run_all($$.before_render);
        $$.fragment = create_fragment($$.ctx);
        if (options.target) {
            if (options.hydrate) {
                $$.fragment.l(children(options.target));
            }
            else {
                $$.fragment.c();
            }
            if (options.intro && component.$$.fragment.i)
                component.$$.fragment.i();
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy(this, true);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set() {
            // overridden by instance, if it has props
        }
    }
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error(`'target' is a required option`);
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn(`Component was already destroyed`); // eslint-disable-line no-console
            };
        }
    }

    /**
     * A function that always returns `true`. Any passed in parameters are ignored.
     *
     * @func
     * @memberOf R
     * @since v0.9.0
     * @category Function
     * @sig * -> Boolean
     * @param {*}
     * @return {Boolean}
     * @see R.F
     * @example
     *
     *      R.T(); //=> true
     */
    var T = function () {
      return true;
    };

    /**
     * A special placeholder value used to specify "gaps" within curried functions,
     * allowing partial application of any combination of arguments, regardless of
     * their positions.
     *
     * If `g` is a curried ternary function and `_` is `R.__`, the following are
     * equivalent:
     *
     *   - `g(1, 2, 3)`
     *   - `g(_, 2, 3)(1)`
     *   - `g(_, _, 3)(1)(2)`
     *   - `g(_, _, 3)(1, 2)`
     *   - `g(_, 2, _)(1, 3)`
     *   - `g(_, 2)(1)(3)`
     *   - `g(_, 2)(1, 3)`
     *   - `g(_, 2)(_, 3)(1)`
     *
     * @name __
     * @constant
     * @memberOf R
     * @since v0.6.0
     * @category Function
     * @example
     *
     *      const greet = R.replace('{name}', R.__, 'Hello, {name}!');
     *      greet('Alice'); //=> 'Hello, Alice!'
     */

    function _isPlaceholder(a) {
           return a != null && typeof a === 'object' && a['@@functional/placeholder'] === true;
    }

    /**
     * Optimized internal one-arity curry function.
     *
     * @private
     * @category Function
     * @param {Function} fn The function to curry.
     * @return {Function} The curried function.
     */
    function _curry1(fn) {
      return function f1(a) {
        if (arguments.length === 0 || _isPlaceholder(a)) {
          return f1;
        } else {
          return fn.apply(this, arguments);
        }
      };
    }

    /**
     * Optimized internal two-arity curry function.
     *
     * @private
     * @category Function
     * @param {Function} fn The function to curry.
     * @return {Function} The curried function.
     */
    function _curry2(fn) {
      return function f2(a, b) {
        switch (arguments.length) {
          case 0:
            return f2;
          case 1:
            return _isPlaceholder(a) ? f2 : _curry1(function (_b) {
              return fn(a, _b);
            });
          default:
            return _isPlaceholder(a) && _isPlaceholder(b) ? f2 : _isPlaceholder(a) ? _curry1(function (_a) {
              return fn(_a, b);
            }) : _isPlaceholder(b) ? _curry1(function (_b) {
              return fn(a, _b);
            }) : fn(a, b);
        }
      };
    }

    /**
     * Private `concat` function to merge two array-like objects.
     *
     * @private
     * @param {Array|Arguments} [set1=[]] An array-like object.
     * @param {Array|Arguments} [set2=[]] An array-like object.
     * @return {Array} A new, merged array.
     * @example
     *
     *      _concat([4, 5, 6], [1, 2, 3]); //=> [4, 5, 6, 1, 2, 3]
     */
    function _concat(set1, set2) {
      set1 = set1 || [];
      set2 = set2 || [];
      var idx;
      var len1 = set1.length;
      var len2 = set2.length;
      var result = [];

      idx = 0;
      while (idx < len1) {
        result[result.length] = set1[idx];
        idx += 1;
      }
      idx = 0;
      while (idx < len2) {
        result[result.length] = set2[idx];
        idx += 1;
      }
      return result;
    }

    function _arity(n, fn) {
      /* eslint-disable no-unused-vars */
      switch (n) {
        case 0:
          return function () {
            return fn.apply(this, arguments);
          };
        case 1:
          return function (a0) {
            return fn.apply(this, arguments);
          };
        case 2:
          return function (a0, a1) {
            return fn.apply(this, arguments);
          };
        case 3:
          return function (a0, a1, a2) {
            return fn.apply(this, arguments);
          };
        case 4:
          return function (a0, a1, a2, a3) {
            return fn.apply(this, arguments);
          };
        case 5:
          return function (a0, a1, a2, a3, a4) {
            return fn.apply(this, arguments);
          };
        case 6:
          return function (a0, a1, a2, a3, a4, a5) {
            return fn.apply(this, arguments);
          };
        case 7:
          return function (a0, a1, a2, a3, a4, a5, a6) {
            return fn.apply(this, arguments);
          };
        case 8:
          return function (a0, a1, a2, a3, a4, a5, a6, a7) {
            return fn.apply(this, arguments);
          };
        case 9:
          return function (a0, a1, a2, a3, a4, a5, a6, a7, a8) {
            return fn.apply(this, arguments);
          };
        case 10:
          return function (a0, a1, a2, a3, a4, a5, a6, a7, a8, a9) {
            return fn.apply(this, arguments);
          };
        default:
          throw new Error('First argument to _arity must be a non-negative integer no greater than ten');
      }
    }

    /**
     * Internal curryN function.
     *
     * @private
     * @category Function
     * @param {Number} length The arity of the curried function.
     * @param {Array} received An array of arguments received thus far.
     * @param {Function} fn The function to curry.
     * @return {Function} The curried function.
     */
    function _curryN(length, received, fn) {
      return function () {
        var combined = [];
        var argsIdx = 0;
        var left = length;
        var combinedIdx = 0;
        while (combinedIdx < received.length || argsIdx < arguments.length) {
          var result;
          if (combinedIdx < received.length && (!_isPlaceholder(received[combinedIdx]) || argsIdx >= arguments.length)) {
            result = received[combinedIdx];
          } else {
            result = arguments[argsIdx];
            argsIdx += 1;
          }
          combined[combinedIdx] = result;
          if (!_isPlaceholder(result)) {
            left -= 1;
          }
          combinedIdx += 1;
        }
        return left <= 0 ? fn.apply(this, combined) : _arity(left, _curryN(length, combined, fn));
      };
    }

    /**
     * Returns a curried equivalent of the provided function, with the specified
     * arity. The curried function has two unusual capabilities. First, its
     * arguments needn't be provided one at a time. If `g` is `R.curryN(3, f)`, the
     * following are equivalent:
     *
     *   - `g(1)(2)(3)`
     *   - `g(1)(2, 3)`
     *   - `g(1, 2)(3)`
     *   - `g(1, 2, 3)`
     *
     * Secondly, the special placeholder value [`R.__`](#__) may be used to specify
     * "gaps", allowing partial application of any combination of arguments,
     * regardless of their positions. If `g` is as above and `_` is [`R.__`](#__),
     * the following are equivalent:
     *
     *   - `g(1, 2, 3)`
     *   - `g(_, 2, 3)(1)`
     *   - `g(_, _, 3)(1)(2)`
     *   - `g(_, _, 3)(1, 2)`
     *   - `g(_, 2)(1)(3)`
     *   - `g(_, 2)(1, 3)`
     *   - `g(_, 2)(_, 3)(1)`
     *
     * @func
     * @memberOf R
     * @since v0.5.0
     * @category Function
     * @sig Number -> (* -> a) -> (* -> a)
     * @param {Number} length The arity for the returned function.
     * @param {Function} fn The function to curry.
     * @return {Function} A new, curried function.
     * @see R.curry
     * @example
     *
     *      const sumArgs = (...args) => R.sum(args);
     *
     *      const curriedAddFourNumbers = R.curryN(4, sumArgs);
     *      const f = curriedAddFourNumbers(1, 2);
     *      const g = f(3);
     *      g(4); //=> 10
     */
    var curryN = /*#__PURE__*/_curry2(function curryN(length, fn) {
      if (length === 1) {
        return _curry1(fn);
      }
      return _arity(length, _curryN(length, [], fn));
    });

    /**
     * Optimized internal three-arity curry function.
     *
     * @private
     * @category Function
     * @param {Function} fn The function to curry.
     * @return {Function} The curried function.
     */
    function _curry3(fn) {
      return function f3(a, b, c) {
        switch (arguments.length) {
          case 0:
            return f3;
          case 1:
            return _isPlaceholder(a) ? f3 : _curry2(function (_b, _c) {
              return fn(a, _b, _c);
            });
          case 2:
            return _isPlaceholder(a) && _isPlaceholder(b) ? f3 : _isPlaceholder(a) ? _curry2(function (_a, _c) {
              return fn(_a, b, _c);
            }) : _isPlaceholder(b) ? _curry2(function (_b, _c) {
              return fn(a, _b, _c);
            }) : _curry1(function (_c) {
              return fn(a, b, _c);
            });
          default:
            return _isPlaceholder(a) && _isPlaceholder(b) && _isPlaceholder(c) ? f3 : _isPlaceholder(a) && _isPlaceholder(b) ? _curry2(function (_a, _b) {
              return fn(_a, _b, c);
            }) : _isPlaceholder(a) && _isPlaceholder(c) ? _curry2(function (_a, _c) {
              return fn(_a, b, _c);
            }) : _isPlaceholder(b) && _isPlaceholder(c) ? _curry2(function (_b, _c) {
              return fn(a, _b, _c);
            }) : _isPlaceholder(a) ? _curry1(function (_a) {
              return fn(_a, b, c);
            }) : _isPlaceholder(b) ? _curry1(function (_b) {
              return fn(a, _b, c);
            }) : _isPlaceholder(c) ? _curry1(function (_c) {
              return fn(a, b, _c);
            }) : fn(a, b, c);
        }
      };
    }

    /**
     * Tests whether or not an object is an array.
     *
     * @private
     * @param {*} val The object to test.
     * @return {Boolean} `true` if `val` is an array, `false` otherwise.
     * @example
     *
     *      _isArray([]); //=> true
     *      _isArray(null); //=> false
     *      _isArray({}); //=> false
     */
    var _isArray = Array.isArray || function _isArray(val) {
      return val != null && val.length >= 0 && Object.prototype.toString.call(val) === '[object Array]';
    };

    function _isTransformer(obj) {
      return obj != null && typeof obj['@@transducer/step'] === 'function';
    }

    /**
     * Returns a function that dispatches with different strategies based on the
     * object in list position (last argument). If it is an array, executes [fn].
     * Otherwise, if it has a function with one of the given method names, it will
     * execute that function (functor case). Otherwise, if it is a transformer,
     * uses transducer [xf] to return a new transformer (transducer case).
     * Otherwise, it will default to executing [fn].
     *
     * @private
     * @param {Array} methodNames properties to check for a custom implementation
     * @param {Function} xf transducer to initialize if object is transformer
     * @param {Function} fn default ramda implementation
     * @return {Function} A function that dispatches on object in list position
     */
    function _dispatchable(methodNames, xf, fn) {
      return function () {
        if (arguments.length === 0) {
          return fn();
        }
        var args = Array.prototype.slice.call(arguments, 0);
        var obj = args.pop();
        if (!_isArray(obj)) {
          var idx = 0;
          while (idx < methodNames.length) {
            if (typeof obj[methodNames[idx]] === 'function') {
              return obj[methodNames[idx]].apply(obj, args);
            }
            idx += 1;
          }
          if (_isTransformer(obj)) {
            var transducer = xf.apply(null, args);
            return transducer(obj);
          }
        }
        return fn.apply(this, arguments);
      };
    }

    var _xfBase = {
      init: function () {
        return this.xf['@@transducer/init']();
      },
      result: function (result) {
        return this.xf['@@transducer/result'](result);
      }
    };

    /**
     * Returns the larger of its two arguments.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category Relation
     * @sig Ord a => a -> a -> a
     * @param {*} a
     * @param {*} b
     * @return {*}
     * @see R.maxBy, R.min
     * @example
     *
     *      R.max(789, 123); //=> 789
     *      R.max('a', 'b'); //=> 'b'
     */
    var max = /*#__PURE__*/_curry2(function max(a, b) {
      return b > a ? b : a;
    });

    function _map(fn, functor) {
      var idx = 0;
      var len = functor.length;
      var result = Array(len);
      while (idx < len) {
        result[idx] = fn(functor[idx]);
        idx += 1;
      }
      return result;
    }

    function _isString(x) {
      return Object.prototype.toString.call(x) === '[object String]';
    }

    /**
     * Tests whether or not an object is similar to an array.
     *
     * @private
     * @category Type
     * @category List
     * @sig * -> Boolean
     * @param {*} x The object to test.
     * @return {Boolean} `true` if `x` has a numeric length property and extreme indices defined; `false` otherwise.
     * @example
     *
     *      _isArrayLike([]); //=> true
     *      _isArrayLike(true); //=> false
     *      _isArrayLike({}); //=> false
     *      _isArrayLike({length: 10}); //=> false
     *      _isArrayLike({0: 'zero', 9: 'nine', length: 10}); //=> true
     */
    var _isArrayLike = /*#__PURE__*/_curry1(function isArrayLike(x) {
      if (_isArray(x)) {
        return true;
      }
      if (!x) {
        return false;
      }
      if (typeof x !== 'object') {
        return false;
      }
      if (_isString(x)) {
        return false;
      }
      if (x.nodeType === 1) {
        return !!x.length;
      }
      if (x.length === 0) {
        return true;
      }
      if (x.length > 0) {
        return x.hasOwnProperty(0) && x.hasOwnProperty(x.length - 1);
      }
      return false;
    });

    var XWrap = /*#__PURE__*/function () {
      function XWrap(fn) {
        this.f = fn;
      }
      XWrap.prototype['@@transducer/init'] = function () {
        throw new Error('init not implemented on XWrap');
      };
      XWrap.prototype['@@transducer/result'] = function (acc) {
        return acc;
      };
      XWrap.prototype['@@transducer/step'] = function (acc, x) {
        return this.f(acc, x);
      };

      return XWrap;
    }();

    function _xwrap(fn) {
      return new XWrap(fn);
    }

    /**
     * Creates a function that is bound to a context.
     * Note: `R.bind` does not provide the additional argument-binding capabilities of
     * [Function.prototype.bind](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/bind).
     *
     * @func
     * @memberOf R
     * @since v0.6.0
     * @category Function
     * @category Object
     * @sig (* -> *) -> {*} -> (* -> *)
     * @param {Function} fn The function to bind to context
     * @param {Object} thisObj The context to bind `fn` to
     * @return {Function} A function that will execute in the context of `thisObj`.
     * @see R.partial
     * @example
     *
     *      const log = R.bind(console.log, console);
     *      R.pipe(R.assoc('a', 2), R.tap(log), R.assoc('a', 3))({a: 1}); //=> {a: 3}
     *      // logs {a: 2}
     * @symb R.bind(f, o)(a, b) = f.call(o, a, b)
     */
    var bind$1 = /*#__PURE__*/_curry2(function bind(fn, thisObj) {
      return _arity(fn.length, function () {
        return fn.apply(thisObj, arguments);
      });
    });

    function _arrayReduce(xf, acc, list) {
      var idx = 0;
      var len = list.length;
      while (idx < len) {
        acc = xf['@@transducer/step'](acc, list[idx]);
        if (acc && acc['@@transducer/reduced']) {
          acc = acc['@@transducer/value'];
          break;
        }
        idx += 1;
      }
      return xf['@@transducer/result'](acc);
    }

    function _iterableReduce(xf, acc, iter) {
      var step = iter.next();
      while (!step.done) {
        acc = xf['@@transducer/step'](acc, step.value);
        if (acc && acc['@@transducer/reduced']) {
          acc = acc['@@transducer/value'];
          break;
        }
        step = iter.next();
      }
      return xf['@@transducer/result'](acc);
    }

    function _methodReduce(xf, acc, obj, methodName) {
      return xf['@@transducer/result'](obj[methodName](bind$1(xf['@@transducer/step'], xf), acc));
    }

    var symIterator = typeof Symbol !== 'undefined' ? Symbol.iterator : '@@iterator';

    function _reduce(fn, acc, list) {
      if (typeof fn === 'function') {
        fn = _xwrap(fn);
      }
      if (_isArrayLike(list)) {
        return _arrayReduce(fn, acc, list);
      }
      if (typeof list['fantasy-land/reduce'] === 'function') {
        return _methodReduce(fn, acc, list, 'fantasy-land/reduce');
      }
      if (list[symIterator] != null) {
        return _iterableReduce(fn, acc, list[symIterator]());
      }
      if (typeof list.next === 'function') {
        return _iterableReduce(fn, acc, list);
      }
      if (typeof list.reduce === 'function') {
        return _methodReduce(fn, acc, list, 'reduce');
      }

      throw new TypeError('reduce: list must be array or iterable');
    }

    var XMap = /*#__PURE__*/function () {
      function XMap(f, xf) {
        this.xf = xf;
        this.f = f;
      }
      XMap.prototype['@@transducer/init'] = _xfBase.init;
      XMap.prototype['@@transducer/result'] = _xfBase.result;
      XMap.prototype['@@transducer/step'] = function (result, input) {
        return this.xf['@@transducer/step'](result, this.f(input));
      };

      return XMap;
    }();

    var _xmap = /*#__PURE__*/_curry2(function _xmap(f, xf) {
      return new XMap(f, xf);
    });

    function _has(prop, obj) {
      return Object.prototype.hasOwnProperty.call(obj, prop);
    }

    var toString = Object.prototype.toString;
    var _isArguments = /*#__PURE__*/function () {
      return toString.call(arguments) === '[object Arguments]' ? function _isArguments(x) {
        return toString.call(x) === '[object Arguments]';
      } : function _isArguments(x) {
        return _has('callee', x);
      };
    }();

    // cover IE < 9 keys issues
    var hasEnumBug = ! /*#__PURE__*/{ toString: null }.propertyIsEnumerable('toString');
    var nonEnumerableProps = ['constructor', 'valueOf', 'isPrototypeOf', 'toString', 'propertyIsEnumerable', 'hasOwnProperty', 'toLocaleString'];
    // Safari bug
    var hasArgsEnumBug = /*#__PURE__*/function () {

      return arguments.propertyIsEnumerable('length');
    }();

    var contains = function contains(list, item) {
      var idx = 0;
      while (idx < list.length) {
        if (list[idx] === item) {
          return true;
        }
        idx += 1;
      }
      return false;
    };

    /**
     * Returns a list containing the names of all the enumerable own properties of
     * the supplied object.
     * Note that the order of the output array is not guaranteed to be consistent
     * across different JS platforms.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category Object
     * @sig {k: v} -> [k]
     * @param {Object} obj The object to extract properties from
     * @return {Array} An array of the object's own properties.
     * @see R.keysIn, R.values
     * @example
     *
     *      R.keys({a: 1, b: 2, c: 3}); //=> ['a', 'b', 'c']
     */
    var keys = typeof Object.keys === 'function' && !hasArgsEnumBug ? /*#__PURE__*/_curry1(function keys(obj) {
      return Object(obj) !== obj ? [] : Object.keys(obj);
    }) : /*#__PURE__*/_curry1(function keys(obj) {
      if (Object(obj) !== obj) {
        return [];
      }
      var prop, nIdx;
      var ks = [];
      var checkArgsLength = hasArgsEnumBug && _isArguments(obj);
      for (prop in obj) {
        if (_has(prop, obj) && (!checkArgsLength || prop !== 'length')) {
          ks[ks.length] = prop;
        }
      }
      if (hasEnumBug) {
        nIdx = nonEnumerableProps.length - 1;
        while (nIdx >= 0) {
          prop = nonEnumerableProps[nIdx];
          if (_has(prop, obj) && !contains(ks, prop)) {
            ks[ks.length] = prop;
          }
          nIdx -= 1;
        }
      }
      return ks;
    });

    /**
     * Takes a function and
     * a [functor](https://github.com/fantasyland/fantasy-land#functor),
     * applies the function to each of the functor's values, and returns
     * a functor of the same shape.
     *
     * Ramda provides suitable `map` implementations for `Array` and `Object`,
     * so this function may be applied to `[1, 2, 3]` or `{x: 1, y: 2, z: 3}`.
     *
     * Dispatches to the `map` method of the second argument, if present.
     *
     * Acts as a transducer if a transformer is given in list position.
     *
     * Also treats functions as functors and will compose them together.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category List
     * @sig Functor f => (a -> b) -> f a -> f b
     * @param {Function} fn The function to be called on every element of the input `list`.
     * @param {Array} list The list to be iterated over.
     * @return {Array} The new list.
     * @see R.transduce, R.addIndex
     * @example
     *
     *      const double = x => x * 2;
     *
     *      R.map(double, [1, 2, 3]); //=> [2, 4, 6]
     *
     *      R.map(double, {x: 1, y: 2, z: 3}); //=> {x: 2, y: 4, z: 6}
     * @symb R.map(f, [a, b]) = [f(a), f(b)]
     * @symb R.map(f, { x: a, y: b }) = { x: f(a), y: f(b) }
     * @symb R.map(f, functor_o) = functor_o.map(f)
     */
    var map = /*#__PURE__*/_curry2( /*#__PURE__*/_dispatchable(['fantasy-land/map', 'map'], _xmap, function map(fn, functor) {
      switch (Object.prototype.toString.call(functor)) {
        case '[object Function]':
          return curryN(functor.length, function () {
            return fn.call(this, functor.apply(this, arguments));
          });
        case '[object Object]':
          return _reduce(function (acc, key) {
            acc[key] = fn(functor[key]);
            return acc;
          }, {}, keys(functor));
        default:
          return _map(fn, functor);
      }
    }));

    /**
     * Retrieve the value at a given path.
     *
     * @func
     * @memberOf R
     * @since v0.2.0
     * @category Object
     * @typedefn Idx = String | Int
     * @sig [Idx] -> {a} -> a | Undefined
     * @param {Array} path The path to use.
     * @param {Object} obj The object to retrieve the nested property from.
     * @return {*} The data at `path`.
     * @see R.prop
     * @example
     *
     *      R.path(['a', 'b'], {a: {b: 2}}); //=> 2
     *      R.path(['a', 'b'], {c: {b: 2}}); //=> undefined
     */
    var path = /*#__PURE__*/_curry2(function path(paths, obj) {
      var val = obj;
      var idx = 0;
      while (idx < paths.length) {
        if (val == null) {
          return;
        }
        val = val[paths[idx]];
        idx += 1;
      }
      return val;
    });

    /**
     * Returns a single item by iterating through the list, successively calling
     * the iterator function and passing it an accumulator value and the current
     * value from the array, and then passing the result to the next call.
     *
     * The iterator function receives two values: *(acc, value)*. It may use
     * [`R.reduced`](#reduced) to shortcut the iteration.
     *
     * The arguments' order of [`reduceRight`](#reduceRight)'s iterator function
     * is *(value, acc)*.
     *
     * Note: `R.reduce` does not skip deleted or unassigned indices (sparse
     * arrays), unlike the native `Array.prototype.reduce` method. For more details
     * on this behavior, see:
     * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/reduce#Description
     *
     * Dispatches to the `reduce` method of the third argument, if present. When
     * doing so, it is up to the user to handle the [`R.reduced`](#reduced)
     * shortcuting, as this is not implemented by `reduce`.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category List
     * @sig ((a, b) -> a) -> a -> [b] -> a
     * @param {Function} fn The iterator function. Receives two values, the accumulator and the
     *        current element from the array.
     * @param {*} acc The accumulator value.
     * @param {Array} list The list to iterate over.
     * @return {*} The final, accumulated value.
     * @see R.reduced, R.addIndex, R.reduceRight
     * @example
     *
     *      R.reduce(R.subtract, 0, [1, 2, 3, 4]) // => ((((0 - 1) - 2) - 3) - 4) = -10
     *      //          -               -10
     *      //         / \              / \
     *      //        -   4           -6   4
     *      //       / \              / \
     *      //      -   3   ==>     -3   3
     *      //     / \              / \
     *      //    -   2           -1   2
     *      //   / \              / \
     *      //  0   1            0   1
     *
     * @symb R.reduce(f, a, [b, c, d]) = f(f(f(a, b), c), d)
     */
    var reduce = /*#__PURE__*/_curry3(_reduce);

    /**
     * Returns a function that always returns the given value. Note that for
     * non-primitives the value returned is a reference to the original value.
     *
     * This function is known as `const`, `constant`, or `K` (for K combinator) in
     * other languages and libraries.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category Function
     * @sig a -> (* -> a)
     * @param {*} val The value to wrap in a function
     * @return {Function} A Function :: * -> val.
     * @example
     *
     *      const t = R.always('Tee');
     *      t(); //=> 'Tee'
     */
    var always = /*#__PURE__*/_curry1(function always(val) {
      return function () {
        return val;
      };
    });

    /**
     * Returns a new list containing the contents of the given list, followed by
     * the given element.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category List
     * @sig a -> [a] -> [a]
     * @param {*} el The element to add to the end of the new list.
     * @param {Array} list The list of elements to add a new item to.
     *        list.
     * @return {Array} A new list containing the elements of the old list followed by `el`.
     * @see R.prepend
     * @example
     *
     *      R.append('tests', ['write', 'more']); //=> ['write', 'more', 'tests']
     *      R.append('tests', []); //=> ['tests']
     *      R.append(['tests'], ['write', 'more']); //=> ['write', 'more', ['tests']]
     */
    var append$1 = /*#__PURE__*/_curry2(function append(el, list) {
      return _concat(list, [el]);
    });

    /**
     * Determine if the passed argument is an integer.
     *
     * @private
     * @param {*} n
     * @category Type
     * @return {Boolean}
     */

    function _isFunction(x) {
      return Object.prototype.toString.call(x) === '[object Function]';
    }

    /**
     * Gives a single-word string description of the (native) type of a value,
     * returning such answers as 'Object', 'Number', 'Array', or 'Null'. Does not
     * attempt to distinguish user Object types any further, reporting them all as
     * 'Object'.
     *
     * @func
     * @memberOf R
     * @since v0.8.0
     * @category Type
     * @sig (* -> {*}) -> String
     * @param {*} val The value to test
     * @return {String}
     * @example
     *
     *      R.type({}); //=> "Object"
     *      R.type(1); //=> "Number"
     *      R.type(false); //=> "Boolean"
     *      R.type('s'); //=> "String"
     *      R.type(null); //=> "Null"
     *      R.type([]); //=> "Array"
     *      R.type(/[A-z]/); //=> "RegExp"
     *      R.type(() => {}); //=> "Function"
     *      R.type(undefined); //=> "Undefined"
     */
    var type = /*#__PURE__*/_curry1(function type(val) {
      return val === null ? 'Null' : val === undefined ? 'Undefined' : Object.prototype.toString.call(val).slice(8, -1);
    });

    /**
     * Returns the nth element of the given list or string. If n is negative the
     * element at index length + n is returned.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category List
     * @sig Number -> [a] -> a | Undefined
     * @sig Number -> String -> String
     * @param {Number} offset
     * @param {*} list
     * @return {*}
     * @example
     *
     *      const list = ['foo', 'bar', 'baz', 'quux'];
     *      R.nth(1, list); //=> 'bar'
     *      R.nth(-1, list); //=> 'quux'
     *      R.nth(-99, list); //=> undefined
     *
     *      R.nth(2, 'abc'); //=> 'c'
     *      R.nth(3, 'abc'); //=> ''
     * @symb R.nth(-1, [a, b, c]) = c
     * @symb R.nth(0, [a, b, c]) = a
     * @symb R.nth(1, [a, b, c]) = b
     */
    var nth = /*#__PURE__*/_curry2(function nth(offset, list) {
      var idx = offset < 0 ? list.length + offset : offset;
      return _isString(list) ? list.charAt(idx) : list[idx];
    });

    function _arrayFromIterator(iter) {
      var list = [];
      var next;
      while (!(next = iter.next()).done) {
        list.push(next.value);
      }
      return list;
    }

    function _includesWith(pred, x, list) {
      var idx = 0;
      var len = list.length;

      while (idx < len) {
        if (pred(x, list[idx])) {
          return true;
        }
        idx += 1;
      }
      return false;
    }

    function _functionName(f) {
      // String(x => x) evaluates to "x => x", so the pattern may not match.
      var match = String(f).match(/^function (\w*)/);
      return match == null ? '' : match[1];
    }

    // Based on https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/is
    function _objectIs(a, b) {
      // SameValue algorithm
      if (a === b) {
        // Steps 1-5, 7-10
        // Steps 6.b-6.e: +0 != -0
        return a !== 0 || 1 / a === 1 / b;
      } else {
        // Step 6.a: NaN == NaN
        return a !== a && b !== b;
      }
    }

    var _objectIs$1 = typeof Object.is === 'function' ? Object.is : _objectIs;

    /**
     * private _uniqContentEquals function.
     * That function is checking equality of 2 iterator contents with 2 assumptions
     * - iterators lengths are the same
     * - iterators values are unique
     *
     * false-positive result will be returned for comparision of, e.g.
     * - [1,2,3] and [1,2,3,4]
     * - [1,1,1] and [1,2,3]
     * */

    function _uniqContentEquals(aIterator, bIterator, stackA, stackB) {
      var a = _arrayFromIterator(aIterator);
      var b = _arrayFromIterator(bIterator);

      function eq(_a, _b) {
        return _equals(_a, _b, stackA.slice(), stackB.slice());
      }

      // if *a* array contains any element that is not included in *b*
      return !_includesWith(function (b, aItem) {
        return !_includesWith(eq, aItem, b);
      }, b, a);
    }

    function _equals(a, b, stackA, stackB) {
      if (_objectIs$1(a, b)) {
        return true;
      }

      var typeA = type(a);

      if (typeA !== type(b)) {
        return false;
      }

      if (a == null || b == null) {
        return false;
      }

      if (typeof a['fantasy-land/equals'] === 'function' || typeof b['fantasy-land/equals'] === 'function') {
        return typeof a['fantasy-land/equals'] === 'function' && a['fantasy-land/equals'](b) && typeof b['fantasy-land/equals'] === 'function' && b['fantasy-land/equals'](a);
      }

      if (typeof a.equals === 'function' || typeof b.equals === 'function') {
        return typeof a.equals === 'function' && a.equals(b) && typeof b.equals === 'function' && b.equals(a);
      }

      switch (typeA) {
        case 'Arguments':
        case 'Array':
        case 'Object':
          if (typeof a.constructor === 'function' && _functionName(a.constructor) === 'Promise') {
            return a === b;
          }
          break;
        case 'Boolean':
        case 'Number':
        case 'String':
          if (!(typeof a === typeof b && _objectIs$1(a.valueOf(), b.valueOf()))) {
            return false;
          }
          break;
        case 'Date':
          if (!_objectIs$1(a.valueOf(), b.valueOf())) {
            return false;
          }
          break;
        case 'Error':
          return a.name === b.name && a.message === b.message;
        case 'RegExp':
          if (!(a.source === b.source && a.global === b.global && a.ignoreCase === b.ignoreCase && a.multiline === b.multiline && a.sticky === b.sticky && a.unicode === b.unicode)) {
            return false;
          }
          break;
      }

      var idx = stackA.length - 1;
      while (idx >= 0) {
        if (stackA[idx] === a) {
          return stackB[idx] === b;
        }
        idx -= 1;
      }

      switch (typeA) {
        case 'Map':
          if (a.size !== b.size) {
            return false;
          }

          return _uniqContentEquals(a.entries(), b.entries(), stackA.concat([a]), stackB.concat([b]));
        case 'Set':
          if (a.size !== b.size) {
            return false;
          }

          return _uniqContentEquals(a.values(), b.values(), stackA.concat([a]), stackB.concat([b]));
        case 'Arguments':
        case 'Array':
        case 'Object':
        case 'Boolean':
        case 'Number':
        case 'String':
        case 'Date':
        case 'Error':
        case 'RegExp':
        case 'Int8Array':
        case 'Uint8Array':
        case 'Uint8ClampedArray':
        case 'Int16Array':
        case 'Uint16Array':
        case 'Int32Array':
        case 'Uint32Array':
        case 'Float32Array':
        case 'Float64Array':
        case 'ArrayBuffer':
          break;
        default:
          // Values of other types are only equal if identical.
          return false;
      }

      var keysA = keys(a);
      if (keysA.length !== keys(b).length) {
        return false;
      }

      var extendedStackA = stackA.concat([a]);
      var extendedStackB = stackB.concat([b]);

      idx = keysA.length - 1;
      while (idx >= 0) {
        var key = keysA[idx];
        if (!(_has(key, b) && _equals(b[key], a[key], extendedStackA, extendedStackB))) {
          return false;
        }
        idx -= 1;
      }
      return true;
    }

    /**
     * Returns `true` if its arguments are equivalent, `false` otherwise. Handles
     * cyclical data structures.
     *
     * Dispatches symmetrically to the `equals` methods of both arguments, if
     * present.
     *
     * @func
     * @memberOf R
     * @since v0.15.0
     * @category Relation
     * @sig a -> b -> Boolean
     * @param {*} a
     * @param {*} b
     * @return {Boolean}
     * @example
     *
     *      R.equals(1, 1); //=> true
     *      R.equals(1, '1'); //=> false
     *      R.equals([1, 2, 3], [1, 2, 3]); //=> true
     *
     *      const a = {}; a.v = a;
     *      const b = {}; b.v = b;
     *      R.equals(a, b); //=> true
     */
    var equals = /*#__PURE__*/_curry2(function equals(a, b) {
      return _equals(a, b, [], []);
    });

    function _indexOf(list, a, idx) {
      var inf, item;
      // Array.prototype.indexOf doesn't exist below IE9
      if (typeof list.indexOf === 'function') {
        switch (typeof a) {
          case 'number':
            if (a === 0) {
              // manually crawl the list to distinguish between +0 and -0
              inf = 1 / a;
              while (idx < list.length) {
                item = list[idx];
                if (item === 0 && 1 / item === inf) {
                  return idx;
                }
                idx += 1;
              }
              return -1;
            } else if (a !== a) {
              // NaN
              while (idx < list.length) {
                item = list[idx];
                if (typeof item === 'number' && item !== item) {
                  return idx;
                }
                idx += 1;
              }
              return -1;
            }
            // non-zero numbers can utilise Set
            return list.indexOf(a, idx);

          // all these types can utilise Set
          case 'string':
          case 'boolean':
          case 'function':
          case 'undefined':
            return list.indexOf(a, idx);

          case 'object':
            if (a === null) {
              // null can utilise Set
              return list.indexOf(a, idx);
            }
        }
      }
      // anything else not covered above, defer to R.equals
      while (idx < list.length) {
        if (equals(list[idx], a)) {
          return idx;
        }
        idx += 1;
      }
      return -1;
    }

    function _includes(a, list) {
      return _indexOf(list, a, 0) >= 0;
    }

    function _quote(s) {
      var escaped = s.replace(/\\/g, '\\\\').replace(/[\b]/g, '\\b') // \b matches word boundary; [\b] matches backspace
      .replace(/\f/g, '\\f').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t').replace(/\v/g, '\\v').replace(/\0/g, '\\0');

      return '"' + escaped.replace(/"/g, '\\"') + '"';
    }

    /**
     * Polyfill from <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toISOString>.
     */
    var pad = function pad(n) {
      return (n < 10 ? '0' : '') + n;
    };

    var _toISOString = typeof Date.prototype.toISOString === 'function' ? function _toISOString(d) {
      return d.toISOString();
    } : function _toISOString(d) {
      return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()) + 'T' + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) + ':' + pad(d.getUTCSeconds()) + '.' + (d.getUTCMilliseconds() / 1000).toFixed(3).slice(2, 5) + 'Z';
    };

    function _complement(f) {
      return function () {
        return !f.apply(this, arguments);
      };
    }

    function _filter(fn, list) {
      var idx = 0;
      var len = list.length;
      var result = [];

      while (idx < len) {
        if (fn(list[idx])) {
          result[result.length] = list[idx];
        }
        idx += 1;
      }
      return result;
    }

    function _isObject(x) {
      return Object.prototype.toString.call(x) === '[object Object]';
    }

    var XFilter = /*#__PURE__*/function () {
      function XFilter(f, xf) {
        this.xf = xf;
        this.f = f;
      }
      XFilter.prototype['@@transducer/init'] = _xfBase.init;
      XFilter.prototype['@@transducer/result'] = _xfBase.result;
      XFilter.prototype['@@transducer/step'] = function (result, input) {
        return this.f(input) ? this.xf['@@transducer/step'](result, input) : result;
      };

      return XFilter;
    }();

    var _xfilter = /*#__PURE__*/_curry2(function _xfilter(f, xf) {
      return new XFilter(f, xf);
    });

    /**
     * Takes a predicate and a `Filterable`, and returns a new filterable of the
     * same type containing the members of the given filterable which satisfy the
     * given predicate. Filterable objects include plain objects or any object
     * that has a filter method such as `Array`.
     *
     * Dispatches to the `filter` method of the second argument, if present.
     *
     * Acts as a transducer if a transformer is given in list position.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category List
     * @sig Filterable f => (a -> Boolean) -> f a -> f a
     * @param {Function} pred
     * @param {Array} filterable
     * @return {Array} Filterable
     * @see R.reject, R.transduce, R.addIndex
     * @example
     *
     *      const isEven = n => n % 2 === 0;
     *
     *      R.filter(isEven, [1, 2, 3, 4]); //=> [2, 4]
     *
     *      R.filter(isEven, {a: 1, b: 2, c: 3, d: 4}); //=> {b: 2, d: 4}
     */
    var filter = /*#__PURE__*/_curry2( /*#__PURE__*/_dispatchable(['filter'], _xfilter, function (pred, filterable) {
      return _isObject(filterable) ? _reduce(function (acc, key) {
        if (pred(filterable[key])) {
          acc[key] = filterable[key];
        }
        return acc;
      }, {}, keys(filterable)) :
      // else
      _filter(pred, filterable);
    }));

    /**
     * The complement of [`filter`](#filter).
     *
     * Acts as a transducer if a transformer is given in list position. Filterable
     * objects include plain objects or any object that has a filter method such
     * as `Array`.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category List
     * @sig Filterable f => (a -> Boolean) -> f a -> f a
     * @param {Function} pred
     * @param {Array} filterable
     * @return {Array}
     * @see R.filter, R.transduce, R.addIndex
     * @example
     *
     *      const isOdd = (n) => n % 2 === 1;
     *
     *      R.reject(isOdd, [1, 2, 3, 4]); //=> [2, 4]
     *
     *      R.reject(isOdd, {a: 1, b: 2, c: 3, d: 4}); //=> {b: 2, d: 4}
     */
    var reject = /*#__PURE__*/_curry2(function reject(pred, filterable) {
      return filter(_complement(pred), filterable);
    });

    function _toString(x, seen) {
      var recur = function recur(y) {
        var xs = seen.concat([x]);
        return _includes(y, xs) ? '<Circular>' : _toString(y, xs);
      };

      //  mapPairs :: (Object, [String]) -> [String]
      var mapPairs = function (obj, keys) {
        return _map(function (k) {
          return _quote(k) + ': ' + recur(obj[k]);
        }, keys.slice().sort());
      };

      switch (Object.prototype.toString.call(x)) {
        case '[object Arguments]':
          return '(function() { return arguments; }(' + _map(recur, x).join(', ') + '))';
        case '[object Array]':
          return '[' + _map(recur, x).concat(mapPairs(x, reject(function (k) {
            return (/^\d+$/.test(k)
            );
          }, keys(x)))).join(', ') + ']';
        case '[object Boolean]':
          return typeof x === 'object' ? 'new Boolean(' + recur(x.valueOf()) + ')' : x.toString();
        case '[object Date]':
          return 'new Date(' + (isNaN(x.valueOf()) ? recur(NaN) : _quote(_toISOString(x))) + ')';
        case '[object Null]':
          return 'null';
        case '[object Number]':
          return typeof x === 'object' ? 'new Number(' + recur(x.valueOf()) + ')' : 1 / x === -Infinity ? '-0' : x.toString(10);
        case '[object String]':
          return typeof x === 'object' ? 'new String(' + recur(x.valueOf()) + ')' : _quote(x);
        case '[object Undefined]':
          return 'undefined';
        default:
          if (typeof x.toString === 'function') {
            var repr = x.toString();
            if (repr !== '[object Object]') {
              return repr;
            }
          }
          return '{' + mapPairs(x, keys(x)).join(', ') + '}';
      }
    }

    /**
     * Returns the string representation of the given value. `eval`'ing the output
     * should result in a value equivalent to the input value. Many of the built-in
     * `toString` methods do not satisfy this requirement.
     *
     * If the given value is an `[object Object]` with a `toString` method other
     * than `Object.prototype.toString`, this method is invoked with no arguments
     * to produce the return value. This means user-defined constructor functions
     * can provide a suitable `toString` method. For example:
     *
     *     function Point(x, y) {
     *       this.x = x;
     *       this.y = y;
     *     }
     *
     *     Point.prototype.toString = function() {
     *       return 'new Point(' + this.x + ', ' + this.y + ')';
     *     };
     *
     *     R.toString(new Point(1, 2)); //=> 'new Point(1, 2)'
     *
     * @func
     * @memberOf R
     * @since v0.14.0
     * @category String
     * @sig * -> String
     * @param {*} val
     * @return {String}
     * @example
     *
     *      R.toString(42); //=> '42'
     *      R.toString('abc'); //=> '"abc"'
     *      R.toString([1, 2, 3]); //=> '[1, 2, 3]'
     *      R.toString({foo: 1, bar: 2, baz: 3}); //=> '{"bar": 2, "baz": 3, "foo": 1}'
     *      R.toString(new Date('2001-02-03T04:05:06Z')); //=> 'new Date("2001-02-03T04:05:06.000Z")'
     */
    var toString$1 = /*#__PURE__*/_curry1(function toString(val) {
      return _toString(val, []);
    });

    /**
     * Returns the result of concatenating the given lists or strings.
     *
     * Note: `R.concat` expects both arguments to be of the same type,
     * unlike the native `Array.prototype.concat` method. It will throw
     * an error if you `concat` an Array with a non-Array value.
     *
     * Dispatches to the `concat` method of the first argument, if present.
     * Can also concatenate two members of a [fantasy-land
     * compatible semigroup](https://github.com/fantasyland/fantasy-land#semigroup).
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category List
     * @sig [a] -> [a] -> [a]
     * @sig String -> String -> String
     * @param {Array|String} firstList The first list
     * @param {Array|String} secondList The second list
     * @return {Array|String} A list consisting of the elements of `firstList` followed by the elements of
     * `secondList`.
     *
     * @example
     *
     *      R.concat('ABC', 'DEF'); // 'ABCDEF'
     *      R.concat([4, 5, 6], [1, 2, 3]); //=> [4, 5, 6, 1, 2, 3]
     *      R.concat([], []); //=> []
     */
    var concat = /*#__PURE__*/_curry2(function concat(a, b) {
      if (_isArray(a)) {
        if (_isArray(b)) {
          return a.concat(b);
        }
        throw new TypeError(toString$1(b) + ' is not an array');
      }
      if (_isString(a)) {
        if (_isString(b)) {
          return a + b;
        }
        throw new TypeError(toString$1(b) + ' is not a string');
      }
      if (a != null && _isFunction(a['fantasy-land/concat'])) {
        return a['fantasy-land/concat'](b);
      }
      if (a != null && _isFunction(a.concat)) {
        return a.concat(b);
      }
      throw new TypeError(toString$1(a) + ' does not have a method named "concat" or "fantasy-land/concat"');
    });

    /**
     * Returns a function, `fn`, which encapsulates `if/else, if/else, ...` logic.
     * `R.cond` takes a list of [predicate, transformer] pairs. All of the arguments
     * to `fn` are applied to each of the predicates in turn until one returns a
     * "truthy" value, at which point `fn` returns the result of applying its
     * arguments to the corresponding transformer. If none of the predicates
     * matches, `fn` returns undefined.
     *
     * @func
     * @memberOf R
     * @since v0.6.0
     * @category Logic
     * @sig [[(*... -> Boolean),(*... -> *)]] -> (*... -> *)
     * @param {Array} pairs A list of [predicate, transformer]
     * @return {Function}
     * @see R.ifElse, R.unless, R.when
     * @example
     *
     *      const fn = R.cond([
     *        [R.equals(0),   R.always('water freezes at 0°C')],
     *        [R.equals(100), R.always('water boils at 100°C')],
     *        [R.T,           temp => 'nothing special happens at ' + temp + '°C']
     *      ]);
     *      fn(0); //=> 'water freezes at 0°C'
     *      fn(50); //=> 'nothing special happens at 50°C'
     *      fn(100); //=> 'water boils at 100°C'
     */
    var cond = /*#__PURE__*/_curry1(function cond(pairs) {
      var arity = reduce(max, 0, map(function (pair) {
        return pair[0].length;
      }, pairs));
      return _arity(arity, function () {
        var idx = 0;
        while (idx < pairs.length) {
          if (pairs[idx][0].apply(this, arguments)) {
            return pairs[idx][1].apply(this, arguments);
          }
          idx += 1;
        }
      });
    });

    var _Set = /*#__PURE__*/function () {
      function _Set() {
        /* globals Set */
        this._nativeSet = typeof Set === 'function' ? new Set() : null;
        this._items = {};
      }

      // until we figure out why jsdoc chokes on this
      // @param item The item to add to the Set
      // @returns {boolean} true if the item did not exist prior, otherwise false
      //
      _Set.prototype.add = function (item) {
        return !hasOrAdd(item, true, this);
      };

      //
      // @param item The item to check for existence in the Set
      // @returns {boolean} true if the item exists in the Set, otherwise false
      //
      _Set.prototype.has = function (item) {
        return hasOrAdd(item, false, this);
      };

      //
      // Combines the logic for checking whether an item is a member of the set and
      // for adding a new item to the set.
      //
      // @param item       The item to check or add to the Set instance.
      // @param shouldAdd  If true, the item will be added to the set if it doesn't
      //                   already exist.
      // @param set        The set instance to check or add to.
      // @return {boolean} true if the item already existed, otherwise false.
      //
      return _Set;
    }();

    function hasOrAdd(item, shouldAdd, set) {
      var type = typeof item;
      var prevSize, newSize;
      switch (type) {
        case 'string':
        case 'number':
          // distinguish between +0 and -0
          if (item === 0 && 1 / item === -Infinity) {
            if (set._items['-0']) {
              return true;
            } else {
              if (shouldAdd) {
                set._items['-0'] = true;
              }
              return false;
            }
          }
          // these types can all utilise the native Set
          if (set._nativeSet !== null) {
            if (shouldAdd) {
              prevSize = set._nativeSet.size;
              set._nativeSet.add(item);
              newSize = set._nativeSet.size;
              return newSize === prevSize;
            } else {
              return set._nativeSet.has(item);
            }
          } else {
            if (!(type in set._items)) {
              if (shouldAdd) {
                set._items[type] = {};
                set._items[type][item] = true;
              }
              return false;
            } else if (item in set._items[type]) {
              return true;
            } else {
              if (shouldAdd) {
                set._items[type][item] = true;
              }
              return false;
            }
          }

        case 'boolean':
          // set._items['boolean'] holds a two element array
          // representing [ falseExists, trueExists ]
          if (type in set._items) {
            var bIdx = item ? 1 : 0;
            if (set._items[type][bIdx]) {
              return true;
            } else {
              if (shouldAdd) {
                set._items[type][bIdx] = true;
              }
              return false;
            }
          } else {
            if (shouldAdd) {
              set._items[type] = item ? [false, true] : [true, false];
            }
            return false;
          }

        case 'function':
          // compare functions for reference equality
          if (set._nativeSet !== null) {
            if (shouldAdd) {
              prevSize = set._nativeSet.size;
              set._nativeSet.add(item);
              newSize = set._nativeSet.size;
              return newSize === prevSize;
            } else {
              return set._nativeSet.has(item);
            }
          } else {
            if (!(type in set._items)) {
              if (shouldAdd) {
                set._items[type] = [item];
              }
              return false;
            }
            if (!_includes(item, set._items[type])) {
              if (shouldAdd) {
                set._items[type].push(item);
              }
              return false;
            }
            return true;
          }

        case 'undefined':
          if (set._items[type]) {
            return true;
          } else {
            if (shouldAdd) {
              set._items[type] = true;
            }
            return false;
          }

        case 'object':
          if (item === null) {
            if (!set._items['null']) {
              if (shouldAdd) {
                set._items['null'] = true;
              }
              return false;
            }
            return true;
          }
        /* falls through */
        default:
          // reduce the search size of heterogeneous sets by creating buckets
          // for each type.
          type = Object.prototype.toString.call(item);
          if (!(type in set._items)) {
            if (shouldAdd) {
              set._items[type] = [item];
            }
            return false;
          }
          // scan through all previously applied items
          if (!_includes(item, set._items[type])) {
            if (shouldAdd) {
              set._items[type].push(item);
            }
            return false;
          }
          return true;
      }
    }

    /**
     * Finds the set (i.e. no duplicates) of all elements in the first list not
     * contained in the second list. Objects and Arrays are compared in terms of
     * value equality, not reference equality.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category Relation
     * @sig [*] -> [*] -> [*]
     * @param {Array} list1 The first list.
     * @param {Array} list2 The second list.
     * @return {Array} The elements in `list1` that are not in `list2`.
     * @see R.differenceWith, R.symmetricDifference, R.symmetricDifferenceWith, R.without
     * @example
     *
     *      R.difference([1,2,3,4], [7,6,5,4,3]); //=> [1,2]
     *      R.difference([7,6,5,4,3], [1,2,3,4]); //=> [7,6,5]
     *      R.difference([{a: 1}, {b: 2}], [{a: 1}, {c: 3}]) //=> [{b: 2}]
     */
    var difference = /*#__PURE__*/_curry2(function difference(first, second) {
      var out = [];
      var idx = 0;
      var firstLen = first.length;
      var secondLen = second.length;
      var toFilterOut = new _Set();

      for (var i = 0; i < secondLen; i += 1) {
        toFilterOut.add(second[i]);
      }

      while (idx < firstLen) {
        if (toFilterOut.add(first[idx])) {
          out[out.length] = first[idx];
        }
        idx += 1;
      }
      return out;
    });

    /**
     * Returns a new function much like the supplied one, except that the first two
     * arguments' order is reversed.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category Function
     * @sig ((a, b, c, ...) -> z) -> (b -> a -> c -> ... -> z)
     * @param {Function} fn The function to invoke with its first two parameters reversed.
     * @return {*} The result of invoking `fn` with its first two parameters' order reversed.
     * @example
     *
     *      const mergeThree = (a, b, c) => [].concat(a, b, c);
     *
     *      mergeThree(1, 2, 3); //=> [1, 2, 3]
     *
     *      R.flip(mergeThree)(1, 2, 3); //=> [2, 1, 3]
     * @symb R.flip(f)(a, b, c) = f(b, a, c)
     */
    var flip = /*#__PURE__*/_curry1(function flip(fn) {
      return curryN(fn.length, function (a, b) {
        var args = Array.prototype.slice.call(arguments, 0);
        args[0] = b;
        args[1] = a;
        return fn.apply(this, args);
      });
    });

    /**
     * Returns `true` if the specified value is equal, in [`R.equals`](#equals)
     * terms, to at least one element of the given list; `false` otherwise.
     * Works also with strings.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category List
     * @sig a -> [a] -> Boolean
     * @param {Object} a The item to compare against.
     * @param {Array} list The array to consider.
     * @return {Boolean} `true` if an equivalent item is in the list, `false` otherwise.
     * @see R.any
     * @example
     *
     *      R.includes(3, [1, 2, 3]); //=> true
     *      R.includes(4, [1, 2, 3]); //=> false
     *      R.includes({ name: 'Fred' }, [{ name: 'Fred' }]); //=> true
     *      R.includes([42], [[42]]); //=> true
     *      R.includes('ba', 'banana'); //=>true
     */
    var includes = /*#__PURE__*/_curry2(_includes);

    /**
     * Turns a named method with a specified arity into a function that can be
     * called directly supplied with arguments and a target object.
     *
     * The returned function is curried and accepts `arity + 1` parameters where
     * the final parameter is the target object.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category Function
     * @sig Number -> String -> (a -> b -> ... -> n -> Object -> *)
     * @param {Number} arity Number of arguments the returned function should take
     *        before the target object.
     * @param {String} method Name of the method to call.
     * @return {Function} A new curried function.
     * @see R.construct
     * @example
     *
     *      const sliceFrom = R.invoker(1, 'slice');
     *      sliceFrom(6, 'abcdefghijklm'); //=> 'ghijklm'
     *      const sliceFrom6 = R.invoker(2, 'slice')(6);
     *      sliceFrom6(8, 'abcdefghijklm'); //=> 'gh'
     * @symb R.invoker(0, 'method')(o) = o['method']()
     * @symb R.invoker(1, 'method')(a, o) = o['method'](a)
     * @symb R.invoker(2, 'method')(a, b, o) = o['method'](a, b)
     */
    var invoker = /*#__PURE__*/_curry2(function invoker(arity, method) {
      return curryN(arity + 1, function () {
        var target = arguments[arity];
        if (target != null && _isFunction(target[method])) {
          return target[method].apply(target, Array.prototype.slice.call(arguments, 0, arity));
        }
        throw new TypeError(toString$1(target) + ' does not have a method named "' + method + '"');
      });
    });

    /**
     * Returns a string made by inserting the `separator` between each element and
     * concatenating all the elements into a single string.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category List
     * @sig String -> [a] -> String
     * @param {Number|String} separator The string used to separate the elements.
     * @param {Array} xs The elements to join into a string.
     * @return {String} str The string made by concatenating `xs` with `separator`.
     * @see R.split
     * @example
     *
     *      const spacer = R.join(' ');
     *      spacer(['a', 2, 3.4]);   //=> 'a 2 3.4'
     *      R.join('|', [1, 2, 3]);    //=> '1|2|3'
     */
    var join = /*#__PURE__*/invoker(1, 'join');

    function _isNumber(x) {
      return Object.prototype.toString.call(x) === '[object Number]';
    }

    /**
     * Returns the number of elements in the array by returning `list.length`.
     *
     * @func
     * @memberOf R
     * @since v0.3.0
     * @category List
     * @sig [a] -> Number
     * @param {Array} list The array to inspect.
     * @return {Number} The length of the array.
     * @example
     *
     *      R.length([]); //=> 0
     *      R.length([1, 2, 3]); //=> 3
     */
    var length = /*#__PURE__*/_curry1(function length(list) {
      return list != null && _isNumber(list.length) ? list.length : NaN;
    });

    /**
     * Returns a new list with the given element at the front, followed by the
     * contents of the list.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category List
     * @sig a -> [a] -> [a]
     * @param {*} el The item to add to the head of the output list.
     * @param {Array} list The array to add to the tail of the output list.
     * @return {Array} A new array.
     * @see R.append
     * @example
     *
     *      R.prepend('fee', ['fi', 'fo', 'fum']); //=> ['fee', 'fi', 'fo', 'fum']
     */
    var prepend = /*#__PURE__*/_curry2(function prepend(el, list) {
      return _concat([el], list);
    });

    /**
     * Returns a list of numbers from `from` (inclusive) to `to` (exclusive).
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category List
     * @sig Number -> Number -> [Number]
     * @param {Number} from The first number in the list.
     * @param {Number} to One more than the last number in the list.
     * @return {Array} The list of numbers in the set `[a, b)`.
     * @example
     *
     *      R.range(1, 5);    //=> [1, 2, 3, 4]
     *      R.range(50, 53);  //=> [50, 51, 52]
     */
    var range = /*#__PURE__*/_curry2(function range(from, to) {
      if (!(_isNumber(from) && _isNumber(to))) {
        throw new TypeError('Both arguments to range must be numbers');
      }
      var result = [];
      var n = from;
      while (n < to) {
        result.push(n);
        n += 1;
      }
      return result;
    });

    /**
     * Calls an input function `n` times, returning an array containing the results
     * of those function calls.
     *
     * `fn` is passed one argument: The current value of `n`, which begins at `0`
     * and is gradually incremented to `n - 1`.
     *
     * @func
     * @memberOf R
     * @since v0.2.3
     * @category List
     * @sig (Number -> a) -> Number -> [a]
     * @param {Function} fn The function to invoke. Passed one argument, the current value of `n`.
     * @param {Number} n A value between `0` and `n - 1`. Increments after each function call.
     * @return {Array} An array containing the return values of all calls to `fn`.
     * @see R.repeat
     * @example
     *
     *      R.times(R.identity, 5); //=> [0, 1, 2, 3, 4]
     * @symb R.times(f, 0) = []
     * @symb R.times(f, 1) = [f(0)]
     * @symb R.times(f, 2) = [f(0), f(1)]
     */
    var times = /*#__PURE__*/_curry2(function times(fn, n) {
      var len = Number(n);
      var idx = 0;
      var list;

      if (len < 0 || isNaN(len)) {
        throw new RangeError('n must be a non-negative number');
      }
      list = new Array(len);
      while (idx < len) {
        list[idx] = fn(idx);
        idx += 1;
      }
      return list;
    });

    /**
     * Returns a fixed list of size `n` containing a specified identical value.
     *
     * @func
     * @memberOf R
     * @since v0.1.1
     * @category List
     * @sig a -> n -> [a]
     * @param {*} value The value to repeat.
     * @param {Number} n The desired size of the output list.
     * @return {Array} A new array containing `n` `value`s.
     * @see R.times
     * @example
     *
     *      R.repeat('hi', 5); //=> ['hi', 'hi', 'hi', 'hi', 'hi']
     *
     *      const obj = {};
     *      const repeatedObjs = R.repeat(obj, 5); //=> [{}, {}, {}, {}, {}]
     *      repeatedObjs[0] === repeatedObjs[1]; //=> true
     * @symb R.repeat(a, 0) = []
     * @symb R.repeat(a, 1) = [a]
     * @symb R.repeat(a, 2) = [a, a]
     */
    var repeat = /*#__PURE__*/_curry2(function repeat(value, n) {
      return times(always(value), n);
    });

    /**
     * Replace a substring or regex match in a string with a replacement.
     *
     * The first two parameters correspond to the parameters of the
     * `String.prototype.replace()` function, so the second parameter can also be a
     * function.
     *
     * @func
     * @memberOf R
     * @since v0.7.0
     * @category String
     * @sig RegExp|String -> String -> String -> String
     * @param {RegExp|String} pattern A regular expression or a substring to match.
     * @param {String} replacement The string to replace the matches with.
     * @param {String} str The String to do the search and replacement in.
     * @return {String} The result.
     * @example
     *
     *      R.replace('foo', 'bar', 'foo foo foo'); //=> 'bar foo foo'
     *      R.replace(/foo/, 'bar', 'foo foo foo'); //=> 'bar foo foo'
     *
     *      // Use the "g" (global) flag to replace all occurrences:
     *      R.replace(/foo/g, 'bar', 'foo foo foo'); //=> 'bar bar bar'
     */
    var replace = /*#__PURE__*/_curry3(function replace(regex, replacement, str) {
      return str.replace(regex, replacement);
    });

    /**
     * Returns a new list without values in the first argument.
     * [`R.equals`](#equals) is used to determine equality.
     *
     * Acts as a transducer if a transformer is given in list position.
     *
     * @func
     * @memberOf R
     * @since v0.19.0
     * @category List
     * @sig [a] -> [a] -> [a]
     * @param {Array} list1 The values to be removed from `list2`.
     * @param {Array} list2 The array to remove values from.
     * @return {Array} The new array without values in `list1`.
     * @see R.transduce, R.difference, R.remove
     * @example
     *
     *      R.without([1, 2], [1, 2, 1, 3, 4]); //=> [3, 4]
     */
    var without = /*#__PURE__*/_curry2(function (xs, list) {
      return reject(flip(_includes)(xs), list);
    });

    /* src/Components/Settings.svelte generated by Svelte v3.4.4 */

    const file = "src/Components/Settings.svelte";

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = Object.create(ctx);
    	child_ctx.U = list[i].U;
    	child_ctx.R = list[i].R;
    	child_ctx.F = list[i].F;
    	child_ctx.L = list[i].L;
    	child_ctx.Bl = list[i].Bl;
    	child_ctx.Br = list[i].Br;
    	child_ctx.each_value_1 = list;
    	child_ctx.each_index = i;
    	return child_ctx;
    }

    function get_each_context(ctx, list, i) {
    	const child_ctx = Object.create(ctx);
    	child_ctx.val = list[i];
    	child_ctx.each_value = list;
    	child_ctx.i = i;
    	return child_ctx;
    }

    // (25:2) {:else}
    function create_else_block(ctx) {
    	var p, t0_value = ctx.names[ctx.i], t0, t1, input, t2, dispose;

    	function input_input_handler() {
    		ctx.input_input_handler.call(input, ctx);
    	}

    	return {
    		c: function create() {
    			p = element("p");
    			t0 = text(t0_value);
    			t1 = text(":\n      ");
    			input = element("input");
    			t2 = space();
    			attr(input, "type", "number");
    			input.min = "0";
    			add_location(input, file, 27, 6, 534);
    			add_location(p, file, 25, 4, 506);
    			dispose = listen(input, "input", input_input_handler);
    		},

    		m: function mount(target, anchor) {
    			insert(target, p, anchor);
    			append(p, t0);
    			append(p, t1);
    			append(p, input);

    			input.value = ctx.val;

    			append(p, t2);
    		},

    		p: function update(changed, new_ctx) {
    			ctx = new_ctx;
    			if (changed.value) input.value = ctx.val;
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(p);
    			}

    			dispose();
    		}
    	};
    }

    // (8:2) {#if names[i] === 'Color Scheme'}
    function create_if_block(ctx) {
    	var each_1_anchor;

    	var each_value_1 = [ctx.val];

    	var each_blocks = [];

    	for (var i = 0; i < 1; i += 1) {
    		each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	return {
    		c: function create() {
    			for (var i = 0; i < 1; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    		},

    		m: function mount(target, anchor) {
    			for (var i = 0; i < 1; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert(target, each_1_anchor, anchor);
    		},

    		p: function update(changed, ctx) {
    			if (changed.value) {
    				each_value_1 = [ctx.val];

    				for (var i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1(ctx, each_value_1, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(changed, child_ctx);
    					} else {
    						each_blocks[i] = create_each_block_1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
    					}
    				}

    				for (; i < 1; i += 1) {
    					each_blocks[i].d(1);
    				}
    			}
    		},

    		d: function destroy(detaching) {
    			destroy_each(each_blocks, detaching);

    			if (detaching) {
    				detach(each_1_anchor);
    			}
    		}
    	};
    }

    // (9:4) {#each [val] as { U, R, F, L, Bl, Br }}
    function create_each_block_1(ctx) {
    	var t0, input0, t1, input1, t2, br0, t3, input2, t4, input3, t5, br1, t6, input4, t7, input5, dispose;

    	function input0_input_handler() {
    		ctx.input0_input_handler.call(input0, ctx);
    	}

    	function input1_input_handler() {
    		ctx.input1_input_handler.call(input1, ctx);
    	}

    	function input2_input_handler() {
    		ctx.input2_input_handler.call(input2, ctx);
    	}

    	function input3_input_handler() {
    		ctx.input3_input_handler.call(input3, ctx);
    	}

    	function input4_input_handler() {
    		ctx.input4_input_handler.call(input4, ctx);
    	}

    	function input5_input_handler() {
    		ctx.input5_input_handler.call(input5, ctx);
    	}

    	return {
    		c: function create() {
    			t0 = text("U:\n      ");
    			input0 = element("input");
    			t1 = text("\n      F:\n      ");
    			input1 = element("input");
    			t2 = space();
    			br0 = element("br");
    			t3 = text("\n      R:\n      ");
    			input2 = element("input");
    			t4 = text("\n      L:\n      ");
    			input3 = element("input");
    			t5 = space();
    			br1 = element("br");
    			t6 = text("\n      Br:\n      ");
    			input4 = element("input");
    			t7 = text("\n      Bl:\n      ");
    			input5 = element("input");
    			add_location(input0, file, 10, 6, 225);
    			add_location(input1, file, 12, 6, 265);
    			add_location(br0, file, 13, 6, 296);
    			add_location(input2, file, 15, 6, 318);
    			add_location(input3, file, 17, 6, 358);
    			add_location(br1, file, 18, 6, 389);
    			add_location(input4, file, 20, 6, 412);
    			add_location(input5, file, 22, 6, 454);

    			dispose = [
    				listen(input0, "input", input0_input_handler),
    				listen(input1, "input", input1_input_handler),
    				listen(input2, "input", input2_input_handler),
    				listen(input3, "input", input3_input_handler),
    				listen(input4, "input", input4_input_handler),
    				listen(input5, "input", input5_input_handler)
    			];
    		},

    		m: function mount(target, anchor) {
    			insert(target, t0, anchor);
    			insert(target, input0, anchor);

    			input0.value = ctx.U;

    			insert(target, t1, anchor);
    			insert(target, input1, anchor);

    			input1.value = ctx.F;

    			insert(target, t2, anchor);
    			insert(target, br0, anchor);
    			insert(target, t3, anchor);
    			insert(target, input2, anchor);

    			input2.value = ctx.R;

    			insert(target, t4, anchor);
    			insert(target, input3, anchor);

    			input3.value = ctx.L;

    			insert(target, t5, anchor);
    			insert(target, br1, anchor);
    			insert(target, t6, anchor);
    			insert(target, input4, anchor);

    			input4.value = ctx.Br;

    			insert(target, t7, anchor);
    			insert(target, input5, anchor);

    			input5.value = ctx.Bl;
    		},

    		p: function update(changed, new_ctx) {
    			ctx = new_ctx;
    			if (changed.value && (input0.value !== ctx.U)) input0.value = ctx.U;
    			if (changed.value && (input1.value !== ctx.F)) input1.value = ctx.F;
    			if (changed.value && (input2.value !== ctx.R)) input2.value = ctx.R;
    			if (changed.value && (input3.value !== ctx.L)) input3.value = ctx.L;
    			if (changed.value && (input4.value !== ctx.Br)) input4.value = ctx.Br;
    			if (changed.value && (input5.value !== ctx.Bl)) input5.value = ctx.Bl;
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(t0);
    				detach(input0);
    				detach(t1);
    				detach(input1);
    				detach(t2);
    				detach(br0);
    				detach(t3);
    				detach(input2);
    				detach(t4);
    				detach(input3);
    				detach(t5);
    				detach(br1);
    				detach(t6);
    				detach(input4);
    				detach(t7);
    				detach(input5);
    			}

    			run_all(dispose);
    		}
    	};
    }

    // (7:0) {#each value as val, i}
    function create_each_block(ctx) {
    	var if_block_anchor;

    	function select_block_type(ctx) {
    		if (ctx.names[ctx.i] === 'Color Scheme') return create_if_block;
    		return create_else_block;
    	}

    	var current_block_type = select_block_type(ctx);
    	var if_block = current_block_type(ctx);

    	return {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty();
    		},

    		m: function mount(target, anchor) {
    			if_block.m(target, anchor);
    			insert(target, if_block_anchor, anchor);
    		},

    		p: function update(changed, ctx) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(changed, ctx);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);
    				if (if_block) {
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			}
    		},

    		d: function destroy(detaching) {
    			if_block.d(detaching);

    			if (detaching) {
    				detach(if_block_anchor);
    			}
    		}
    	};
    }

    function create_fragment(ctx) {
    	var each_1_anchor;

    	var each_value = ctx.value;

    	var each_blocks = [];

    	for (var i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	return {
    		c: function create() {
    			for (var i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			for (var i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert(target, each_1_anchor, anchor);
    		},

    		p: function update(changed, ctx) {
    			if (changed.names || changed.value) {
    				each_value = ctx.value;

    				for (var i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(changed, child_ctx);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}
    				each_blocks.length = each_value.length;
    			}
    		},

    		i: noop,
    		o: noop,

    		d: function destroy(detaching) {
    			destroy_each(each_blocks, detaching);

    			if (detaching) {
    				detach(each_1_anchor);
    			}
    		}
    	};
    }

    function instance($$self, $$props, $$invalidate) {
    	let { value } = $$props;

      const names = ['Timer size', 'Scramble size', 'Color Scheme'];

    	const writable_props = ['value'];
    	Object.keys($$props).forEach(key => {
    		if (!writable_props.includes(key) && !key.startsWith('$$')) console.warn(`<Settings> was created with unknown prop '${key}'`);
    	});

    	function input0_input_handler({ U, each_value_1, each_index }) {
    		each_value_1[each_index].U = this.value;
    		$$invalidate('value', value);
    	}

    	function input1_input_handler({ F, each_value_1, each_index }) {
    		each_value_1[each_index].F = this.value;
    		$$invalidate('value', value);
    	}

    	function input2_input_handler({ R, each_value_1, each_index }) {
    		each_value_1[each_index].R = this.value;
    		$$invalidate('value', value);
    	}

    	function input3_input_handler({ L, each_value_1, each_index }) {
    		each_value_1[each_index].L = this.value;
    		$$invalidate('value', value);
    	}

    	function input4_input_handler({ Br, each_value_1, each_index }) {
    		each_value_1[each_index].Br = this.value;
    		$$invalidate('value', value);
    	}

    	function input5_input_handler({ Bl, each_value_1, each_index }) {
    		each_value_1[each_index].Bl = this.value;
    		$$invalidate('value', value);
    	}

    	function input_input_handler({ val, each_value, i }) {
    		each_value[i] = to_number(this.value);
    		$$invalidate('value', value);
    	}

    	$$self.$set = $$props => {
    		if ('value' in $$props) $$invalidate('value', value = $$props.value);
    	};

    	return {
    		value,
    		names,
    		input0_input_handler,
    		input1_input_handler,
    		input2_input_handler,
    		input3_input_handler,
    		input4_input_handler,
    		input5_input_handler,
    		input_input_handler
    	};
    }

    class Settings extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, ["value"]);

    		const { ctx } = this.$$;
    		const props = options.props || {};
    		if (ctx.value === undefined && !('value' in props)) {
    			console.warn("<Settings> was created without expected prop 'value'");
    		}
    	}

    	get value() {
    		throw new Error("<Settings>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set value(value) {
    		throw new Error("<Settings>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/Components/Header.svelte generated by Svelte v3.4.4 */

    const file$1 = "src/Components/Header.svelte";

    // (178:2) {#if train}
    function create_if_block_3(ctx) {
    	var div, dispose;

    	return {
    		c: function create() {
    			div = element("div");
    			div.textContent = "Train";
    			div.className = "mode svelte-1o5ivng";
    			add_location(div, file$1, 178, 4, 3439);
    			dispose = listen(div, "click", ctx.click_handler);
    		},

    		m: function mount(target, anchor) {
    			insert(target, div, anchor);
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(div);
    			}

    			dispose();
    		}
    	};
    }

    // (181:2) {#if selection}
    function create_if_block_2(ctx) {
    	var div, dispose;

    	return {
    		c: function create() {
    			div = element("div");
    			div.textContent = "Selection";
    			div.className = "mode svelte-1o5ivng";
    			add_location(div, file$1, 181, 4, 3530);
    			dispose = listen(div, "click", ctx.click_handler_1);
    		},

    		m: function mount(target, anchor) {
    			insert(target, div, anchor);
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(div);
    			}

    			dispose();
    		}
    	};
    }

    // (187:2) {#if settingsOpen}
    function create_if_block$1(ctx) {
    	var div3, div2, div1, t, div0, updating_value, current, dispose;

    	var if_block = false;

    	function settings_value_binding(value_1) {
    		ctx.settings_value_binding.call(null, value_1);
    		updating_value = true;
    		add_flush_callback(() => updating_value = false);
    	}

    	let settings_props = {};
    	if (ctx.value !== void 0) {
    		settings_props.value = ctx.value;
    	}
    	var settings = new Settings({ props: settings_props, $$inline: true });

    	add_binding_callback(() => bind(settings, 'value', settings_value_binding));

    	return {
    		c: function create() {
    			div3 = element("div");
    			div2 = element("div");
    			div1 = element("div");
    			if (if_block) if_block.c();
    			t = space();
    			div0 = element("div");
    			settings.$$.fragment.c();
    			div0.className = "content svelte-1o5ivng";
    			add_location(div0, file$1, 196, 10, 4081);
    			div1.className = "window svelte-1o5ivng";
    			add_location(div1, file$1, 192, 8, 3935);
    			div2.className = "window-wrap svelte-1o5ivng";
    			add_location(div2, file$1, 191, 6, 3884);
    			div3.className = "bg svelte-1o5ivng";
    			add_location(div3, file$1, 187, 4, 3715);
    			dispose = listen(div3, "click", ctx.click_handler_4);
    		},

    		m: function mount(target, anchor) {
    			insert(target, div3, anchor);
    			append(div3, div2);
    			append(div2, div1);
    			if (if_block) if_block.m(div1, null);
    			append(div1, t);
    			append(div1, div0);
    			mount_component(settings, div0, null);
    			add_binding_callback(() => ctx.div2_binding(div2, null));
    			add_binding_callback(() => ctx.div3_binding(div3, null));
    			current = true;
    		},

    		p: function update(changed, ctx) {
    			if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}

    			var settings_changes = {};
    			if (!updating_value && changed.value) {
    				settings_changes.value = ctx.value;
    			}
    			settings.$set(settings_changes);

    			if (changed.items) {
    				ctx.div2_binding(null, div2);
    				ctx.div2_binding(div2, null);
    			}
    			if (changed.items) {
    				ctx.div3_binding(null, div3);
    				ctx.div3_binding(div3, null);
    			}
    		},

    		i: function intro(local) {
    			if (current) return;
    			settings.$$.fragment.i(local);

    			current = true;
    		},

    		o: function outro(local) {
    			settings.$$.fragment.o(local);
    			current = false;
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(div3);
    			}

    			if (if_block) if_block.d();

    			settings.$destroy();

    			ctx.div2_binding(null, div2);
    			ctx.div3_binding(null, div3);
    			dispose();
    		}
    	};
    }

    function create_fragment$1(ctx) {
    	var div2, div0, t1, t2, t3, div1, t5, div3, t6, current, dispose;

    	var if_block0 = (ctx.train) && create_if_block_3(ctx);

    	var if_block1 = (ctx.selection) && create_if_block_2(ctx);

    	var if_block2 = (ctx.settingsOpen) && create_if_block$1(ctx);

    	const default_slot_1 = ctx.$$slots.default;
    	const default_slot = create_slot(default_slot_1, ctx, null);

    	return {
    		c: function create() {
    			div2 = element("div");
    			div0 = element("div");
    			div0.textContent = "Megaminx PLL Trainer";
    			t1 = space();
    			if (if_block0) if_block0.c();
    			t2 = space();
    			if (if_block1) if_block1.c();
    			t3 = space();
    			div1 = element("div");
    			div1.textContent = "Settings";
    			t5 = space();
    			div3 = element("div");
    			if (if_block2) if_block2.c();
    			t6 = space();

    			if (default_slot) default_slot.c();
    			div0.className = "title svelte-1o5ivng";
    			add_location(div0, file$1, 176, 2, 3375);
    			div1.className = "mode svelte-1o5ivng";
    			add_location(div1, file$1, 183, 2, 3605);
    			div2.className = "main svelte-1o5ivng";
    			add_location(div2, file$1, 175, 0, 3354);

    			div3.className = "svelte-1o5ivng";
    			add_location(div3, file$1, 185, 0, 3684);

    			dispose = [
    				listen(window, "keyup", ctx.handleKeyup),
    				listen(div1, "click", ctx.click_handler_2)
    			];
    		},

    		l: function claim(nodes) {
    			if (default_slot) default_slot.l(div3_nodes);
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert(target, div2, anchor);
    			append(div2, div0);
    			append(div2, t1);
    			if (if_block0) if_block0.m(div2, null);
    			append(div2, t2);
    			if (if_block1) if_block1.m(div2, null);
    			append(div2, t3);
    			append(div2, div1);
    			insert(target, t5, anchor);
    			insert(target, div3, anchor);
    			if (if_block2) if_block2.m(div3, null);
    			append(div3, t6);

    			if (default_slot) {
    				default_slot.m(div3, null);
    			}

    			current = true;
    		},

    		p: function update(changed, ctx) {
    			if (ctx.train) {
    				if (!if_block0) {
    					if_block0 = create_if_block_3(ctx);
    					if_block0.c();
    					if_block0.m(div2, t2);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (ctx.selection) {
    				if (!if_block1) {
    					if_block1 = create_if_block_2(ctx);
    					if_block1.c();
    					if_block1.m(div2, t3);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (ctx.settingsOpen) {
    				if (if_block2) {
    					if_block2.p(changed, ctx);
    					if_block2.i(1);
    				} else {
    					if_block2 = create_if_block$1(ctx);
    					if_block2.c();
    					if_block2.i(1);
    					if_block2.m(div3, t6);
    				}
    			} else if (if_block2) {
    				group_outros();
    				on_outro(() => {
    					if_block2.d(1);
    					if_block2 = null;
    				});

    				if_block2.o(1);
    				check_outros();
    			}

    			if (default_slot && default_slot.p && changed.$$scope) {
    				default_slot.p(get_slot_changes(default_slot_1, ctx, changed, null), get_slot_context(default_slot_1, ctx, null));
    			}
    		},

    		i: function intro(local) {
    			if (current) return;
    			if (if_block2) if_block2.i();
    			if (default_slot && default_slot.i) default_slot.i(local);
    			current = true;
    		},

    		o: function outro(local) {
    			if (if_block2) if_block2.o();
    			if (default_slot && default_slot.o) default_slot.o(local);
    			current = false;
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(div2);
    			}

    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();

    			if (detaching) {
    				detach(t5);
    				detach(div3);
    			}

    			if (if_block2) if_block2.d();

    			if (default_slot) default_slot.d(detaching);
    			run_all(dispose);
    		}
    	};
    }

    function instance$1($$self, $$props, $$invalidate) {
    	

      let { train, selection, value, closeButton = true, closeOnEsc = true, closeOnOuterClick = true, styleBg = {}, styleWindow = {}, styleContent = {} } = $$props;

      let background;
      let wrap;

      let settingsOpen = false;

      const dispatch = createEventDispatcher();

      const changeMode = mode => dispatch('viewUpdate', { mode });

      const handleKeyup = ({ key }) => {
        if (settingsOpen && key === 'Escape') {
          $$invalidate('settingsOpen', settingsOpen = false);
        }
      };

    	const writable_props = ['train', 'selection', 'value', 'closeButton', 'closeOnEsc', 'closeOnOuterClick', 'styleBg', 'styleWindow', 'styleContent'];
    	Object.keys($$props).forEach(key => {
    		if (!writable_props.includes(key) && !key.startsWith('$$')) console.warn(`<Header> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;

    	function click_handler() {
    		return changeMode(1);
    	}

    	function click_handler_1() {
    		return changeMode(0);
    	}

    	function click_handler_2() {
    		const $$result = (settingsOpen = true);
    		$$invalidate('settingsOpen', settingsOpen);
    		return $$result;
    	}

    	function click_handler_3() {
    		const $$result = (settingsOpen = false);
    		$$invalidate('settingsOpen', settingsOpen);
    		return $$result;
    	}

    	function settings_value_binding(value_1) {
    		value = value_1;
    		$$invalidate('value', value);
    	}

    	function div2_binding($$node, check) {
    		wrap = $$node;
    		$$invalidate('wrap', wrap);
    	}

    	function div3_binding($$node, check) {
    		background = $$node;
    		$$invalidate('background', background);
    	}

    	function click_handler_4(event) {
    		const $$result = (event.target === background || event.target === wrap ? (settingsOpen = false) : '');
    		$$invalidate('settingsOpen', settingsOpen);
    		return $$result;
    	}

    	$$self.$set = $$props => {
    		if ('train' in $$props) $$invalidate('train', train = $$props.train);
    		if ('selection' in $$props) $$invalidate('selection', selection = $$props.selection);
    		if ('value' in $$props) $$invalidate('value', value = $$props.value);
    		if ('closeButton' in $$props) $$invalidate('closeButton', closeButton = $$props.closeButton);
    		if ('closeOnEsc' in $$props) $$invalidate('closeOnEsc', closeOnEsc = $$props.closeOnEsc);
    		if ('closeOnOuterClick' in $$props) $$invalidate('closeOnOuterClick', closeOnOuterClick = $$props.closeOnOuterClick);
    		if ('styleBg' in $$props) $$invalidate('styleBg', styleBg = $$props.styleBg);
    		if ('styleWindow' in $$props) $$invalidate('styleWindow', styleWindow = $$props.styleWindow);
    		if ('styleContent' in $$props) $$invalidate('styleContent', styleContent = $$props.styleContent);
    		if ('$$scope' in $$props) $$invalidate('$$scope', $$scope = $$props.$$scope);
    	};

    	return {
    		train,
    		selection,
    		value,
    		closeButton,
    		closeOnEsc,
    		closeOnOuterClick,
    		styleBg,
    		styleWindow,
    		styleContent,
    		background,
    		wrap,
    		settingsOpen,
    		changeMode,
    		handleKeyup,
    		click_handler,
    		click_handler_1,
    		click_handler_2,
    		click_handler_3,
    		settings_value_binding,
    		div2_binding,
    		div3_binding,
    		click_handler_4,
    		$$slots,
    		$$scope
    	};
    }

    class Header extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, ["train", "selection", "value", "closeButton", "closeOnEsc", "closeOnOuterClick", "styleBg", "styleWindow", "styleContent"]);

    		const { ctx } = this.$$;
    		const props = options.props || {};
    		if (ctx.train === undefined && !('train' in props)) {
    			console.warn("<Header> was created without expected prop 'train'");
    		}
    		if (ctx.selection === undefined && !('selection' in props)) {
    			console.warn("<Header> was created without expected prop 'selection'");
    		}
    		if (ctx.value === undefined && !('value' in props)) {
    			console.warn("<Header> was created without expected prop 'value'");
    		}
    	}

    	get train() {
    		throw new Error("<Header>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set train(value) {
    		throw new Error("<Header>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get selection() {
    		throw new Error("<Header>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set selection(value) {
    		throw new Error("<Header>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get value() {
    		throw new Error("<Header>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set value(value) {
    		throw new Error("<Header>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get closeButton() {
    		throw new Error("<Header>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set closeButton(value) {
    		throw new Error("<Header>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get closeOnEsc() {
    		throw new Error("<Header>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set closeOnEsc(value) {
    		throw new Error("<Header>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get closeOnOuterClick() {
    		throw new Error("<Header>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set closeOnOuterClick(value) {
    		throw new Error("<Header>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get styleBg() {
    		throw new Error("<Header>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set styleBg(value) {
    		throw new Error("<Header>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get styleWindow() {
    		throw new Error("<Header>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set styleWindow(value) {
    		throw new Error("<Header>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get styleContent() {
    		throw new Error("<Header>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set styleContent(value) {
    		throw new Error("<Header>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

    function createCommonjsModule(fn, module) {
    	return module = { exports: {} }, fn(module, module.exports), module.exports;
    }

    var dayjs_min = createCommonjsModule(function (module, exports) {
    !function(t,n){module.exports=n();}(commonjsGlobal,function(){var t="millisecond",n="second",e="minute",r="hour",i="day",s="week",u="month",o="quarter",a="year",h=/^(\d{4})-?(\d{1,2})-?(\d{0,2})[^0-9]*(\d{1,2})?:?(\d{1,2})?:?(\d{1,2})?.?(\d{1,3})?$/,f=/\[([^\]]+)]|Y{2,4}|M{1,4}|D{1,2}|d{1,4}|H{1,2}|h{1,2}|a|A|m{1,2}|s{1,2}|Z{1,2}|SSS/g,c=function(t,n,e){var r=String(t);return !r||r.length>=n?t:""+Array(n+1-r.length).join(e)+t},d={s:c,z:function(t){var n=-t.utcOffset(),e=Math.abs(n),r=Math.floor(e/60),i=e%60;return (n<=0?"+":"-")+c(r,2,"0")+":"+c(i,2,"0")},m:function(t,n){var e=12*(n.year()-t.year())+(n.month()-t.month()),r=t.clone().add(e,u),i=n-r<0,s=t.clone().add(e+(i?-1:1),u);return Number(-(e+(n-r)/(i?r-s:s-r))||0)},a:function(t){return t<0?Math.ceil(t)||0:Math.floor(t)},p:function(h){return {M:u,y:a,w:s,d:i,h:r,m:e,s:n,ms:t,Q:o}[h]||String(h||"").toLowerCase().replace(/s$/,"")},u:function(t){return void 0===t}},$={name:"en",weekdays:"Sunday_Monday_Tuesday_Wednesday_Thursday_Friday_Saturday".split("_"),months:"January_February_March_April_May_June_July_August_September_October_November_December".split("_")},l="en",m={};m[l]=$;var y=function(t){return t instanceof v},M=function(t,n,e){var r;if(!t)return null;if("string"==typeof t)m[t]&&(r=t),n&&(m[t]=n,r=t);else{var i=t.name;m[i]=t,r=i;}return e||(l=r),r},g=function(t,n,e){if(y(t))return t.clone();var r=n?"string"==typeof n?{format:n,pl:e}:n:{};return r.date=t,new v(r)},D=d;D.l=M,D.i=y,D.w=function(t,n){return g(t,{locale:n.$L,utc:n.$u})};var v=function(){function c(t){this.$L=this.$L||M(t.locale,null,!0)||l,this.parse(t);}var d=c.prototype;return d.parse=function(t){this.$d=function(t){var n=t.date,e=t.utc;if(null===n)return new Date(NaN);if(D.u(n))return new Date;if(n instanceof Date)return new Date(n);if("string"==typeof n&&!/Z$/i.test(n)){var r=n.match(h);if(r)return e?new Date(Date.UTC(r[1],r[2]-1,r[3]||1,r[4]||0,r[5]||0,r[6]||0,r[7]||0)):new Date(r[1],r[2]-1,r[3]||1,r[4]||0,r[5]||0,r[6]||0,r[7]||0)}return new Date(n)}(t),this.init();},d.init=function(){var t=this.$d;this.$y=t.getFullYear(),this.$M=t.getMonth(),this.$D=t.getDate(),this.$W=t.getDay(),this.$H=t.getHours(),this.$m=t.getMinutes(),this.$s=t.getSeconds(),this.$ms=t.getMilliseconds();},d.$utils=function(){return D},d.isValid=function(){return !("Invalid Date"===this.$d.toString())},d.isSame=function(t,n){var e=g(t);return this.startOf(n)<=e&&e<=this.endOf(n)},d.isAfter=function(t,n){return g(t)<this.startOf(n)},d.isBefore=function(t,n){return this.endOf(n)<g(t)},d.$g=function(t,n,e){return D.u(t)?this[n]:this.set(e,t)},d.year=function(t){return this.$g(t,"$y",a)},d.month=function(t){return this.$g(t,"$M",u)},d.day=function(t){return this.$g(t,"$W",i)},d.date=function(t){return this.$g(t,"$D","date")},d.hour=function(t){return this.$g(t,"$H",r)},d.minute=function(t){return this.$g(t,"$m",e)},d.second=function(t){return this.$g(t,"$s",n)},d.millisecond=function(n){return this.$g(n,"$ms",t)},d.unix=function(){return Math.floor(this.valueOf()/1e3)},d.valueOf=function(){return this.$d.getTime()},d.startOf=function(t,o){var h=this,f=!!D.u(o)||o,c=D.p(t),d=function(t,n){var e=D.w(h.$u?Date.UTC(h.$y,n,t):new Date(h.$y,n,t),h);return f?e:e.endOf(i)},$=function(t,n){return D.w(h.toDate()[t].apply(h.toDate(),(f?[0,0,0,0]:[23,59,59,999]).slice(n)),h)},l=this.$W,m=this.$M,y=this.$D,M="set"+(this.$u?"UTC":"");switch(c){case a:return f?d(1,0):d(31,11);case u:return f?d(1,m):d(0,m+1);case s:var g=this.$locale().weekStart||0,v=(l<g?l+7:l)-g;return d(f?y-v:y+(6-v),m);case i:case"date":return $(M+"Hours",0);case r:return $(M+"Minutes",1);case e:return $(M+"Seconds",2);case n:return $(M+"Milliseconds",3);default:return this.clone()}},d.endOf=function(t){return this.startOf(t,!1)},d.$set=function(s,o){var h,f=D.p(s),c="set"+(this.$u?"UTC":""),d=(h={},h[i]=c+"Date",h.date=c+"Date",h[u]=c+"Month",h[a]=c+"FullYear",h[r]=c+"Hours",h[e]=c+"Minutes",h[n]=c+"Seconds",h[t]=c+"Milliseconds",h)[f],$=f===i?this.$D+(o-this.$W):o;if(f===u||f===a){var l=this.clone().set("date",1);l.$d[d]($),l.init(),this.$d=l.set("date",Math.min(this.$D,l.daysInMonth())).toDate();}else d&&this.$d[d]($);return this.init(),this},d.set=function(t,n){return this.clone().$set(t,n)},d.get=function(t){return this[D.p(t)]()},d.add=function(t,o){var h,f=this;t=Number(t);var c=D.p(o),d=function(n){var e=g(f);return D.w(e.date(e.date()+Math.round(n*t)),f)};if(c===u)return this.set(u,this.$M+t);if(c===a)return this.set(a,this.$y+t);if(c===i)return d(1);if(c===s)return d(7);var $=(h={},h[e]=6e4,h[r]=36e5,h[n]=1e3,h)[c]||1,l=this.valueOf()+t*$;return D.w(l,this)},d.subtract=function(t,n){return this.add(-1*t,n)},d.format=function(t){var n=this;if(!this.isValid())return "Invalid Date";var e=t||"YYYY-MM-DDTHH:mm:ssZ",r=D.z(this),i=this.$locale(),s=this.$H,u=this.$m,o=this.$M,a=i.weekdays,h=i.months,c=function(t,r,i,s){return t&&(t[r]||t(n,e))||i[r].substr(0,s)},d=function(t){return D.s(s%12||12,t,"0")},$=i.meridiem||function(t,n,e){var r=t<12?"AM":"PM";return e?r.toLowerCase():r},l={YY:String(this.$y).slice(-2),YYYY:this.$y,M:o+1,MM:D.s(o+1,2,"0"),MMM:c(i.monthsShort,o,h,3),MMMM:h[o]||h(this,e),D:this.$D,DD:D.s(this.$D,2,"0"),d:String(this.$W),dd:c(i.weekdaysMin,this.$W,a,2),ddd:c(i.weekdaysShort,this.$W,a,3),dddd:a[this.$W],H:String(s),HH:D.s(s,2,"0"),h:d(1),hh:d(2),a:$(s,u,!0),A:$(s,u,!1),m:String(u),mm:D.s(u,2,"0"),s:String(this.$s),ss:D.s(this.$s,2,"0"),SSS:D.s(this.$ms,3,"0"),Z:r};return e.replace(f,function(t,n){return n||l[t]||r.replace(":","")})},d.utcOffset=function(){return 15*-Math.round(this.$d.getTimezoneOffset()/15)},d.diff=function(t,h,f){var c,d=D.p(h),$=g(t),l=6e4*($.utcOffset()-this.utcOffset()),m=this-$,y=D.m(this,$);return y=(c={},c[a]=y/12,c[u]=y,c[o]=y/3,c[s]=(m-l)/6048e5,c[i]=(m-l)/864e5,c[r]=m/36e5,c[e]=m/6e4,c[n]=m/1e3,c)[d]||m,f?y:D.a(y)},d.daysInMonth=function(){return this.endOf(u).$D},d.$locale=function(){return m[this.$L]},d.locale=function(t,n){if(!t)return this.$L;var e=this.clone();return e.$L=M(t,n,!0),e},d.clone=function(){return D.w(this.toDate(),this)},d.toDate=function(){return new Date(this.$d)},d.toJSON=function(){return this.toISOString()},d.toISOString=function(){return this.$d.toISOString()},d.toString=function(){return this.$d.toUTCString()},c}();return g.prototype=v.prototype,g.extend=function(t,n){return t(n,v,g),g},g.locale=M,g.isDayjs=y,g.unix=function(t){return g(1e3*t)},g.en=m[l],g.Ls=m,g});
    });

    /* src/Components/Timer.svelte generated by Svelte v3.4.4 */

    const file$2 = "src/Components/Timer.svelte";

    function create_fragment$2(ctx) {
    	var div, t, dispose;

    	return {
    		c: function create() {
    			div = element("div");
    			t = text(ctx.timerText);
    			set_style(div, "font-size", "" + ctx.timerSize + "px");
    			div.className = "svelte-1ldy9ob";
    			toggle_class(div, "green", ctx.green);
    			toggle_class(div, "red", ctx.red);
    			add_location(div, file$2, 105, 0, 2001);

    			dispose = [
    				listen(window, "keydown", ctx.down),
    				listen(window, "keyup", ctx.up),
    				listen(div, "touchstart", ctx.touchstart_handler, { passive: true }),
    				listen(div, "touchend", ctx.touchend_handler, { passive: true })
    			];
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert(target, div, anchor);
    			append(div, t);
    		},

    		p: function update(changed, ctx) {
    			if (changed.timerText) {
    				set_data(t, ctx.timerText);
    			}

    			if (changed.timerSize) {
    				set_style(div, "font-size", "" + ctx.timerSize + "px");
    			}

    			if (changed.green) {
    				toggle_class(div, "green", ctx.green);
    			}

    			if (changed.red) {
    				toggle_class(div, "red", ctx.red);
    			}
    		},

    		i: noop,
    		o: noop,

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(div);
    			}

    			run_all(dispose);
    		}
    	};
    }

    function instance$2($$self, $$props, $$invalidate) {
    	

      const dispatch = createEventDispatcher();
      const updateTimesArray = () => dispatch('newTime', { time: timerText });

      let { value } = $$props;

      let startTime;
      let timeout;
      let allowed = true;
      let green = false;
      let red = false;
      let running = false;
      let timerText = 'Ready';
      let waiting = false;

      const msToTime = t => {
        const time = Number(t);

        const min = Math.floor(time / (60 * 1000));
        let s = ((time - min * 60 * 1000) / 1000).toFixed(2);
        if (min > 0 && s.length === 4) {
          s = '0' + s;
        }

        return `${min ? min + ':' : ''}${s}`;
      };

      const displayTime = () => { const $$result = (timerText = msToTime(dayjs_min().diff(startTime))); $$invalidate('timerText', timerText); return $$result; };

      const startTimer = () => {
        running = true;
        timeout = setInterval(displayTime, 10);
        startTime = dayjs_min();
        $$invalidate('green', green = false);
      };

      const stopTimer = () => {
        running = false;
        waiting = true;
        $$invalidate('red', red = true);
        clearTimeout(timeout);

        $$invalidate('timerText', timerText = msToTime(dayjs_min().diff(startTime)));
        updateTimesArray();
      };

      const timerSetReady = () => {
        waiting = false;
        $$invalidate('timerText', timerText = '0.00');
        $$invalidate('green', green = true);
      };

      const timerAfterStop = () => {
        $$invalidate('red', red = false);
      };

      const down = event => {
        if (!allowed) {
          return;
        }
        if (running) {
          stopTimer();
        } else if (event.code === 'Space') {
          timerSetReady();
        }
        allowed = false;
      };

      const up = event => {
        if (!running && !waiting && event.code === 'Space') {
          startTimer();
        } else {
          timerAfterStop();
        }
        allowed = true;
      };

    	const writable_props = ['value'];
    	Object.keys($$props).forEach(key => {
    		if (!writable_props.includes(key) && !key.startsWith('$$')) console.warn(`<Timer> was created with unknown prop '${key}'`);
    	});

    	function touchstart_handler() {
    		return down({ code: 'Space' });
    	}

    	function touchend_handler() {
    		return up({ code: 'Space' });
    	}

    	$$self.$set = $$props => {
    		if ('value' in $$props) $$invalidate('value', value = $$props.value);
    	};

    	let timerSize;

    	$$self.$$.update = ($$dirty = { value: 1 }) => {
    		if ($$dirty.value) { $$invalidate('timerSize', timerSize = nth(0, value) || 50); }
    	};

    	return {
    		value,
    		green,
    		red,
    		timerText,
    		down,
    		up,
    		timerSize,
    		touchstart_handler,
    		touchend_handler
    	};
    }

    class Timer extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, ["value"]);

    		const { ctx } = this.$$;
    		const props = options.props || {};
    		if (ctx.value === undefined && !('value' in props)) {
    			console.warn("<Timer> was created without expected prop 'value'");
    		}
    	}

    	get value() {
    		throw new Error("<Timer>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set value(value) {
    		throw new Error("<Timer>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    //TODO: Fix E2
    const algGroup = [
      {
        name: 'CPLL',
        cases: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
      },
      {
        name: 'EPLL',
        cases: [15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25],
      },
      {
        name: '1x3 Line',
        cases: [
          26,
          27,
          28,
          29,
          30,
          31,
          32,
          33,
          34,
          35,
          36,
          37,
          38,
          39,
          40,
          41,
          42,
          43,
          44,
        ],
      },
      {
        name: '2x2 Block',
        cases: [45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59],
      },
      {
        name: 'R Block',
        cases: [
          60,
          61,
          62,
          63,
          64,
          65,
          66,
          67,
          68,
          69,
          70,
          71,
          72,
          73,
          74,
          75,
          76,
          77,
          78,
          79,
        ],
      },
    ];

    const algInfo = [
      {
        name: 'A1+',
        state: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          1,
          1,
          3,
          4,
          2,
          1,
          2,
          3,
          2,
          3,
          4,
          4,
          5,
          5,
          5,
        ],
      },
      {
        name: 'A1-',
        state: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          1,
          1,
          2,
          3,
          2,
          3,
          4,
          3,
          1,
          2,
          4,
          4,
          5,
          5,
          5,
        ],
      },
      {
        name: 'A2+',
        state: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          4,
          1,
          1,
          2,
          2,
          5,
          1,
          3,
          2,
          3,
          4,
          4,
          5,
          5,
          3,
        ],
      },
      {
        name: 'A2-',
        state: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          3,
          1,
          1,
          2,
          2,
          3,
          4,
          3,
          5,
          1,
          4,
          4,
          5,
          5,
          2,
        ],
      },
      {
        name: 'E1',
        state: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          1,
          1,
          2,
          3,
          2,
          1,
          2,
          3,
          4,
          5,
          4,
          3,
          4,
          5,
          5,
        ],
      },
      {
        name: 'E2',
        state: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          1,
          1,
          4,
          5,
          2,
          3,
          4,
          3,
          2,
          3,
          4,
          1,
          2,
          5,
          5,
        ],
      },
      {
        name: 'E3',
        state: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          1,
          1,
          3,
          4,
          2,
          4,
          5,
          3,
          1,
          2,
          4,
          2,
          3,
          5,
          5,
        ],
      },
      {
        name: 'K1+',
        state: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          4,
          1,
          5,
          1,
          2,
          4,
          5,
          3,
          2,
          3,
          4,
          1,
          2,
          5,
          3,
        ],
      },
      {
        name: 'K1-',
        state: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          3,
          1,
          4,
          5,
          2,
          3,
          4,
          3,
          1,
          2,
          4,
          5,
          1,
          5,
          2,
        ],
      },
      {
        name: 'K2+',
        state: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          5,
          1,
          2,
          3,
          2,
          3,
          4,
          3,
          5,
          1,
          4,
          1,
          2,
          5,
          4,
        ],
      },
      {
        name: 'K2-',
        state: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          2,
          1,
          4,
          5,
          2,
          5,
          1,
          3,
          2,
          3,
          4,
          3,
          4,
          5,
          1,
        ],
      },
      {
        name: 'H1+',
        state: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          2,
          1,
          2,
          3,
          2,
          3,
          4,
          3,
          4,
          5,
          4,
          5,
          1,
          5,
          1,
        ],
      },
      {
        name: 'H1-',
        state: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          5,
          1,
          5,
          1,
          2,
          1,
          2,
          3,
          2,
          3,
          4,
          3,
          4,
          5,
          4,
        ],
      },
      {
        name: 'H2+',
        state: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          3,
          1,
          3,
          4,
          2,
          4,
          5,
          3,
          5,
          1,
          4,
          1,
          2,
          5,
          2,
        ],
      },
      {
        name: 'H2-',
        state: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          4,
          1,
          4,
          5,
          2,
          5,
          1,
          3,
          1,
          2,
          4,
          2,
          3,
          5,
          3,
        ],
      },
      {
        name: 'Q1+',
        state: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          1,
          5,
          1,
          2,
          3,
          2,
          3,
          1,
          3,
          4,
          2,
          4,
          5,
          4,
          5,
        ],
      },
      {
        name: 'Q1-',
        state: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          1,
          3,
          1,
          2,
          1,
          2,
          3,
          4,
          3,
          4,
          5,
          4,
          5,
          2,
          5,
        ],
      },
      {
        name: 'Q2+',
        state: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          1,
          3,
          1,
          2,
          1,
          2,
          3,
          5,
          3,
          4,
          2,
          4,
          5,
          4,
          5,
        ],
      },
      {
        name: 'Q2-',
        state: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          1,
          3,
          1,
          2,
          5,
          2,
          3,
          4,
          3,
          4,
          2,
          4,
          5,
          1,
          5,
        ],
      },
      {
        name: 'U1+',
        state: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          1,
          5,
          1,
          2,
          1,
          2,
          3,
          3,
          3,
          4,
          4,
          4,
          5,
          2,
          5,
        ],
      },
      {
        name: 'U1-',
        state: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          1,
          2,
          1,
          2,
          5,
          2,
          3,
          3,
          3,
          4,
          4,
          4,
          5,
          1,
          5,
        ],
      },
      {
        name: 'U2+',
        state: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          1,
          1,
          1,
          2,
          5,
          2,
          3,
          3,
          3,
          4,
          2,
          4,
          5,
          4,
          5,
        ],
      },
      {
        name: 'U2-',
        state: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          1,
          1,
          1,
          2,
          4,
          2,
          3,
          3,
          3,
          4,
          5,
          4,
          5,
          2,
          5,
        ],
      },
      {
        name: 'Z1',
        state: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          1,
          2,
          1,
          2,
          1,
          2,
          3,
          3,
          3,
          4,
          5,
          4,
          5,
          4,
          5,
        ],
      },
      {
        name: 'Z2',
        state: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          1,
          5,
          1,
          2,
          4,
          2,
          3,
          3,
          3,
          4,
          2,
          4,
          5,
          1,
          5,
        ],
      },
      {
        name: 'Z3',
        state: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          1,
          4,
          1,
          2,
          5,
          2,
          3,
          3,
          3,
          4,
          1,
          4,
          5,
          2,
          5,
        ],
      },
      {
        name: 'D+',
        state: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          1,
          1,
          3,
          4,
          4,
          4,
          5,
          2,
          1,
          2,
          3,
          2,
          3,
          5,
          5,
        ],
      },
      {
        name: 'D-',
        state: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          1,
          1,
          3,
          4,
          3,
          4,
          5,
          4,
          1,
          2,
          2,
          2,
          3,
          5,
          5,
        ],
      },
      {
        name: 'F1+',
        state: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          1,
          2,
          2,
          3,
          1,
          3,
          4,
          4,
          1,
          2,
          3,
          4,
          5,
          5,
          5,
        ],
      },
      {
        name: 'F1-',
        state: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          1,
          2,
          3,
          4,
          1,
          1,
          2,
          4,
          2,
          3,
          3,
          4,
          5,
          5,
          5,
        ],
      },
      {
        name: 'F2+',
        state: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          1,
          2,
          2,
          3,
          4,
          3,
          4,
          3,
          1,
          2,
          1,
          4,
          5,
          5,
          5,
        ],
      },
      {
        name: 'F2-',
        state: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          1,
          4,
          3,
          4,
          2,
          1,
          2,
          1,
          2,
          3,
          3,
          4,
          5,
          5,
          5,
        ],
      },
      {
        name: 'F3+',
        state: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          1,
          4,
          3,
          4,
          1,
          1,
          2,
          3,
          2,
          3,
          2,
          4,
          5,
          5,
          5,
        ],
      },
      {
        name: 'F3-',
        state: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          1,
          3,
          2,
          3,
          2,
          3,
          4,
          4,
          1,
          2,
          1,
          4,
          5,
          5,
          5,
        ],
      },
      {
        name: 'F4+',
        state: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          1,
          3,
          3,
          4,
          2,
          1,
          2,
          4,
          2,
          3,
          1,
          4,
          5,
          5,
          5,
        ],
      },
      {
        name: 'F4-',
        state: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          1,
          4,
          2,
          3,
          1,
          3,
          4,
          3,
          1,
          2,
          2,
          4,
          5,
          5,
          5,
        ],
      },
      {
        name: 'F5+',
        state: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          1,
          4,
          2,
          3,
          2,
          3,
          4,
          1,
          1,
          2,
          3,
          4,
          5,
          5,
          5,
        ],
      },
      {
        name: 'F5-',
        state: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          1,
          2,
          3,
          4,
          4,
          1,
          2,
          3,
          2,
          3,
          1,
          4,
          5,
          5,
          5,
        ],
      },
      {
        name: 'J1+',
        state: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          1,
          1,
          1,
          2,
          4,
          4,
          5,
          2,
          2,
          3,
          3,
          3,
          4,
          5,
          5,
        ],
      },
      {
        name: 'J1-',
        state: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          1,
          1,
          1,
          2,
          2,
          3,
          4,
          4,
          4,
          5,
          5,
          2,
          3,
          3,
          5,
        ],
      },
      {
        name: 'J2+',
        state: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          1,
          1,
          1,
          2,
          3,
          4,
          5,
          4,
          2,
          3,
          2,
          3,
          4,
          5,
          5,
        ],
      },
      {
        name: 'J2-',
        state: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          1,
          1,
          1,
          2,
          2,
          3,
          4,
          5,
          4,
          5,
          3,
          2,
          3,
          4,
          5,
        ],
      },
      {
        name: 'J3+',
        state: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          1,
          1,
          1,
          2,
          4,
          3,
          4,
          2,
          4,
          5,
          3,
          2,
          3,
          5,
          5,
        ],
      },
      {
        name: 'J3-',
        state: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          1,
          1,
          1,
          2,
          2,
          4,
          5,
          4,
          2,
          3,
          5,
          3,
          4,
          3,
          5,
        ],
      },
      {
        name: 'M',
        state: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          1,
          1,
          1,
          2,
          5,
          3,
          4,
          4,
          4,
          5,
          3,
          2,
          3,
          2,
          5,
        ],
      },
      {
        name: 'V1+',
        state: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          1,
          1,
          4,
          5,
          4,
          2,
          3,
          2,
          1,
          2,
          3,
          3,
          4,
          5,
          5,
        ],
      },
      {
        name: 'V1-',
        state: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          1,
          1,
          2,
          3,
          3,
          4,
          5,
          4,
          3,
          4,
          2,
          1,
          2,
          5,
          5,
        ],
      },
      {
        name: 'V2+',
        state: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          1,
          1,
          3,
          4,
          3,
          2,
          3,
          4,
          4,
          5,
          2,
          1,
          2,
          5,
          5,
        ],
      },
      {
        name: 'V2-',
        state: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          1,
          1,
          4,
          5,
          4,
          1,
          2,
          2,
          3,
          4,
          3,
          2,
          3,
          5,
          5,
        ],
      },
      {
        name: 'V3+',
        state: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          1,
          1,
          4,
          5,
          3,
          1,
          2,
          4,
          3,
          4,
          2,
          2,
          3,
          5,
          5,
        ],
      },
      {
        name: 'V3-',
        state: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          1,
          1,
          3,
          4,
          4,
          2,
          3,
          2,
          4,
          5,
          3,
          1,
          2,
          5,
          5,
        ],
      },
      {
        name: 'V4+',
        state: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          1,
          1,
          2,
          3,
          4,
          4,
          5,
          2,
          3,
          4,
          3,
          1,
          2,
          5,
          5,
        ],
      },
      {
        name: 'V4-',
        state: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          1,
          1,
          4,
          5,
          3,
          2,
          3,
          4,
          1,
          2,
          2,
          3,
          4,
          5,
          5,
        ],
      },
      {
        name: 'W',
        state: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          1,
          1,
          4,
          5,
          4,
          3,
          4,
          2,
          2,
          3,
          3,
          1,
          2,
          5,
          5,
        ],
      },
      {
        name: 'Y1+',
        state: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          1,
          1,
          3,
          4,
          2,
          2,
          3,
          4,
          4,
          5,
          5,
          1,
          2,
          3,
          5,
        ],
      },
      {
        name: 'Y1-',
        state: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          1,
          1,
          4,
          5,
          2,
          2,
          3,
          5,
          1,
          2,
          3,
          3,
          4,
          4,
          5,
        ],
      },
      {
        name: 'Y2+',
        state: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          1,
          1,
          3,
          4,
          2,
          2,
          3,
          5,
          4,
          5,
          3,
          1,
          2,
          4,
          5,
        ],
      },
      {
        name: 'Y2-',
        state: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          1,
          1,
          4,
          5,
          2,
          2,
          3,
          4,
          1,
          2,
          5,
          3,
          4,
          3,
          5,
        ],
      },
      {
        name: 'Y3+',
        state: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          1,
          1,
          4,
          5,
          3,
          3,
          4,
          2,
          2,
          3,
          5,
          1,
          2,
          4,
          5,
        ],
      },
      {
        name: 'Y3-',
        state: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          1,
          1,
          4,
          5,
          3,
          3,
          4,
          5,
          2,
          3,
          4,
          1,
          2,
          2,
          5,
        ],
      },
      {
        name: 'B1+',
        state: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          1,
          2,
          1,
          2,
          3,
          3,
          4,
          1,
          4,
          5,
          4,
          2,
          3,
          5,
          5,
        ],
      },
      {
        name: 'B1-',
        state: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          1,
          4,
          1,
          2,
          2,
          3,
          4,
          3,
          4,
          5,
          5,
          2,
          3,
          1,
          5,
        ],
      },
      {
        name: 'B2+',
        state: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          1,
          4,
          1,
          2,
          3,
          3,
          4,
          2,
          4,
          5,
          1,
          2,
          3,
          5,
          5,
        ],
      },
      {
        name: 'B2-',
        state: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          1,
          3,
          1,
          2,
          2,
          3,
          4,
          1,
          4,
          5,
          5,
          2,
          3,
          4,
          5,
        ],
      },
      {
        name: 'P1+',
        state: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          5,
          1,
          1,
          2,
          3,
          2,
          3,
          4,
          5,
          1,
          2,
          3,
          4,
          5,
          4,
        ],
      },
      {
        name: 'P1-',
        state: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          1,
          1,
          2,
          3,
          2,
          3,
          4,
          5,
          1,
          2,
          3,
          4,
          5,
          4,
          5,
        ],
      },
      {
        name: 'P2+',
        state: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          4,
          1,
          1,
          2,
          4,
          2,
          3,
          2,
          4,
          5,
          3,
          5,
          1,
          5,
          3,
        ],
      },
      {
        name: 'P2-',
        state: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          4,
          1,
          5,
          1,
          4,
          1,
          2,
          2,
          4,
          5,
          3,
          2,
          3,
          5,
          3,
        ],
      },
      {
        name: 'P3+',
        state: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          3,
          1,
          5,
          1,
          5,
          1,
          2,
          3,
          3,
          4,
          2,
          4,
          5,
          4,
          2,
        ],
      },
      {
        name: 'P3-',
        state: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          1,
          1,
          2,
          3,
          4,
          3,
          4,
          3,
          1,
          2,
          5,
          4,
          5,
          2,
          5,
        ],
      },
      {
        name: 'P4+',
        state: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          2,
          1,
          2,
          3,
          4,
          5,
          1,
          3,
          3,
          4,
          5,
          4,
          5,
          2,
          1,
        ],
      },
      {
        name: 'P4-',
        state: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          1,
          1,
          3,
          4,
          5,
          1,
          2,
          3,
          2,
          3,
          2,
          4,
          5,
          4,
          5,
        ],
      },
      {
        name: 'R1+',
        state: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          1,
          2,
          1,
          2,
          4,
          4,
          5,
          3,
          2,
          3,
          1,
          3,
          4,
          5,
          5,
        ],
      },
      {
        name: 'R1-',
        state: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          2,
          1,
          4,
          5,
          5,
          2,
          3,
          2,
          3,
          4,
          4,
          5,
          1,
          3,
          1,
        ],
      },
      {
        name: 'R2+',
        state: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          1,
          4,
          1,
          2,
          1,
          3,
          4,
          3,
          4,
          5,
          2,
          2,
          3,
          5,
          5,
        ],
      },
      {
        name: 'R2-',
        state: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          1,
          2,
          1,
          2,
          4,
          3,
          4,
          1,
          4,
          5,
          5,
          2,
          3,
          3,
          5,
        ],
      },
      {
        name: 'R3+',
        state: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          1,
          5,
          1,
          2,
          3,
          3,
          4,
          1,
          4,
          5,
          2,
          2,
          3,
          4,
          5,
        ],
      },
      {
        name: 'R3-',
        state: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          3,
          1,
          3,
          4,
          4,
          5,
          1,
          2,
          1,
          2,
          3,
          4,
          5,
          5,
          2,
        ],
      },
      {
        name: 'R4+',
        state: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          4,
          1,
          5,
          1,
          3,
          1,
          2,
          4,
          4,
          5,
          2,
          2,
          3,
          5,
          3,
        ],
      },
      {
        name: 'R4-',
        state: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          1,
          1,
          3,
          4,
          1,
          4,
          5,
          4,
          1,
          2,
          5,
          2,
          3,
          3,
          5,
        ],
      },
    ];

    const megaPllMap = [
      [
        "R U R2' U2' R U2 R U R' U2 R' U2' R2 U2' R'",
        "R U R' U2 R2' U' R2 U' R U R2 U R2' U2 R'",
        "R2 U R2 U2' R2 U2 R U R' U2 R2' U2' R2' U2' R2'",
        "R U R' U2 R2' U' R2 U' R U' R' U2 R2' U R2",
        "R U R' U2 R' U' R U' R U' R' U2 R' U R",
        "R2 U R2' U2 R' U' R U' R2 U' R2' U2 R' U R",
        "R' U2 R' U2' R2 U R U2' R2 U2' R U2 R2 U2 R'",
        "R' U2 R' U2' R2 U R U' R2 U2 R U2' R2 U R'",
        "R U2' R' U' R2 U2' R2' U' R2 U2' R2' U' R U2' R'",
        "R U2' R' U' R2' U2' R2 U' R2' U2' R2 U' R U2' R'",
        "R2 U2' R2' U' R2 U2' R2' U' R2 U2' R2' U' R2 U2' R2'",
        "R2 U2' R2' U' R2 U2' R2' U' R2' U2' R2 U' R2' U2' R2",
        "R2 U2' R2' U' R2' U2' R2 U' R2' U2' R2 U' R2 U2' R2'",
        "R2' U2' R2 U' R2 U2' R2' U' R2 U2' R2' U' R2' U2' R2",
        "R2' U2' R2 U' R2' U2' R2 U' R2 U2' R2' U' R2 U2' R2'",
        "R2' U2' R2 U' R2' U2' R2 U' R2' U2' R2 U' R2' U2' R2",
        "R' U2' R U' R2 U2' R2' U' R2 U2' R2' U' R' U2' R",
        "R' U2' R U' R2' U2' R2 U' R2' U2' R2 U' R' U2' R",
        "R' U R2 U2' R U2 R2 U' R U R2 U2' R' U2 R'",
        "R' U2 R2 U2 R U2' R2 U2' R U R2 U2' R' U2 R'",
      ],
      [
        "R U2 R2' U2 R U2' R U' R' U2' R' U2 R2 U' R'",
        "R U2' R2 U' R2' U' R' U R2' U R2 U2' R U' R'",
        "R2 U2 R2 U2 R2 U2' R U' R' U2' R2' U2 R2' U' R2'",
        "R U2' R2' U2' R' U2 R2' U2 R' U' R2' U2 R U2' R",
        "R U' R2' U2 R' U2' R2' U R' U' R2' U2 R U2' R",
        "R2' U' R2 U2' R U R' U R2' U R2 U2' R U' R'",
        "R' U' R U2' R U R' U R' U R U2' R U' R'",
        "R' U' R U2' R2 U R2' U R' U R U2' R2 U' R2'",
        "R U2 R' U R2 U2 R2' U R2 U2 R2' U R U2 R'",
        "R U2 R' U R2' U2 R2 U R2' U2 R2 U R U2 R'",
        "R2 U2 R2' U R2 U2 R2' U R2 U2 R2' U R2 U2 R2'",
        "R2 U2 R2' U R2 U2 R2' U R2' U2 R2 U R2' U2 R2",
        "R2 U2 R2' U R2' U2 R2 U R2' U2 R2 U R2 U2 R2'",
        "R2' U2 R2 U R2 U2 R2' U R2 U2 R2' U R2' U2 R2",
        "R2' U2 R2 U R2' U2 R2 U R2 U2 R2' U R2 U2 R2'",
        "R2' U2 R2 U R2' U2 R2 U R2' U2 R2 U R2' U2 R2",
        "R' U2 R U R2 U2 R2' U R2 U2 R2' U R' U2 R",
        "R' U2 R U R2' U2 R2 U R2' U2 R2 U R' U2 R",
        "R U2' R U2 R2' U' R' U R2' U2' R' U2 R2' U' R",
        "R U2' R U2 R2' U' R' U2 R2' U2 R' U2' R2' U2' R",
      ],
      [
        "R U2 R2' U2' R U2 R U R' U2 R' U2' R2 U2 R'",
        "R U2 R' U2 R2' U' R2 U' R U R2 U R2' U R'",
        "R2 U2 R2 U2' R2 U2 R U R' U2 R2' U2' R2' U2 R2'",
        "R' U2 R' U2' R2' U2 R2' U R2 U2 R2 U2' R U2 R",
        "R' U2 R' U2' R' U2 R2 U R2' U2 R U2' R U2 R",
        "R U2 R U2' R U2 R2' U R2 U2 R' U2' R' U2 R'",
        "R U2 R U2' R2 U2 R2 U R2' U2 R2' U2' R' U2 R'",
        "R2' U2 R2' U2' R2' U2 R' U R U2 R2 U2' R2 U2 R2",
        "R' U R2' U R2 U R U' R2 U' R2' U2 R' U2 R",
        "R' U2 R2 U2' R' U2 R' U R U2 R U2' R2' U2 R",
        "R U R' U2' R2' U2' R2 U' R U R2 U2 R2' U R'",
        "R' U R' U' R U2' R U2 R2' U R2 U2 R' U2 R",
        "R' U R' U' R U2' R2 U2 R2 U R2' U2 R2' U2 R",
        "R U2 R2' U2 R2' U R2 U2 R2 U2' R U' R' U R'",
        "R U2 R' U2 R2 U R2' U2 R U2' R U' R' U R'",
        "R' U R2' U2 R2 U R U' R2 U2' R2' U2' R' U R",
        "R U' R2' U2' R' U2 R2' U2' R2' U R2 U2 R2 U2' R U2 R",
        "R2' U2 R2 U R2 U2 R2 U2' R U' R' U2' R2' U2 R U2' R2",
        "R' U2 R' U2' R2' U2 R2' U R2 U2' R2 U2 R U2' R2 U' R'",
        "R U2 R U2' R2 U2 R2 U R2' U2' R2' U2 R' U2' R2' U' R",
      ],
      [
        "R U' R2 U2' R2' U' R' U R2' U2 R2 U2 R U' R'",
        "R' U2' R U2' R2' U' R2 U2' R' U2 R' U R U' R",
        "R' U2' R2 U2' R2 U' R2' U2' R2' U2 R' U R U' R",
        "R U' R U R' U2 R2' U2' R2' U' R2 U2' R2 U2' R'",
        "R U' R U R' U2 R' U2' R2 U' R2' U2' R U2' R'",
        "R' U' R U2 R2 U2 R2' U R' U' R2' U2' R2 U' R",
        "R U2' R2' U2 R U2' R U' R' U2' R' U2 R2 U2' R'",
        "R U' R2 U' R2' U' R' U R2' U R2 U2' R U2' R'",
        "R2 U2' R2 U2 R2 U2' R U' R' U2' R2' U2 R2' U2' R2'",
        "R' U2' R' U2 R2' U2' R2' U' R2 U2' R2 U2 R U2' R",
        "R' U2' R' U2 R' U2' R2 U' R2' U2' R U2 R U2' R",
        "R U2' R U2 R U2' R2' U' R2 U2' R' U2 R' U2' R'",
        "R U2' R U2 R2 U2' R2 U' R2' U2' R2' U2 R' U2' R'",
        "R2' U2' R2' U2 R2' U2' R' U' R U2' R2 U2 R2 U2' R2",
        "R' U2' R U2' R2 U R2' U R' U' R2' U' R2 U' R",
        "R' U2' R2 U2 R' U2' R' U' R U2' R U2 R2' U2' R",
        "R U2 R2 U R2 U R U' R2 U' R2' U2 R' U2' R U2' R'",
        "R U' R' U2' R U2 R2 U2 R2' U R' U' R2' U2' R2' U R'",
        "R' U2' R' U2 R U R' U2 R2' U2' R2' U' R2 U2' R2' U2 R",
        "R' U2' R' U2 R U R' U2 R' U2' R2 U' R2' U2' R2 U2 R",
      ],
      [
        "R U R U R' U R' U' R2 U R' U' R U' R2' U R U2' R'",
        "R U2 R' U' R2 U R' U R U' R2' U R U' R U' R' U' R'",
        "R2 U2 R2' U2 R2 U2' R2' U R2 U2 R2' U R2 U2' R2' U R2 U R2'",
        "R2 U' R2' U2' R2 U2 R2' U' R2 U2 R2' U R2 U2' R2' U R2 U R2'",
        "R2' U2 R2 U2 R2' U2' R2 U R2' U2 R2 U R2' U2' R2 U R2' U R2",
        "R2' U' R2 U2' R2' U2 R2 U' R2' U2 R2 U R2' U2' R2 U R2' U R2",
        "R2 U2 R' U R' U' R2' U2 R' U' R' U2 R2' U' R' U R' U2 R2",
        "R2 U' R2' U' R2 U2 R2' U' R2 U2' R2' U R2 U2' R2' U2 R2 U R2'",
        "R2 U' R2' U' R2 U2 R2' U' R2 U2' R2' U' R2 U2 R2' U2' R2 U2' R2'",
        "R2' U2' R U' R U R2 U2' R U R U2' R2 U R U' R U2' R2'",
        "R2' U' R2 U' R2' U2 R2 U' R2' U2' R2 U R2' U2' R2 U2 R2' U R2",
        "R2' U' R2 U' R2' U2 R2 U' R2' U2' R2 U' R2' U2 R2 U2' R2' U2' R2",
        "R2 U R2' U2 R2 U2' R2' U R2 U2' R2' U' R2 U2 R2' U' R2 U' R2'",
        "R2 U2' R2' U2' R2 U2 R2' U' R2 U2' R2' U' R2 U2 R2' U' R2 U' R2'",
        "R2' U R2 U2 R2' U2' R2 U R2' U2' R2 U' R2' U2 R2 U' R2' U' R2",
        "R2' U2' R2 U2' R2' U2 R2 U' R2' U2' R2 U' R2' U2 R2 U' R2' U' R2",
        "R2 U R2' U R2 U2' R2' U R2 U2 R2' U R2 U2' R2' U2 R2 U2 R2'",
        "R2 U R2' U R2 U2' R2' U R2 U2 R2' U' R2 U2 R2' U2' R2 U' R2'",
        "R2' U R2 U R2' U2' R2 U R2' U2 R2 U R2' U2' R2 U2 R2' U2 R2",
        "R2' U R2 U R2' U2' R2 U R2' U2 R2 U' R2' U2 R2 U2' R2' U' R2",
      ],
      [
        "R2 U2 R2' U R2 U' R2' U R2 U2 R2' U' R2 U2' R2' U' R2 U2' R2'",
        "R2 U2 R2' U R2 U' R2' U R2 U2 R2' U' R2' U2' R2 U' R2' U2' R2",
        "R2' U2 R2 U R2' U' R2 U R2' U2 R2 U' R2 U2' R2' U' R2 U2' R2'",
        "R2' U2 R2 U R2' U' R2 U R2' U2 R2 U' R2' U2' R2 U' R2' U2' R2",
        "R U' R2 U2 R' U R U' R' U R U' R' U R U2 R2' U R'",
        "R U' R2 U2' R' U' R U R' U' R U R' U' R U2' R2' U R'",
        "R U' R' U' R U2' R' U2' R2 U2 R' U R U' R' U' R U' R2'",
        "R2 U R' U R U R' U' R U2' R2' U2 R U2 R' U R U R'",
        "R2' U R' U R' U' R2 U R' U R U' R2' U R U' R U2' R2",
        "R2' U2 R' U R' U R U' R U R2' U' R U' R' U R2 U2 R2",
        "R2' U2 R' U R' U' R2 U R' U' R U' R2' U R U' R U' R2",
        "R2' U2' R2' U' R U R' U R2 U' R' U R' U' R U' R U2' R2",
        "R' U2 R U2 R U2' R2' U2 R2' U2' R2 U2' R2' U' R2' U R U2 R'",
        "R U2' R' U' R2 U R2 U2 R2' U2 R2 U2' R2 U2 R' U2' R' U2' R",
        "R2 U2 R2' U R2 U2 R2' U R2 U2' R2' U' R2 U R2' U' R2 U2' R2'",
        "R2 U2 R2' U R2 U2 R2' U R2' U2' R2 U' R2' U R2 U' R2' U2' R2",
        "R2' U2 R2 U R2' U2 R2 U R2 U2' R2' U' R2 U R2' U' R2 U2' R2'",
        "R2' U2 R2 U R2' U2 R2 U R2' U2' R2 U' R2' U R2 U' R2' U2' R2",
        "R2 U2 R2 U R' U' R U' R2' U R U' R U R' U R' U2 R2'",
        "R2 U2' R U' R U R2' U' R U R' U R2 U' R' U R' U R2'",
      ],
      [
        "R U2' R U2 R2 U2' R2 U R2' U R U R2 U2' R'",
        "R U2' R' U2' R U R' U' R U R' U' R U R' U R",
        "R U2' R' U' R U' R' U R U' R' U R U' R' U2 R",
        "R2 U2 R2' U R2 U2 R2 U2' R U' R U R2' U2 R U2' R",
        "R2' U2 R2 U R2' U2 R U2' R U' R U R2' U2 R U2' R",
        "R' U2 R2 U2' R U2' R' U2 R2' U2' R U2 R U2' R U2 R'",
        "R' U R2 U2 R U2' R2 U2 R2 U R2' U R U R2 U2' R'",
        "R U2' R U2 R2' U' R' U' R2 U' R2' U2 R2' U2' R' U2 R'",
        "R' U2 R' U2' R2 U R U R2' U R2 U2' R2 U2 R U2' R U2' R",
        "R' U2 R' U2' R2 U R U R2' U2 R2 U2 R2 U2' R U2 R U2 R",
        "R' U2 R' U2' R2' U2 R2' U' R2 U' R' U' R2' U2 R U2' R U' R",
        "R U2 R U2' R2 U2 R2 U2 R2' U R U R2 U2' R' U2 R'",
        "R' U2' R' U2 R2' U2' R2' U2' R2 U' R' U' R2' U2 R U2' R U2' R",
        "R U2' R U2 R2' U' R' U' R2 U2' R2' U2' R2' U2 R' U2' R' U2 R",
        "R U2' R2' U' R U' R U R' U' R U R' U' R U R2' U R2",
        "R U2' R2' U' R2 U' R' U R U' R' U R U' R' U R' U R2",
        "R2 U R' U R2 U2 R' U' R' U2 R2 U2' R2' U R U' R U' R2'",
        "R2 U2' R2' U2' R' U2 R2' U2' R2' U2 R2 U2 R' U R2' U2 R U2' R",
        "R2 U' R2' U2 R' U2' R2' U2 R2' U2 R2 U2 R' U R2' U2 R U2' R",
        "R U' R' U2' R2 U2 R' U2 R2' U2' R' U R' U' R U2 R2' U R'",
      ],
      [
        "R2 U2' R2' U' R2 U R2' U' R2 U R2' U' R2 U2' R2'",
        "R2' U2' R2 U' R2' U R2 U' R2' U R2 U' R2' U2' R2",
        "R2 U2' R2' U' R2 U R2' U' R2 U2' R U2' R2 U' R2' U2' R2",
        "R2 U2' R2' U' R2 U2' R U2' R2 U' R2' U R2 U' R2' U2' R2",
        "R2' U2' R2 U' R2' U R2 U' R2' U2' R' U2' R2' U' R2 U2' R2'",
        "R2' U2' R2 U' R2' U2' R' U2' R2' U' R2 U R2' U' R2 U2' R2'",
        "R2 U R2' U2' R2 U R2' U' R2 U R2' U2' R2 U' R2' U' R2 U2' R2'",
        "R2 U2' R2' U R2 U2 R2' U' R2 U R2' U' R2 U2 R2' U R2 U2' R2'",
        "R2 U2' R2' U2 R' U2 R2' U R2 U2 R U2 R2 U R2' U' R2 U2' R2'",
        "R2 U2' R2' U2 R' U2 R2' U R2 U' R2' U R2 U2 R U2 R2 U2' R2'",
        "R2 U2' R2' U2' R2 U R2' U R2 U' R2' U' R2 U2 R2' U' R2 U2' R2'",
        "R2 U2' R2' U' R2 U R2' U2 R' U2 R2' U R2 U2 R U2 R2 U2' R2'",
        "R2 U2' R2' U' R2 U R2' U2' R2 U R2' U R2 U' R2' U' R2 U' R2'",
        "R2 U2' R2' U' R2 U2 R2' U' R2 U' R2' U R2 U R2' U2' R2 U2' R2'",
        "R2 U2' R2' U' R2 U2' R U2' R2 U' R2' U2' R' U2' R2' U' R2 U2' R2'",
        "R2 U2' R2' U' R2 U' R2' U2' R2 U R2' U' R2 U R2' U2' R2 U R2'",
        "R2 U' R2' U' R2 U' R2' U R2 U R2' U2' R2 U R2' U' R2 U2' R2'",
        "R2' U R2 U2' R2' U R2 U' R2' U R2 U2' R2' U' R2 U' R2' U2' R2",
        "R2' U2' R2 U R2' U2 R2 U' R2' U R2 U' R2' U2 R2 U R2' U2' R2",
        "R2' U2' R2 U2 R U2 R2 U R2' U2 R' U2 R2' U R2 U' R2' U2' R2",
      ],
      [
        "R2 U2 R2' U R2 U' R2' U R2 U' R2' U R2 U2 R2'",
        "R2' U2 R2 U R2' U' R2 U R2' U' R2 U R2' U2 R2",
        "R2 U2 R2' U R2 U2 R U2 R2 U R2' U' R2 U R2' U2 R2",
        "R2 U2 R2' U R2 U' R2' U R2 U2 R U2 R2 U R2' U2 R2",
        "R2' U2 R2 U R2' U2 R' U2 R2' U R2 U' R2' U R2 U2 R2'",
        "R2' U2 R2 U R2' U' R2 U R2' U2 R' U2 R2' U R2 U2 R2'",
        "R2 U R2' U R2 U R2' U' R2 U' R2' U2 R2 U' R2' U R2 U2 R2'",
        "R2 U2 R2' U R2 U R2' U2 R2 U' R2' U R2 U' R2' U2 R2 U' R2'",
        "R2 U2 R2' U R2 U2 R U2 R2 U R2' U2 R' U2 R2' U R2 U2 R2'",
        "R2 U2 R2' U R2 U2' R2' U R2 U R2' U' R2 U' R2' U2 R2 U2 R2'",
        "R2 U2 R2' U R2 U' R2' U2 R2 U' R2' U' R2 U R2' U R2 U R2'",
        "R2 U2 R2' U R2 U' R2' U2' R' U2' R2' U' R2 U2' R U2' R2 U2 R2'",
        "R2 U2 R2' U2 R2 U' R2' U' R2 U R2' U R2 U2' R2' U R2 U2 R2'",
        "R2 U2 R2' U2' R' U2' R2' U' R2 U R2' U' R2 U2' R U2' R2 U2 R2'",
        "R2 U2 R2' U2' R' U2' R2' U' R2 U2' R U2' R2 U' R2' U R2 U2 R2'",
        "R2 U2 R2' U' R2 U2' R2' U R2 U' R2' U R2 U2' R2' U' R2 U2 R2'",
        "R2 U' R2' U2 R2 U' R2' U R2 U' R2' U2 R2 U R2' U R2 U2 R2'",
        "R2' U R2 U R2' U R2 U' R2' U' R2 U2 R2' U' R2 U R2' U2 R2",
        "R2' U2 R2 U R2' U R2 U2 R2' U' R2 U R2' U' R2 U2 R2' U' R2",
        "R2' U2 R2 U R2' U2 R' U2 R2' U R2 U2 R U2 R2 U R2' U2 R2",
      ],
      [
        "R U2 R' U R U2 R2' U2 R U R' U2 R2' U2 R2' U R2 U2 R2'",
        "R U2 R' U R U2 R2' U2 R U R' U2 R' U2 R2 U R2' U2 R2",
        "R2 U2' R2' U' R2 U' R2' U' R' U' R U R2 U' R2' U' R'",
        "R2' U2 R U2 R' U R2 U2' R' U' R U2 R U2 R' U' R U' R'",
        "R' U2 R U2 R' U2' R U R' U R2 U R2' U R2 U2' R2' U2 R",
        "R' U2' R U R' U R U2 R U2 R' U' R U2 R' U' R U2' R'",
        "R' U2' R U' R' U2 R U' R' U2 R U2 R U R' U R U2' R'",
        "R U2 R U R2' U2 R2 U' R' U R' U2' R U2 R' U' R2 U2' R2'",
        "R2 U2' R2' U' R2 U2 R' U2 R U2 R' U2' R' U2 R U R U R2'",
        "R2 U2' R2' U' R2 U2 R' U' R' U2' R U2 R U2' R' U2' R U R2'",
        "R2' U2' R2 U R' U2' R' U R2 U R2' U R U R U' R' U R",
        "R U R' U' R U R U R2' U R2 U R' U2' R' U R2 U2' R2'",
        "R U2 R' U R U R U2' R2' U2' R2 U' R' U' R' U' R U R'",
        "R U2' R' U R U2 R' U2' R U' R' U2' R U2' R' U2 R U' R'",
        "R U2' R' U R U2' R' U2 R U R' U2 R U' R' U2 R U' R'",
        "R2 U R2' U2' R2 U R2' U2 R2 U2 R2' U' R2 U2 R2' U R2 U R2'",
        "R2 U2 R' U2' R2' U' R U' R2' U R U2' R2 U R' U' R2 U2' R",
        "R2 U2' R U R U2 R2 U2' R2 U2 R U2' R U' R2 U R2 U R2'",
        "R2' U R2 U2' R2' U R2 U2 R2' U2 R2 U' R2' U2 R2 U R2' U R2",
        "R2' U2' R2 U' R' U2 R U2' R' U R' U' R2 U2 R2' U R U2 R",
      ],
      [
        "R U R2 U2 R U2' R U R2 U' R' U2 R2' U' R U R2' U2 R'",
        "R2 U R2' U2 R U2 R' U2 R U R U' R2 U2 R U2 R'",
        "R2 U' R2' U2 R2 U' R2' U2' R2 U2' R2' U R2 U2' R2' U' R2 U' R2'",
        "R2' U2 R' U' R' U2' R2' U2 R2' U2' R' U2 R' U R2' U' R2' U' R2",
        "R2' U2' R U2 R2 U R' U R2 U' R' U2 R2' U' R U R2' U2 R'",
        "R2' U' R2 U2 R2' U' R2 U2' R2' U2' R2 U R2' U2' R2 U' R2' U' R2",
        "R' U2 R U' R' U2 R U2' R' U' R U2' R' U R U2' R'",
        "R' U2 R U' R' U2' R U2 R' U R U2 R' U2 R U2' R'",
        "R2' U2 R2 U R2' U2' R U R U2 R' U2' R' U2 R U2 R' U' R2",
        "R2' U2 R2 U R2' U2' R U2' R' U2' R U2 R U2' R' U' R' U' R2",
        "R' U2' R2 U2 R2' U' R2 U' R2' U' R U' R' U2 R U2' R' U2' R",
        "R2 U2' R U2 R2' U2' R2' U2 R U R' U2 R2 U2' R2 U2 R' U2' R2'",
        "R2' U2' R' U2 R2 U2' R2 U2 R' U R U2 R2' U2' R2' U2 R U2' R2",
        "R2 U2 R2' U R U2' R' U2 R U' R U R2' U2' R2 U' R' U2' R'",
        "R' U2' R U' R' U' R' U2 R2 U2 R2' U R U R U R' U' R",
        "R' U' R U R' U' R' U' R2 U' R2' U' R U2 R U' R2' U2 R2",
        "R2 U2 R2' U' R U2 R U' R2' U' R2 U' R' U' R' U R U' R'",
        "R2 U2' R' U2' R U' R2' U2 R U R' U2' R' U2' R U R' U R",
        "R2' U2 R2 U R2' U R2 U R U R' U' R2' U R2 U R U' R'",
        "R' U2' R U' R' U2' R2 U2' R' U' R U2' R U2' R2' U' R2 U2' R2'",
      ],
      [
        "R U2 R2 U2' R2 U2 R2' U2 R2 U R' U R2' U' R2' U R' U R2 U2 R2",
        "R U' R2 U R2' U R' U' R2' U' R2' U2' R' U R U R' U2' R U2' R'",
        "R U' R' U2' R U2' R' U2' R' U2' R U' R' U2' R2 U2' R' U R U R'",
        "R2 U R U2 R' U R U' R U R2 U' R2' U2' R' U2' R U R U' R2",
        "R2 U R U2 R' U R U' R U2' R' U2' R2' U' R2 U R U R U' R2",
        "R2 U2 R2 U R' U R2' U' R2' U R' U R2 U2 R2' U2 R2 U2' R2 U2 R",
        "R2 U2 R2' U2' R U2' R' U2 R U2' R2 U2' R U2 R' U2' R U2' R2' U2 R2",
        "R2 U' R U R U R2 U' R2' U2' R' U2' R U' R U R' U2 R U R2",
        "R2 U' R U R U2' R' U2' R2' U' R2 U R U' R U R' U2 R U R2",
        "R' U R U R' U2' R2 U2' R' U' R U2' R' U2' R' U2' R U2' R' U' R",
        "R' U R2 U R2 U2 R' U2 R' U2' R U2' R U' R U R' U2' R2 U' R'",
        "R' U2' R U2' R' U R U R' U2' R2' U' R2' U' R' U R2' U R2 U' R",
        "R' U' R2 U2' R' U R U' R U2' R U2' R' U2 R' U2 R2 U R2 U R'",
        "R U2 R2 U2 R U' R U R U' R U R2 U2' R2' U2' R' U' R2 U' R2'",
        "R2' U' R2 U' R' U2' R2' U2' R2 U R U' R U R U' R U2 R2 U2 R",
        "R U R2' U2 R2 U2 R2' U R U R U2' R' U' R U R' U2' R U' R'",
        "R U2' R U2' R2' U2 R2 U2 R2' U2 R2 U2' R2' U' R U R' U2' R U' R'",
        "R U2' R U2' R2' U2 R2 U' R2' U2' R2 U2 R2' U2 R U R' U2' R U' R'",
        "R U2' R2 U2' R2 U2 R2' U2 R2 U2 R2' U2' R2 U' R U R' U2' R U' R'",
        "R U2' R2 U2' R2 U2 R2' U' R2 U2' R2' U2 R2 U2 R U R' U2' R U' R'",
      ],
      [
        "R U R2' U R2 U2' R' U' R' U2 R' U2' R2 U' R2' U R2 U R2' U R2",
        "R U R2' U R2 U2' R' U' R' U2 R' U' R2 U' R2' U' R2 U R2' U2 R2",
        "R U R' U2 R U' R' U2 R U2 R U R' U' R' U R U2' R U2 R2'",
        "R U2 R U R2 U2' R' U2 R U2' R U2 R2' U' R2' U' R' U2 R2 U2 R'",
        "R U2 R U R2' U2' R' U2 R' U2' R U2 R' U' R2' U' R' U2 R2 U2 R'",
        "R U2' R' U R U2 R U2 R' U' R U2 R' U2 R' U R U2' R U2 R2'",
        "R2 U R2 U2 R2 U2' R' U2 R' U R U2 R2 U R' U2 R2' U2' R2' U2' R2'",
        "R2 U R2 U2 R2' U R2' U' R' U2' R' U2' R' U' R U2' R2 U2 R2 U2 R2'",
        "R2 U R2' U R2 U R2' U2' R U R U2' R2 U2 R2 U2 R2' U R2 U R'",
        "R2 U R2' U R2 U R2' U' R2 U2' R' U2 R' U' R' U2' R2 U R2'",
        "R2 U R2' U' R U2' R' U2 R' U' R2' U2' R2 U2' R U R U' R U2' R2'",
        "R2 U2 R2 U R2 U' R U R U2' R' U R' U' R2 U2 R U' R2' U2' R2'",
        "R2 U2 R2' U R2 U' R2' U' R2 U' R' U2 R' U' R' U2' R2 U R2'",
        "R2' U2 R U2' R U R' U2 R' U2 R U' R' U2 R U2 R U R' U2' R",
        "R2' U2 R U2' R U R' U' R' U R U2 R U2 R' U' R U2 R'",
        "R2' U2 R2 U2 R2 U2' R U' R' U2' R' U2' R' U' R2' U R2' U2 R2 U R2",
        "R2' U2' R U' R U R U2' R2 U2' R2' U' R' U2 R' U2' R U' R2' U R2",
        "R2' U2' R2' U2' R2' U2 R' U R2 U2 R U R' U2 R' U2' R2 U2 R2 U R2",
        "R2' U2' R2' U' R U2 R2 U' R' U R' U2' R U R U' R2 U R2 U2 R2",
        "R' U R2 U R2' U2 R2 U2 R2 U2' R U R U2' R2' U R2 U R2' U R2",
      ],
      [
        "R U' R U R U2' R2' U' R' U R2' U2 R' U' R2' U2' R U2' R'",
        "R' U2' R U2' R2' U' R' U2 R2' U R' U' R2' U2' R U R U' R",
        "R2 U2 R U2' R2' U2 R2' U2' R U2' R' U' R2 U R2 U' R' U R2'",
        "R2' U R' U' R2 U R2 U' R' U2' R U2' R2' U2 R2' U2' R U2 R2",
        "R2' U R' U2 R2' U2 R2' U' R2 U2 R2 U' R2' U2 R2' U2 R' U R2'",
        "R2 U2 R U2' R2' U2 R2' U2' R U2' R' U' R2 U R2 U' R' U R2'",
        "R2' U R' U2 R2' U2 R2' U' R2 U2 R2 U' R2' U2 R2' U2 R' U R2'",
        "R2' U R' U' R2 U R2 U' R' U2' R U2' R2' U2 R2' U2' R U2 R2",
        "R U' R U R U2' R2' U' R' U R2' U2 R' U' R2' U2' R U2' R'",
        "R2 U2 R U2' R2' U2 R2' U2' R U2' R' U' R2 U R2 U' R' U R2'",
        "R2' U R' U2 R2' U2 R2' U' R2 U2 R2 U' R2' U2 R2' U2 R' U R2'",
        "R2' U R' U' R2 U R2 U' R' U2' R U2' R2' U2 R2' U2' R U2 R2",
        "R' U2' R U2' R2' U' R' U2 R2' U R' U' R2' U2' R U R U' R",
        "R U' R U R U2' R2' U' R' U R2' U2 R' U' R2' U2' R U2' R'",
        "R2' U R' U2 R2' U2 R2' U' R2 U2 R2 U' R2' U2 R2' U2 R' U R2'",
        "R' U2' R U2' R2' U' R' U2 R2' U R' U' R2' U2' R U R U' R",
        "R U' R U R U2' R2' U' R' U R2' U2 R' U' R2' U2' R U2' R'",
        "R2 U2 R U2' R2' U2 R2' U2' R U2' R' U' R2 U R2 U' R' U R2'",
        "R2' U R' U' R2 U R2 U' R' U2' R U2' R2' U2 R2' U2' R U2 R2",
        "R' U2' R U2' R2' U' R' U2 R2' U R' U' R2' U2' R U R U' R",
      ],
      [
        "R2 U' R U R2' U' R2' U R U2 R' U2 R2 U2' R2 U2 R' U2' R2'",
        "R2' U2' R' U2 R2 U2' R2 U2 R' U2 R U R2' U' R2' U R U' R2",
        "R U2 R' U2 R2 U R U2' R2 U' R U R2 U2 R' U' R' U R'",
        "R' U R' U' R' U2 R2 U R U' R2 U2' R U R2 U2 R' U2 R",
        "R2 U' R U2' R2 U2' R2 U R2' U2' R2' U R2 U2' R2 U2' R U' R2",
        "R U2 R' U2 R2 U R U2' R2 U' R U R2 U2 R' U' R' U R'",
        "R2 U' R U2' R2 U2' R2 U R2' U2' R2' U R2 U2' R2 U2' R U' R2",
        "R' U R' U' R' U2 R2 U R U' R2 U2' R U R2 U2 R' U2 R",
        "R U2 R' U2 R2 U R U2' R2 U' R U R2 U2 R' U' R' U R'",
        "R2 U' R U R2' U' R2' U R U2 R' U2 R2 U2' R2 U2 R' U2' R2'",
        "R2 U' R U2' R2 U2' R2 U R2' U2' R2' U R2 U2' R2 U2' R U' R2",
        "R2' U2' R' U2 R2 U2' R2 U2 R' U2 R U R2' U' R2' U R U' R2",
        "R' U R' U' R' U2 R2 U R U' R2 U2' R U R2 U2 R' U2 R",
        "R2 U' R U R2' U' R2' U R U2 R' U2 R2 U2' R2 U2 R' U2' R2'",
        "R2 U' R U2' R2 U2' R2 U R2' U2' R2' U R2 U2' R2 U2' R U' R2",
        "R2' U2' R' U2 R2 U2' R2 U2 R' U2 R U R2' U' R2' U R U' R2",
        "R U2 R' U2 R2 U R U2' R2 U' R U R2 U2 R' U' R' U R'",
        "R2 U' R U R2' U' R2' U R U2 R' U2 R2 U2' R2 U2 R' U2' R2'",
        "R2 U' R U2' R2 U2' R2 U R2' U2' R2' U R2 U2' R2 U2' R U' R2",
        "R2' U2' R' U2 R2 U2' R2 U2 R' U2 R U R2' U' R2' U R U' R2",
      ],
      [
        "R2 U2' R2' U' R2 U2' R2' U R2 U2' R2' U' R2 U2' R2'",
        "R2 U2' R2' U' R2 U2' R2' U R2' U2' R2 U' R2' U2' R2",
        "R2' U2' R2 U' R2' U2' R2 U R2 U2' R2' U' R2 U2' R2'",
        "R2' U2' R2 U' R2' U2' R2 U R2' U2' R2 U' R2' U2' R2",
        "R' U2 R U2' R' U2' R' U2' R U' R' U2' R2 U2' R' U2 R",
        "R U2 R' U2' R2 U2' R' U' R U2' R' U2' R' U2' R U2 R'",
        "R2 U2' R2' U' R2 U2' R2' U R2 U2' R2' U2 R2 U2 R2' U2' R2 U2 R2'",
        "R2 U2' R2' U' R2 U2' R2' U R2' U2' R2 U2 R2' U2 R2 U2' R2' U2 R2",
        "R2 U2' R2' U' R2 U2' R2' U' R U2 R2 U2' R2' U' R2 U2' R2' U2 R'",
        "R2 U2' R2' U' R2 U2' R2' U' R U2 R2' U2' R2 U' R2' U2' R2 U2 R'",
        "R2 U2' R2' U' R2 U2' R2' U' R2 U2 R2 U2' R2' U' R2 U2' R2' U2 R2'",
        "R2 U2' R2' U' R2 U2' R2' U' R2 U2 R2' U2' R2 U' R2' U2' R2 U2 R2'",
        "R2 U2' R2' U' R2 U2' R2' U' R2' U2 R2 U2' R2' U' R2 U2' R2' U2 R2",
        "R2 U2' R2' U' R2 U2' R2' U' R2' U2 R2' U2' R2 U' R2' U2' R2 U2 R2",
        "R2 U2' R2' U' R2 U2' R2' U' R' U2 R2 U2' R2' U' R2 U2' R2' U2 R",
        "R2 U2' R2' U' R2 U2' R2' U' R' U2 R2' U2' R2 U' R2' U2' R2 U2 R",
        "R2' U2' R2 U' R2' U2' R2 U R2 U2' R2' U2 R2 U2 R2' U2' R2 U2 R2'",
        "R2' U2' R2 U' R2' U2' R2 U R2' U2' R2 U2 R2' U2 R2 U2' R2' U2 R2",
        "R2' U2' R2 U' R2' U2' R2 U' R U2 R2 U2' R2' U' R2 U2' R2' U2 R'",
        "R2' U2' R2 U' R2' U2' R2 U' R U2 R2' U2' R2 U' R2' U2' R2 U2 R'",
      ],
      [
        "R2 U2 R2' U R2 U2 R2' U' R2 U2 R2' U R2 U2 R2'",
        "R2 U2 R2' U R2 U2 R2' U' R2' U2 R2 U R2' U2 R2",
        "R2' U2 R2 U R2' U2 R2 U' R2 U2 R2' U R2 U2 R2'",
        "R2' U2 R2 U R2' U2 R2 U' R2' U2 R2 U R2' U2 R2",
        "R U2' R' U2 R U2 R U2 R' U R U2 R2' U2 R U2' R'",
        "R' U2' R U2 R2' U2 R U R' U2 R U2 R U2 R' U2' R",
        "R' U2 R U' R' U' R2 U2 R' U R U2 R2' U R U2 R' U2 R",
        "R2' U' R' U2' R2' U R2' U' R' U2 R2 U' R' U' R U2 R' U R2",
        "R U2' R' U2 R U R U2' R' U' R U2' R' U' R' U2 R U2' R'",
        "R U2' R' U2' R2' U' R2' U' R' U' R U2 R2 U R2 U R U2' R'",
        "R U2' R2 U2 R2' U R2 U2 R2' U2' R' U R2 U2 R2' U R2 U2 R2'",
        "R U2' R2 U2 R2' U R2 U2 R2' U2' R' U R2' U2 R2 U R2' U2 R2",
        "R U2' R2' U2 R2 U R2' U2 R2 U2' R' U R2 U2 R2' U R2 U2 R2'",
        "R U2' R2' U2 R2 U R2' U2 R2 U2' R' U R2' U2 R2 U R2' U2 R2",
        "R2 U2' R2 U2 R2' U R2 U2 R2' U2' R2' U R2 U2 R2' U R2 U2 R2'",
        "R2 U2' R2 U2 R2' U R2 U2 R2' U2' R2' U R2' U2 R2 U R2' U2 R2",
        "R2 U2' R2' U2 R2 U R2' U2 R2 U2' R2' U R2 U2 R2' U R2 U2 R2'",
        "R2 U2' R2' U2 R2 U R2' U2 R2 U2' R2' U R2' U2 R2 U R2' U2 R2",
        "R2 U2' R2' U2 R2 U2' R2' U2' R2 U2 R2' U' R2 U2 R2' U R2 U2 R2'",
        "R2 U2' R2' U2 R2 U2' R2' U2' R2 U2 R2' U' R2' U2 R2 U R2' U2 R2",
      ],
      [
        "R U2 R' U R U2 R2' U2 R U R' U2 R",
        "R U2' R' U' R U2' R' U2' R' U2' R U' R' U2' R",
        "R U2' R' U' R U2' R' U' R' U2 R U R' U2 R",
        "R U2 R' U R U2 R' U' R' U2' R U' R' U2' R",
        "R U2' R' U' R U' R2 U2' R2' U' R' U R2' U2 R2' U' R'",
        "R' U' R2' U2 R2' U R' U' R2' U2' R2 U' R U' R' U2' R",
        "R U2' R' U2' R U' R' U R U2' R2' U2' R U R' U R2 U2 R'",
        "R2 U2 R2' U2' R2 U R2 U2' R2' U' R2 U2' R2' U' R2' U2 R2 U2' R2'",
        "R2 U2 R2' U2' R2 U R2' U2' R2 U' R2' U2' R2 U' R2' U2 R2 U2' R2'",
        "R2' U2 R2 U2' R2' U R2 U2' R2' U' R2 U2' R2' U' R2 U2 R2' U2' R2",
        "R2' U2 R2 U2' R2' U R2' U2' R2 U' R2' U2' R2 U' R2 U2 R2' U2' R2",
        "R2 U2' R2' U2 R2 U' R2 U2' R2' U' R2 U2' R2' U' R2' U2 R2 U2' R2'",
        "R2 U2' R2' U2 R2 U' R2' U2' R2 U' R2' U2' R2 U' R2' U2 R2 U2' R2'",
        "R2' U2' R2 U2 R2' U' R2 U2' R2' U' R2 U2' R2' U' R2 U2 R2' U2' R2",
        "R2' U2' R2 U2 R2' U' R2' U2' R2 U' R2' U2' R2 U' R2 U2 R2' U2' R2",
        "R2 U' R' U2' R U2 R U R U R U R' U' R U' R' U' R2",
        "R U2' R2' U2' R U R' U R2 U2 R' U2 R U2' R' U2' R U' R'",
        "R U2' R' U' R U2 R2 U R2 U R U R' U2' R2' U' R2' U R'",
        "R2 U2 R2' U2' R2 U R2 U2' R2' U' R2 U2' R2' U R2' U2' R2 U2 R2'",
        "R2 U2 R2' U2' R2 U R2' U2' R2 U' R2' U2' R2 U R2' U2' R2 U2 R2'",
      ],
      [
        "R' U2' R U' R' U2' R2 U2' R' U' R U2' R'",
        "R' U2' R U' R' U2' R U R U2 R' U R U2 R'",
        "R' U2 R U R' U2 R U2 R U2 R' U R U2 R'",
        "R' U2 R U R' U2 R U R U2' R' U' R U2' R'",
        "R U R2 U2' R2 U' R U R2 U2 R2' U R' U R U2 R'",
        "R' U2 R U R' U R2' U2 R2 U R U' R2 U2' R2 U R",
        "R2' U2' R2 U2' R2' U' R' U' R U R2 U2 R2' U' R' U R U2 R2",
        "R U R U R2' U R U' R U' R' U' R2' U2 R U R' U2 R",
        "R2 U2' R U2 R U R2 U' R' U2' R' U R' U2 R' U2 R2 U R2'",
        "R2' U' R2' U2' R2 U2' R2' U' R' U2 R2' U2 R U2 R' U R U2 R",
        "R U2' R2' U' R U' R' U2 R2 U2 R' U' R U R' U2 R U2 R'",
        "R2 U2 R2' U2' R2 U R2 U2 R2' U R2 U2 R2' U' R2' U2 R2 U2' R2'",
        "R2 U2 R2' U2' R2 U R2' U2 R2 U R2' U2 R2 U' R2' U2 R2 U2' R2'",
        "R2' U2 R2 U2' R2' U R2 U2 R2' U R2 U2 R2' U' R2 U2 R2' U2' R2",
        "R2' U2 R2 U2' R2' U R2' U2 R2 U R2' U2 R2 U' R2 U2 R2' U2' R2",
        "R U R' U2 R U2 R' U2' R U2' R2' U' R U' R' U2 R2 U2 R'",
        "R U R2' U R U R' U2' R2 U' R2 U2 R U2 R' U R U2 R",
        "R U2 R U R' U2 R U2 R2 U' R2 U2' R' U R U R2'",
        "R U' R2 U R2 U2 R U' R' U' R2' U' R2' U2' R' U R U2 R'",
        "R2 U2 R U R' U' R' U2' R2' U2 R2' U2' R' U' R' U R U2 R2",
      ],
      [
        "R U R' U R' U' R2 U' R' U R'",
        "R U2' R U R2' U R U' R U' R' U2 R' U' R U R'",
        "R U2' R' U R' U' R2 U' R' U R' U R U2' R U2' R'",
        "R' U2' R U' R' U2 R' U' R U' R U R2' U R",
        "R U R' U R2' U R U2' R2 U' R' U R' U2 R' U' R2",
        "R2 U' R' U2 R' U R' U' R2 U2' R U R2' U R'",
        "R U2 R U R' U R' U' R2 U' R' U R' U R U R'",
        "R2 U2 R U R' U R' U' R2 U' R' U R' U R U R2'",
        "R2' U2 R U R' U R' U' R2 U' R' U R' U R U R2",
        "R' U2 R U R' U R' U' R2 U' R' U R' U R U R",
        "R U R U R' U R' U' R2 U' R' U R' U R U2 R'",
        "R2 U R U R' U R' U' R2 U' R' U R' U R U2 R2'",
        "R2' U R U R' U R' U' R2 U' R' U R' U R U2 R2",
        "R' U R U R' U R' U' R2 U' R' U R' U R U2 R",
        "R U R U R2' U R U' R U' R' U2 R' U' R U2' R'",
        "R' U R U' R' U2 R' U' R U' R U R2' U R U2' R",
        "R' U2' R U2' R U R' U R' U' R2 U' R' U R' U2' R",
        "R U R' U' R' U2 R' U R2 U R U' R2 U' R U2' R",
        "R U2' R U' R2 U' R U R2 U R' U2 R' U' R' U R",
        "R2 U2' R U' R2' U' R' U R2' U R' U2 R2' U' R U R'",
      ],
      [
        "R' U' R U' R U R2' U R U' R U' R'",
        "R U2' R' U' R U' R U R2' U R U' R U' R' U' R'",
        "R2 U2' R' U' R U' R U R2' U R U' R U' R' U' R2'",
        "R2' U2' R' U' R U' R U R2' U R U' R U' R' U' R2",
        "R' U2' R' U' R U' R U R2' U R U' R U' R' U' R",
        "R U' R' U R2 U2' R U' R2 U' R U R2 U R' U2 R2'",
        "R2' U2 R' U R2 U R U' R2 U' R U2' R2 U R' U' R",
        "R' U2 R' U R2' U R' U' R2' U' R U2' R U R U' R'",
        "R' U' R U R U2' R U' R2' U' R' U R2' U R' U2 R'",
        "R U2 R' U2 R' U' R U' R U R2' U R U' R U2 R'",
        "R U' R' U R U2' R U R' U R' U' R2 U' R' U2 R'",
        "R2' U R U2' R U' R U R2' U2 R' U' R2 U' R U' R'",
        "R' U' R U' R2 U' R' U2 R2' U R U' R U2' R U R2'",
        "R' U' R' U' R2 U' R' U R' U R U2' R U R' U2 R",
        "R U' R' U' R U' R U R2' U R U' R U' R' U2' R'",
        "R2 U' R' U' R U' R U R2' U R U' R U' R' U2' R2'",
        "R2' U' R' U' R U' R U R2' U R U' R U' R' U2' R2",
        "R' U' R' U' R U' R U R2' U R U' R U' R' U2' R",
        "R U2 R' U R U2' R U R' U R' U' R2 U' R' U' R'",
        "R' U2 R U' R U R2' U R U' R U' R' U2 R' U2 R",
      ],
      [
        "R2 U2' R2' U' R' U2 R2 U2' R U' R' U2' R2' U2 R2' U' R2'",
        "R2 U' R2' U' R2' U R' U' R2' U' R2 U R U' R' U2' R2'",
        "R2' U2' R' U' R U R2 U' R2' U' R' U R2' U' R2' U' R2",
        "R2' U' R2' U2 R2' U2' R' U' R U2' R2 U2 R' U' R2' U2' R2",
        "R U' R' U2' R2' U2' R2 U' R2' U' R2' U R' U' R2' U' R2",
        "R2 U' R2' U' R' U R2' U' R2' U' R2 U2' R2' U2' R' U' R",
        "R U2 R U R2' U R U' R U' R' U2 R' U' R U2 R'",
        "R U2 R' U R' U' R2 U' R' U R' U R U2' R U' R'",
        "R' U2 R U' R' U2 R' U' R U' R U R2' U R U2 R",
        "R' U' R U2' R U R' U R' U' R2 U' R' U R' U2 R",
        "R2 U R U' R' U2' R2' U2' R2 U' R2' U' R2' U R' U' R2'",
        "R2 U2' R2' U2' R' U' R U R2 U' R2' U' R' U R2' U' R2'",
        "R2 U2' R2' U' R2' U2 R2' U2' R' U' R U2' R2 U2 R' U' R2'",
        "R2' U2' R2 U2' R2' U' R' U2 R2 U2' R U' R' U2' R2' U2 R2'",
        "R2' U2' R2 U' R2' U' R2' U R' U' R2' U' R2 U R U' R'",
        "R U R' U' R2' U' R U2' R U R U' R2' U2 R' U R2",
        "R U2 R2' U' R U R U2' R U' R2' U' R' U R2' U R2'",
        "R2 U2 R' U' R' U R2 U2' R U' R2 U' R U R2 U R2",
        "R2' U' R' U2 R2 U2' R U' R' U2' R2' U2 R2' U' R2' U2' R2",
        "R' U R U' R2 U' R U2' R2 U R' U' R' U2 R' U R2'",
      ],
      [
        "R2 U2 R2' U R2 U R2 U' R U R2 U R2' U' R'",
        "R2' U2 R2 U R2 U2' R2 U2 R U R' U2 R2' U2' R U R2",
        "R2' U R2 U R U' R2 U R2 U R2' U2 R2 U2 R U R'",
        "R2 U' R U2' R U R U' R2' U2 R' U R2' U R' U' R",
        "R2 U' R2 U' R U R2 U R' U2 R' U' R' U R2 U2' R'",
        "R2' U' R U2' R2 U R' U' R' U2 R' U R2 U R U' R'",
        "R2' U' R2' U' R' U R2' U R' U2 R2' U' R U R U2' R2'",
        "R2 U2 R2' U2 R2 U R U2' R2' U2 R' U R U2 R2 U2' R2",
        "R2' U2 R2 U2 R U R' U' R2' U R2 U R U' R2 U R2",
        "R2' U' R' U R U2 R2 U2 R2' U R2 U R2 U' R U R2",
        "R U R' U2 R' U' R U' R U R2' U R U' R U2' R'",
        "R U2' R' U R U2' R U R' U R' U' R2 U' R' U2' R'",
        "R' U2' R U' R U R2' U R U' R U' R' U2 R' U R",
        "R' U2' R' U' R2 U' R' U R' U R U2' R U R' U2' R",
        "R2 U R2 U2' R2 U2 R U R' U2 R2' U2' R U R2 U2 R2'",
        "R2 U2 R U R' U' R2' U R2 U R U' R2 U R2 U R2'",
        "R2' U R2 U R2 U' R U R2 U R2' U' R' U R U2 R2",
        "R2' U2 R2 U R U2' R2' U2 R' U R U2 R2 U2' R2 U R2",
        "R2 U R U' R2 U R2 U R2' U2 R2 U2 R U R' U' R2'",
        "R2 U R2 U' R U R2 U R2' U' R' U R U2 R2 U2 R2'",
      ],
      [
        "R U2 R2' U2 R U R' U2 R2 U' R' U2' R2 U2' R' U' R U2' R2'",
        "R2 U2' R2' U R2 U2' R2' U2' R2 U2' R2' U2' R2 U' R2' U2 R2 U R2'",
        "R2' U2' R2 U R2' U2' R2 U2' R2' U2' R2 U2' R2' U' R2 U2 R2' U R2",
        "R U2 R' U R U R' U2' R U2' R' U2' R U2' R' U R U R'",
        "R2 U2 R U R' U' R' U2' R U R U' R2' U2 R' U2 R2 U R2'",
        "R2 U2 R2' U R2 U2 R' U2 R2' U' R U R U2' R' U' R' U R",
        "R2 U2' R2' U' R2 U2' R2 U2' R2 U R' U' R' U2 R U R U' R'",
        "R2 U2' R' U' R U R U2 R' U' R' U R2 U2' R2 U2' R2 U' R2'",
        "R2' U2 R U R' U' R' U2' R U R U' R2' U2 R2' U2 R2' U R2",
        "R2' U2 R2 U R2' U2 R2' U2 R2' U' R U R U2' R' U' R' U R",
        "R2' U2' R2 U' R2' U2' R U2' R2 U R' U' R' U2 R U R U' R'",
        "R2' U2' R' U' R U R U2 R' U' R' U R2 U2' R U2' R2' U' R2",
        "R' U2' R U' R' U' R U2 R' U2 R U2 R' U2 R U' R' U' R",
        "R2 U2 R' U R U2 R2' U2 R U R2' U2' R U' R' U2' R2 U2' R'",
        "R2 U' R2' U2' R2 U R2' U2 R2 U2 R2' U2 R2 U2 R2' U' R2 U2 R2'",
        "R2' U' R2 U2' R2' U R2 U2 R2' U2 R2 U2 R2' U2 R2 U' R2' U2 R2",
        "R U R' U' R2' U2' R2 U R U' R' U2 R2' U2' R2 U' R2' U R2",
        "R U R' U' R' U2' R U R U' R2' U2 R2' U2 R2' U R2 U2 R2'",
        "R U R' U' R' U2' R U R U' R2' U2 R' U2 R2 U R2' U2 R2",
        "R U' R2' U R2 U R2' U' R U R2' U2' R' U' R' U R U2 R2",
      ],
      [
        "R2 U2 R2' U2' R2 U R' U2 R' U' R' U2' R2 U R2' U R2' U R2'",
        "R2' U R2' U R2' U R2 U2' R' U' R' U2 R' U R2 U2' R2' U2 R2",
        "R2 U R2' U2 R2 U2' R2' U R2 U2' R2' U2' R2 U2' R2' U2' R2 U' R2'",
        "R2 U2' R2' U2' R2 U2 R2' U' R2 U2' R2' U2' R2 U2' R2' U2' R2 U' R2'",
        "R2' U R2 U2 R2' U2' R2 U R2' U2' R2 U2' R2' U2' R2 U2' R2' U' R2",
        "R2' U2' R2 U2' R2' U2 R2 U' R2' U2' R2 U2' R2' U2' R2 U2' R2' U' R2",
        "R2 U2' R2' U R2' U R2' U R2 U2' R' U' R' U2 R' U' R2 U2 R2'",
        "R2 U2' R2' U2 R2 U' R' U2 R' U' R' U2' R2 U R2' U R2' U R2'",
        "R' U2 R U' R' U' R' U2 R' U2' R2' U R2' U2' R' U2' R U2 R2",
        "R2 U' R2 U R2' U R2 U' R2 U' R' U' R2' U2 R U R U2 R2",
        "R2' U2' R' U' R' U2' R2 U R U R U' R2 U R2' U R2 U' R",
        "R2' U2' R' U' R' U2' R2 U R U R2' U R2' U' R2 U' R2' U R2'",
        "R' U R2' U' R2 U' R2' U R' U' R' U' R2' U2 R U R U2 R2",
        "R U' R2 U R2' U R2 U' R U R U R2 U2' R' U' R' U2' R2'",
        "R2 U2 R U R U2 R2' U' R' U' R2 U' R2 U R2' U R2 U' R2",
        "R2 U2 R U R U2 R2' U' R' U' R' U R2' U' R2 U' R2' U R'",
        "R2 U2 R U2' R' U2' R2' U R2' U2' R' U2 R' U' R' U' R U2 R'",
        "R2 U' R2' U2' R2 U2' R2' U2' R2 U2' R2' U R2 U2' R2' U2 R2 U R2'",
        "R2 U' R2' U2' R2 U2' R2' U2' R2 U2' R2' U' R2 U2 R2' U2' R2 U2' R2'",
        "R2' U R2' U R2' U R2 U2' R' U' R' U2 R' U' R2 U2 R2' U2' R2",
      ],
      [
        "R U2 R' U2 R U' R' U' R U2' R' U2' R U' R' U' R U2 R'",
        "R2 U2 R2' U R2 U R2' U R2 U2 R2' U2 R2 U R2' U R2 U R2'",
        "R2 U2 R2' U2 R2 U R2 U2' R2' U' R2 U2' R2' U2 R2' U' R2 U2 R2'",
        "R2 U2 R2' U2 R2 U R2' U2' R2 U2 R2' U2 R2 U2' R2' U R2 U2 R2'",
        "R2 U2 R2' U2 R2 U R2' U2' R2 U' R2' U2' R2 U2 R2' U' R2 U2 R2'",
        "R2 U2 R2' U2 R2 U' R2' U2 R2 U2' R2' U' R2 U2' R2' U R2 U2 R2'",
        "R2 U2 R2' U2 R2 U' R2' U2 R2' U2' R2 U' R2' U2' R2 U R2 U2 R2'",
        "R2 U2' R U R' U' R2' U2 R2 U R U' R' U R2' U' R2 U R2'",
        "R2' U2 R2 U R2' U R2 U R2' U2 R2 U2 R2' U R2 U R2' U R2",
        "R2' U2 R2 U2 R2' U R2 U2' R2' U2 R2 U2 R2' U2' R2 U R2' U2 R2",
        "R2' U2 R2 U2 R2' U R2 U2' R2' U' R2 U2' R2' U2 R2 U' R2' U2 R2",
        "R2' U2 R2 U2 R2' U R2' U2' R2 U' R2' U2' R2 U2 R2 U' R2' U2 R2",
        "R2' U2 R2 U2 R2' U R' U2' R U' R2 U2' R2' U2' R2 U2' R2 U2 R2'",
        "R2' U2 R2 U2 R2' U' R2 U2 R2 U2' R2' U' R2 U2' R2' U R2' U2 R2",
        "R2' U2 R2 U2 R2' U' R2 U2 R2' U2' R2 U' R2' U2' R2 U R2' U2 R2",
        "R2' U2 R2' U2 R2 U2' R2 U2' R2' U2' R2 U' R U2' R' U R2' U2 R2",
        "R2' U2' R2 U' R2' U R2 U' R U R' U' R2' U2' R2 U R U' R'",
        "R2' U' R U2' R U R U2 R2' U' R2 U' R2 U' R2 U' R2' U2' R2",
        "R U2 R2' U2' R2 U R2' U R' U R2 U R U' R2 U' R2' U' R'",
        "R2' U2 R2 U R U2' R' U' R2' U2' R2 U R U2 R2 U2 R2' U2' R'",
      ],
      [
        "R' U2' R U R' U' R U' R' U2 R U2' R' U2' R",
        "R U2' R' U2' R U2 R' U' R U' R' U R U2' R'",
        "R2 U2 R' U2' R U R U2 R2' U' R2 U' R2 U R2 U R2'",
        "R2 U2 R' U R U2' R2 U2 R2 U2 R2' U R2 U R U' R2'",
        "R U R2' U2 R2 U2 R2' U R U R' U' R U' R' U2 R",
        "R2' U' R U R2 U R2' U2 R2 U2 R2 U2' R U R' U2 R2",
        "R U2 R' U' R U' R' U R U R2' U2 R2 U2 R2' U R",
        "R2' U R2 U R2 U' R2 U' R2' U2 R U R U2' R' U2 R2",
        "R2 U2 R2' U' R2 U R2 U' R2 U' R2' U2 R U R U2' R U2 R2'",
        "R2' U R2' U R2' U R2 U2' R' U' R' U2 R' U R2 U2 R2' U2' R2",
        "R2' U2 R2' U2' R U R U2 R2' U' R2 U' R2 U R2 U2' R U2' R2",
        "R2' U2 R' U' R' U' R2 U2 R2' U R2 U' R2' U' R' U R2 U R2'",
        "R2 U2 R U2 R U2' R' U' R U2' R' U2 R' U R2' U2 R2 U R2'",
        "R2 U2 R U2' R U2 R' U R U2 R' U2' R' U R2' U2 R2 U R2'",
        "R2 U2 R2' U R2 U R2' U2' R2 U2 R2' U R2 U2 R2' U' R2 U R2'",
        "R2 U2 R2' U R2 U R2' U2' R2' U2 R2 U R2' U2 R2 U' R2 U R2'",
        "R2 U2 R2' U R2 U2 R2' U R' U2 R' U2' R U' R' U2' R U2 R",
        "R2 U2 R2' U R2 U2 R2' U R' U2' R' U2 R U R' U2 R U2' R",
        "R2 U2 R2' U R2 U' R2 U2 R2' U R2 U2 R2' U2' R2' U R2 U R2'",
        "R2 U2 R2' U R2 U' R2' U2 R2 U R2' U2 R2 U2' R2' U R2 U R2'",
      ],
      [
        "R' U2 R U2 R' U2' R U R' U R U' R' U2 R",
        "R U2 R' U' R U R' U R U2' R' U2 R U2 R'",
        "R2 U' R2' U' R2' U R2' U R2 U2' R' U' R' U2 R U2' R2'",
        "R2 U R' U' R2' U' R2 U2' R2' U2' R2' U2 R' U' R U2' R2'",
        "R2' U2' R U2 R' U' R' U2' R2 U R2' U R2' U' R2' U' R2",
        "R2' U2' R U' R' U2 R2' U2' R2' U2' R2 U' R2' U' R' U R2",
        "R' U2' R U R' U R U' R' U' R2 U2' R2' U2' R2 U' R'",
        "R' U' R2 U2' R2' U2' R2 U' R' U' R U R' U R U2' R'",
        "R U R U2 R U R' U2 R' U2 R U R2 U R2' U' R2' U' R2'",
        "R U R U2' R2 U2 R2 U2 R2' U R2 U R U' R2' U R2 U2' R2'",
        "R U2 R U2' R' U R2' U2 R U R U' R2' U2' R2' U R' U' R'",
        "R U2' R U R U2 R2' U' R2 U' R2 U R2 U R2' U' R2 U2' R2'",
        "R U2' R U R' U' R U R2' U R2 U' R2' U' R U R U' R2'",
        "R U2' R U R' U' R' U R2 U R2' U' R2 U' R' U R U' R2'",
        "R U2' R U2 R2 U' R U' R2' U R' U' R2' U R2' U R2' U2' R2'",
        "R U2' R U2 R2 U' R2 U' R2 U R U' R2 U R' U R2' U2' R2'",
        "R U2' R U2 R2' U R2 U' R2' U' R2' U R2' U R2 U2' R' U' R2'",
        "R U2' R' U R U2' R' U2' R U2 R' U' R U' R' U R U R'",
        "R U' R U' R2 U2 R2 U R' U' R' U2' R2 U' R U2 R' U R'",
        "R2 U' R U2 R' U2' R' U' R U2' R U2' R U R2 U' R' U' R2",
      ],
      [
        "R2 U2' R2' U' R2 U2' R2'",
        "R2' U2' R2 U' R2' U2' R2",
        "R U2 R2 U2' R2' U' R2 U2' R2' U2 R'",
        "R U2 R2' U2' R2 U' R2' U2' R2 U2 R'",
        "R2 U2 R2 U2' R2' U' R2 U2' R2' U2 R2'",
        "R2 U2 R2' U2' R2 U' R2' U2' R2 U2 R2'",
        "R2' U2 R2 U2' R2' U' R2 U2' R2' U2 R2",
        "R2' U2 R2' U2' R2 U' R2' U2' R2 U2 R2",
        "R' U2 R2 U2' R2' U' R2 U2' R2' U2 R",
        "R' U2 R2' U2' R2 U' R2' U2' R2 U2 R",
        "R2 U2' R2' U2 R2 U2 R2' U2' R2 U2 R2'",
        "R2' U2' R2 U2 R2' U2 R2 U2' R2' U2 R2",
        "R2 U2 R2' U2' R2 U2 R2' U2 R2 U2' R2'",
        "R2' U2 R2 U2' R2' U2 R2 U2 R2' U2' R2",
        "R U2 R2 U2' R2' U2 R2 U2 R2' U2' R2 U2 R2",
        "R U2 R2' U2' R2 U2 R2' U2 R2 U2' R2' U2 R",
        "R2 U2 R2 U2' R2' U2 R2 U2 R2' U2' R2 U2 R",
        "R2' U2 R2' U2' R2 U2 R2' U2 R2 U2' R2' U2 R'",
        "R' U2 R2 U2' R2' U2 R2 U2 R2' U2' R2 U2 R'",
        "R' U2 R2' U2' R2 U2 R2' U2 R2 U2' R2' U2 R2'",
      ],
      [
        "R2 U2 R2' U R2 U2 R2'",
        "R2' U2 R2 U R2' U2 R2",
        "R U2' R2 U2 R2' U R2 U2 R2' U2' R'",
        "R U2' R2' U2 R2 U R2' U2 R2 U2' R'",
        "R2 U2' R2 U2 R2' U R2 U2 R2' U2' R2'",
        "R2 U2' R2' U2 R2 U R2' U2 R2 U2' R2'",
        "R2' U2' R2 U2 R2' U R2 U2 R2' U2' R2",
        "R2' U2' R2' U2 R2 U R2' U2 R2 U2' R2",
        "R' U2' R2 U2 R2' U R2 U2 R2' U2' R",
        "R' U2' R2' U2 R2 U R2' U2 R2 U2' R",
        "R2 U2 R2' U2' R2 U2' R2' U2 R2 U2' R2'",
        "R2' U2 R2 U2' R2' U2' R2 U2 R2' U2' R2",
        "R2 U2' R2' U2 R2 U2' R2' U2' R2 U2 R2'",
        "R2' U2' R2 U2 R2' U2' R2 U2' R2' U2 R2",
        "R U2' R2 U2 R2' U2' R2 U2' R2' U2 R2 U2' R2",
        "R U2' R2' U2 R2 U2' R2' U2' R2 U2 R2' U2' R",
        "R2 U2' R2 U2 R2' U2' R2 U2' R2' U2 R2 U2' R",
        "R2' U2' R2' U2 R2 U2' R2' U2' R2 U2 R2' U2' R'",
        "R' U2' R2 U2 R2' U2' R2 U2' R2' U2 R2 U2' R'",
        "R' U2' R2' U2 R2 U2' R2' U2' R2 U2 R2' U2' R2'",
      ],
      [
        "R' U2' R U' R U R2' U2 R U2' R U' R'",
        "R2' U' R U' R U' R U R2' U R' U R2 U2' R U' R'",
        "R' U2' R U' R U R U' R2 U2' R U2 R2 U R' U' R'",
        "R' U2' R U' R' U2' R' U2 R2' U R2 U2 R2 U2' R U' R'",
        "R U R' U' R2 U R2 U2 R2' U2 R2 U R U2 R U2' R'",
        "R U2 R U2' R U2 R2' U R2 U2 R2' U R U2 R' U2' R'",
        "R U2 R U2' R2 U2 R2 U R2' U2 R2 U R U2 R' U2' R'",
        "R U2 R' U2' R' U2 R2 U2 R2' U R2 U2 R' U2 R U2' R'",
        "R U2 R' U2' R' U2 R2' U2 R2 U R2' U2 R2' U2 R U2' R'",
        "R U' R' U2' R U' R U R2' U2 R U2' R U' R' U' R'",
        "R2 U2 R2' U2 R2' U2 R2' U2' R' U' R U2' R2 U2 R' U2 R2'",
        "R2 U' R' U2' R U' R U R2' U2 R U2' R U' R' U' R2'",
        "R2' U' R' U2' R U' R U R2' U2 R U2' R U' R' U' R2",
        "R' U' R' U2' R U' R U R2' U2 R U2' R U' R' U' R",
        "R2' U' R2' U R2' U R2' U R2 U' R2 U' R' U R2' U2' R'",
        "R2 U R U' R' U R2' U2 R2 U2 R2' U2 R2' U R' U' R2'",
        "R2' U2 R2' U2 R2' U2' R' U' R U2' R2 U2 R' U2 R2' U2 R2",
        "R2 U R2 U' R U2' R' U2' R2' U R' U' R' U2' R U2' R U R2'",
        "R2' U R2 U2 R U R U2 R2 U2' R2 U2 R' U' R2 U' R U' R'",
        "R' U2 R2' U2 R U2' R U R2 U' R' U2 R2' U' R U R2",
      ],
      [
        "R U2 R' U R' U' R2 U2' R' U2 R' U R",
        "R U2 R' U R U2 R U2' R2 U' R2' U2' R2' U2 R' U R",
        "R U2 R' U R' U' R' U R2' U2 R' U2' R2' U' R U R",
        "R2 U R' U R' U R' U' R2 U' R U' R2' U2 R' U R",
        "R' U2' R U2 R U2' R2 U2' R2' U' R2 U2' R2 U2' R' U2 R",
        "R' U2' R U2 R U2' R2' U2' R2 U' R2' U2' R U2' R' U2 R",
        "R2 U2' R2 U2' R2 U2 R U R' U2 R2' U2' R U2' R2 U2' R2'",
        "R2' U' R' U R U' R2 U2' R2' U2' R2 U2' R2 U' R U R2",
        "R' U2' R' U2 R2' U2' R2' U' R2 U2' R2' U' R' U2' R U2 R",
        "R' U2' R' U2 R' U2' R2 U' R2' U2' R2 U' R' U2' R U2 R",
        "R' U' R U R2' U' R2' U2' R2 U2' R2' U' R' U2' R' U2 R",
        "R2 U R2 U' R2 U' R2 U' R2' U R2' U R U' R2 U2 R",
        "R U R U2 R' U R' U' R2 U2' R' U2 R' U R U R'",
        "R2 U R U2 R' U R' U' R2 U2' R' U2 R' U R U R2'",
        "R2' U R U2 R' U R' U' R2 U2' R' U2 R' U R U R2",
        "R2' U2' R2 U2' R2 U2' R2 U2 R U R' U2 R2' U2' R U2' R2",
        "R' U R U2 R' U R' U' R2 U2' R' U2 R' U R U R",
        "R U2 R' U R U2 R2' U2 R U R' U2 R2' U2' R2' U' R2 U2' R2'",
        "R U2 R' U R U2 R2' U2 R U R' U2 R' U2' R2 U' R2' U2' R2",
        "R U2 R' U R' U2' R2' U R2 U R U' R2 U' R2' U2 R U2 R'",
      ],
      [
        "R U R' U2 R' U2' R2 U' R' U R' U2 R",
        "R U2 R' U2' R U2' R2' U' R2 U2' R2' U2' R U2 R U2' R'",
        "R U2 R' U2' R2 U2' R2 U' R2' U2' R2 U2' R U2 R U2' R'",
        "R U R U' R2' U2' R' U2 R2' U R' U' R' U R' U2 R",
        "R U R' U2 R2' U2' R2' U' R2 U2' R U2 R U R' U2 R",
        "R U R' U2 R2' U' R U' R2 U' R' U R' U R' U R2",
        "R U2 R U2' R' U' R2 U2' R2' U' R2 U2' R' U2 R' U2' R'",
        "R U2 R U2' R' U' R2' U2' R2 U' R2' U2' R2' U2 R' U2' R'",
        "R U2 R' U2' R' U' R2' U2' R2 U2' R2' U' R2' U R U' R'",
        "R2 U R U' R2 U2' R2 U2' R2' U2' R2 U' R U R' U' R2'",
        "R U2 R2 U' R U R2' U R2' U' R2 U' R2 U' R2 U R2",
        "R2 U2' R U2' R2' U2 R' U R U2 R2 U2' R2 U2' R2 U2' R2'",
        "R U R U R' U2 R' U2' R2 U' R' U R' U2 R U R'",
        "R2 U R U R' U2 R' U2' R2 U' R' U R' U2 R U R2'",
        "R2' U R U R' U2 R' U2' R2 U' R' U R' U2 R U R2",
        "R2' U2' R2 U2' R U2' R2' U2 R' U R U2 R2 U2' R2 U2' R2",
        "R' U R U R' U2 R' U2' R2 U' R' U R' U2 R U R",
        "R U R' U R2' U R U2' R2' U2 R2' U2' R' U' R' U2' R2' U' R2",
        "R2 U' R' U2 R' U2 R U R U' R2 U2 R U2 R' U R2' U' R2'",
        "R' U' R2' U' R' U R2 U2' R U R2' U' R' U2 R' U2' R2 U2' R",
      ],
      [
        "R' U' R U2' R U2 R2' U R U' R U2' R'",
        "R' U' R U2' R2 U R' U R2' U R U' R U' R U' R2'",
        "R' U' R U2' R2 U2 R2 U R2' U2 R' U2' R' U' R U2' R'",
        "R' U' R' U R2 U2 R U2' R2 U' R U R U' R U2' R'",
        "R2' U2 R' U2 R2 U2' R U' R' U2' R2' U2 R2' U2 R2' U2 R2",
        "R' U2' R U2 R2' U2 R2' U R2 U2 R2' U2 R' U2' R' U2 R",
        "R' U2' R U2 R' U2 R2 U R2' U2 R2 U2 R' U2' R' U2 R",
        "R' U2' R2' U R' U' R2 U' R2 U R2' U R2' U R2' U' R2'",
        "R2' U' R' U R2' U2 R2' U2 R2 U2 R2' U R' U' R U R2",
        "R' U2' R U2 R U R2 U2 R2' U2 R2 U R2 U' R' U R",
        "R' U2' R' U2 R U R2 U2 R2' U R2 U2 R2 U2' R U2 R",
        "R' U2' R' U2 R U R2' U2 R2 U R2' U2 R U2' R U2 R",
        "R U' R' U' R U2' R U2 R2' U R U' R U2' R' U' R'",
        "R2 U2 R2' U2 R' U2 R2 U2' R U' R' U2' R2' U2 R2' U2 R2'",
        "R2 U' R' U' R U2' R U2 R2' U R U' R U2' R' U' R2'",
        "R2' U' R' U' R U2' R U2 R2' U R U' R U2' R' U' R2",
        "R' U' R' U' R U2' R U2 R2' U R U' R U2' R' U' R",
        "R U2' R' U2' R2 U R2' U R' U' R2' U' R2 U2 R U' R U2' R'",
        "R U' R' U2 R U2 R' U R' U' R U2' R' U2' R U2' R U2' R'",
        "R2 U R2' U R2 U2 R2' U R2 U2' R2' U2 R2 U2 R2' U2 R2 U' R2'",
      ],
      [
        "R U2 R U2' R' U2' R' U2 R2 U2 R2' U' R U' R'",
        "R U2' R2 U2' R2' U' R2 U2' R2 U2' R U2' R' U' R U2' R'",
        "R U2' R2 U2' R2' U' R2 U2' R2 U' R U2 R' U R U2 R'",
        "R U2' R2' U2' R2 U' R2' U2' R U2' R U2' R' U' R U2' R'",
        "R U2' R2' U2' R2 U' R2' U2' R U' R U2 R' U R U2 R'",
        "R U2 R2' U R2' U' R' U R2' U' R U2' R2 U2' R U2 R' U2' R2",
        "R U2 R' U R2 U' R U R2 U' R2 U2' R2 U2' R U2 R' U2' R2",
        "R U2' R' U2' R U2' R' U' R U2' R' U R2' U2 R2' U R2 U2 R2",
        "R U2' R' U2' R U2' R' U' R U2' R' U R' U2 R2 U R2' U2 R",
        "R U2' R' U' R U2 R' U R U2 R' U2 R2' U2 R2' U R2 U2 R2",
        "R U2' R' U' R U2 R' U R U2 R' U2 R' U2 R2 U R2' U2 R",
        "R U' R' U R2 U2' R2' U2' R U2 R U2 R' U2' R' U' R U2' R'",
        "R2' U2 R U R2' U2 R2 U2' R2' U' R' U2 R2' U2' R U2 R U' R2",
        "R2' U2 R U2' R2' U2' R2 U2 R2' U2 R' U2 R2' U2' R U2 R U' R2",
        "R2' U' R' U2' R' U2 R2 U2' R U R2 U2 R2' U2' R2 U' R' U R2",
        "R2' U' R' U2' R' U2 R2 U2' R U2' R2 U2' R2' U2 R2 U2 R' U R2",
        "R' U2' R' U2 R2' U2 R2' U R2' U' R' U R2' U' R U2' R2 U2' R2",
        "R' U2' R' U2 R2' U2 R' U R2 U' R U R2 U' R2 U2' R2 U2' R2",
        "R' U' R U R2 U2' R' U2 R' U2 R U2 R2' U R2' U2 R' U R'",
        "R U R U2' R U2 R' U2' R' U R U2 R U2' R2 U' R2 U2' R2'",
      ],
      [
        "R' U2' R' U2 R U2 R U2' R2' U2' R2 U R'",
        "R' U2 R2 U2 R2' U R2 U2 R' U R' U2' R U' R' U2' R",
        "R' U2 R2 U2 R2' U R2 U2 R' U2 R' U2 R U R' U2 R",
        "R' U2 R2' U2 R2 U R2' U2 R2' U R' U2' R U' R' U2' R",
        "R' U2 R2' U2 R2 U R2' U2 R2' U2 R' U2 R U R' U2 R",
        "R2 U' R2' U' R' U R2' U R2' U2' R2' U2' R2 U R' U' R' U2 R2",
        "R' U2' R U R U2' R2' U2' R2' U2 R' U' R U' R2' U2 R U2 R'",
        "R' U' R2 U R2' U R2 U2' R' U R U2' R2' U2' R U R U2' R'",
        "R' U2 R' U2' R U2 R U2' R' U' R U2' R2' U2' R2 U R'",
        "R' U2' R' U2 R2 U2 R' U' R' U2 R2 U2 R' U' R U R'",
        "R2 U R' U R U2' R2 U2 R2 U2 R' U' R' U2 R U' R U2 R'",
        "R U R2' U2 R' U2' R2' U' R2' U2 R U2' R2' U2' R2 U R'",
        "R U2' R U2 R U R' U2' R' U2 R U2' R U R2 U R2 U2 R2'",
        "R U2' R U2 R U' R' U2 R' U2' R U2 R U' R2 U R2 U2 R2'",
        "R2 U R2' U R U' R' U R U R U2 R' U2 R' U2 R U2' R'",
        "R2 U2' R U2 R U R' U2' R' U2 R U2' R U R U R2' U2 R2",
        "R2 U2' R U2 R U' R' U2 R' U2' R U2 R U' R U R2' U2 R2",
        "R2 U2' R2 U2 R' U2' R U2 R U' R' U2 R' U2' R U2 R2' U2 R2'",
        "R2' U R' U2' R' U2 R U2' R U R' U2' R' U2 R' U R2 U2 R2'",
        "R2' U2' R U R' U2 R' U2' R U2 R U2 R' U2 R2 U R2 U2 R2'",
      ],
      [
        "R U R' U R2 U2' R2' U2' R U2 R U2 R' U2' R'",
        "R U2' R' U' R U2' R' U R2' U2 R2' U R2 U2 R2' U2 R'",
        "R U2' R' U' R U2' R' U R' U2 R2 U R2' U2 R2 U2 R'",
        "R U2 R' U R U2 R' U2 R2' U2 R2' U R2 U2 R2' U2 R'",
        "R U2 R' U R U2 R' U2 R' U2 R2 U R2' U2 R2 U2 R'",
        "R U R' U2 R U2 R' U R2 U2' R' U2' R U' R2' U2 R U R'",
        "R' U2 R U R' U R2 U2' R2 U2' R2 U R U2' R2 U2' R U2 R",
        "R' U2' R U R' U R2 U2' R2' U2' R U' R' U2' R U2 R U2' R'",
        "R2 U2 R U2' R2' U2 R2 U2 R2' U2 R U2' R' U R U2 R U2' R2",
        "R U2' R2' U2' R2' U2 R2 U' R2' U' R' U' R2' U R U2' R' U2' R",
        "R' U2' R2 U2' R2' U2' R U2 R U2 R' U' R' U R U' R' U2' R",
        "R' U2' R2' U2 R U R2 U2 R2' U2 R2 U2 R2 U2' R2' U' R' U2' R",
        "R' U' R2 U2 R2' U' R2 U' R' U2 R2' U2' R U' R' U2' R U2' R",
        "R U R' U R2 U2' R U R2 U2 R U2' R2 U' R' U2 R' U2' R'",
        "R U R' U R2 U2' R2' U2' R U2 R2' U' R2' U2' R' U2 R2'",
        "R U R' U2 R U2' R U R2' U2 R2 U2 R' U2' R' U2' R U2' R'",
        "R U R' U' R2 U2 R2' U2' R2 U2 R2' U R U2 R U2 R' U2' R'",
        "R U2' R2 U' R' U' R U R U R2 U2' R' U R U R U2 R'",
        "R2 U2 R U2' R' U2 R2' U R U R U2' R U2 R' U2' R' U R'",
        "R2 U2 R U2' R' U2 R2' U R U' R U2 R U2' R' U2 R' U' R'",
      ],
      [
        "R' U' R U' R2' U2 R2 U2 R' U2' R' U2' R U2 R",
        "R' U2' R U' R' U2' R U2' R U2' R2' U' R2 U2' R2' U2' R",
        "R' U2' R U' R' U2' R U2' R2 U2' R2 U' R2' U2' R2 U2' R",
        "R' U2 R U R' U2 R U' R U2' R2' U' R2 U2' R2' U2' R",
        "R' U2 R U R' U2 R U' R2 U2' R2 U' R2' U2' R2 U2' R",
        "R U2 R' U2' R U2' R U2' R' U' R' U' R U R' U' R2 U' R2'",
        "R2 U2' R2 U2' R' U2 R U2' R U R' U2' R' U2 R U2' R2' U2 R2'",
        "R2 U2' R2' U' R U2' R U2 R U R' U2' R' U2 R U2' R U R2",
        "R2 U2' R2' U' R U2' R U2 R U' R' U2 R' U2' R U2 R U' R2",
        "R2 U2' R2' U' R2' U R' U2' R' U2 R U2' R U R' U2' R' U2 R'",
        "R2 U2' R2' U' R2' U2' R U R' U2 R' U2' R U2 R U2 R' U2 R2",
        "R2 U2' R2' U' R2' U2' R U2' R' U2' R' U2 R U2' R U' R' U2 R2",
        "R2 U2' R2' U' R2' U' R' U2 R' U2' R U2 R U' R' U2' R' U2 R'",
        "R2' U2' R U2' R' U2 R U2' R U R' U2' R' U2 R U2' R' U2 R2",
        "R2' U2' R2 U' R2 U2' R U2 R U R' U2' R' U2 R U2' R",
        "R2' U2' R2 U' R2 U2' R U2 R U' R' U2 R' U2' R U2 R U' R",
        "R2' U2' R2 U' R' U R' U2' R' U2 R U2' R U R' U2' R' U2 R2'",
        "R2' U2' R2 U' R' U2' R U R' U2 R' U2' R U2 R U2 R' U2 R",
        "R2' U2' R2 U' R' U2' R U2' R' U2' R' U2 R U2' R U' R' U2 R",
        "R2' U2' R2 U' R' U' R' U2 R' U2' R U2 R U' R' U2' R' U2 R2'",
      ],
      [
        "R U R' U' R2' U R2 U R U' R2 U' R2",
        "R2' U R2' U R' U' R2' U' R2 U R U' R'",
        "R U2' R U2 R' U2' R' U R U2 R U2' R' U2 R'",
        "R U2' R' U2 R' U2 R U2 R U2' R' U2 R'",
        "R U2' R' U2 R' U' R U2' R U2 R' U2' R' U2' R",
        "R' U2 R U2 R U2' R' U2 R' U R U2' R U2 R'",
        "R' U2' R' U R U2' R U2 R' U2' R' U R U2 R",
        "R' U2' R' U' R U2 R U2' R' U2 R' U' R U2 R",
        "R' U' R U2' R U2 R' U2' R' U2' R U2' R U2 R'",
        "R U2 R U2' R' U2 R' U' R U2 R U2' R' U2 R'",
        "R U2 R U2' R' U2 R' U2 R U2 R U2' R' U2 R'",
        "R U2 R U2' R' U2 R' U' R U2' R U2 R' U2' R'",
        "R U2 R' U2' R' U R U2' R U2 R' U2' R' U R",
        "R U2 R' U2' R' U' R U2 R U2' R' U2 R' U' R",
        "R' U R U2' R U2 R' U2' R' U R U2 R U2' R'",
        "R' U2 R' U2 R U2 R U2' R' U2 R' U R U2' R",
        "R' U2 R' U' R U2' R U2 R' U2' R' U2' R U2' R",
        "R' U' R U2 R U2' R' U2 R' U' R U2 R U2' R'",
        "R U R U2' R' U2 R' U R U2 R U2' R' U2' R'",
        "R U2' R U2 R' U2' R' U2' R U2' R U2 R' U2' R'",
      ],
      [
        "R' U' R U R2 U' R2' U' R' U R2' U R2'",
        "R2 U' R2 U' R U R2 U R2' U' R' U R",
        "R U R' U2 R' U2' R U2 R U2 R' U2 R' U2' R",
        "R U2 R U R' U2' R' U2 R U2' R U R' U2' R'",
        "R U2 R U' R' U2 R' U2' R U2 R U' R' U2' R'",
        "R U2' R' U2' R' U2 R U2' R U' R' U2 R' U2' R",
        "R' U2 R U2' R U R' U2 R' U2' R U2 R U2 R'",
        "R' U2 R U2' R U2' R' U2' R' U2 R U2' R U' R'",
        "R' U2 R' U2' R U2 R U' R' U2' R' U2 R U2' R",
        "R' U2' R' U2 R U2' R U R' U2' R' U2 R U2' R",
        "R' U2 R' U2' R U2 R U R' U2' R' U2 R U2' R",
        "R' U2 R' U2' R U2 R U' R' U2 R' U2' R U2 R",
        "R2' U' R' U2 R2 U2' R U' R' U2' R2' U2 R U2 R2",
        "R' U2 R' U2' R U2 R U2 R' U2 R' U2' R U2 R",
        "R' U' R' U2 R U2' R U' R' U2' R' U2 R U2 R",
        "R U R' U2' R' U2 R U2' R U R' U2' R' U2 R",
        "R U2' R U R' U2 R' U2' R U2 R U2 R' U2 R'",
        "R U2' R U2' R' U2' R' U2 R U2' R U' R' U2 R'",
        "R U' R' U2 R' U2' R U2 R U' R' U2' R' U2 R",
        "R' U2' R U2 R U R' U2' R' U2 R U2' R U R'",
      ],
      [
        "R2 U R2' U2 R2 U2 R2' U2' R2 U R2' U2 R2 U2 R2'",
        "R2 U R2' U' R2 U2' R2' U2 R2 U' R2' U2 R2 U2 R2'",
        "R2' U R2 U2 R2' U2 R2 U2' R2' U R2 U2 R2' U2 R2",
        "R2' U R2 U' R2' U2' R2 U2 R2' U' R2 U2 R2' U2 R2",
        "R U2 R2 U R2' U2 R2 U2 R2 U2' R2' U R2 U2 R2' U2 R2",
        "R U2 R' U' R2 U R2' U R U' R U' R2' U2 R U2 R'",
        "R2 U2 R U R' U' R2' U2' R2 U R U' R2 U2' R2 U2 R2'",
        "R' U2 R2' U R2 U2 R2' U2 R2' U2' R2 U R2' U2 R2 U2 R2'",
        "R2 U R2' U2 R2 U2 R2' U R' U2 R2' U R2 U2 R2' U2 R2'",
        "R2 U R2' U2 R2' U2 R2 U2' R2' U R2 U2 R2' U2' R' U' R2'",
        "R2 U R2' U' R2' U2' R2 U2 R2' U' R2 U2 R2' U2' R' U' R2'",
        "R2 U2' R U2' R2 U' R2' U2' R2 U2 R2 U' R2' U2 R2 U2 R2'",
        "R2 U2' R2 U2' R U' R2 U2' R2' U2' R2 U2' R2 U2 R2' U2 R2'",
        "R2' U R2 U2 R2 U2 R2' U2' R2 U R2' U2 R2 U2' R U' R2",
        "R2' U R2 U2 R2' U2 R2 U R U2 R2 U R2' U2 R2 U2 R2",
        "R2' U R2 U' R2 U2' R2' U2 R2 U' R2' U2 R2 U2' R U' R2",
        "R2' U2' R' U2' R2' U' R2 U2' R2' U2 R2' U' R2 U2 R2' U2 R2",
        "R' U R U2 R2 U2 R2' U2' R2 U R2' U2 R2 U2' R2 U' R",
        "R' U R U2 R2' U2 R2 U2' R2' U R2 U2 R2' U2' R U' R",
        "R' U R U' R2 U2' R2' U2 R2 U' R2' U2 R2 U2' R2 U' R",
      ],
      [
        "R2 U' R2' U R2 U2 R2' U2' R2 U R2' U2' R2 U2' R2'",
        "R2 U' R2' U2' R2 U2' R2' U2 R2 U' R2' U2' R2 U2' R2'",
        "R2' U' R2 U R2' U2 R2 U2' R2' U R2 U2' R2' U2' R2",
        "R2' U' R2 U2' R2' U2' R2 U2 R2' U' R2 U2' R2' U2' R2",
        "R U' R2' U' R U' R' U2 R U R U R' U2 R U2' R'",
        "R U' R' U R2 U2 R2' U2' R2 U R2' U2' R2 U2 R' U R'",
        "R U' R' U R2' U2 R2 U2' R2' U R2 U2' R2' U2 R2' U R'",
        "R U' R' U2' R2 U2' R2' U2 R2 U' R2' U2' R2 U2 R' U R'",
        "R U' R' U2' R2' U2' R2 U2 R2' U' R2 U2' R2' U2 R2' U R'",
        "R2 U2 R U2 R2 U R2' U2 R2 U2' R2 U R2' U2' R2 U2' R2'",
        "R2 U' R2' U R2' U2 R2 U2' R2' U R2 U2' R2' U2 R' U R2'",
        "R2 U' R2' U2' R2 U2' R2' U' R' U2' R2' U' R2 U2' R2' U2' R2'",
        "R2 U' R2' U2' R2' U2' R2 U2 R2' U' R2 U2' R2' U2 R' U R2'",
        "R2' U2 R2' U2 R' U R2' U2 R2 U2 R2' U2 R2' U2' R2 U2' R2",
        "R2' U2 R' U2 R2' U R2 U2 R2' U2' R2' U R2 U2' R2' U2' R2",
        "R2' U' R2 U R2 U2 R2' U2' R2 U R2' U2' R2 U2 R U R2",
        "R2' U' R2 U2' R2 U2' R2' U2 R2 U' R2' U2' R2 U2 R U R2",
        "R2' U' R2 U2' R2' U2' R2 U' R U2' R2 U' R2' U2' R2 U2' R2",
        "R U2' R2 U' R2' U2' R2 U2' R2 U2 R2' U' R2 U2' R2' U2' R2",
        "R2' U2' R' U' R U R2 U2 R2' U' R' U R2' U2 R2' U2' R2",
      ],
      [
        "R2 U2' R2' U2' R2 U R2' U2' R2 U2 R2' U R2 U' R2'",
        "R2 U2' R2' U2' R2 U' R2' U2 R2 U2' R2' U2' R2 U' R2'",
        "R2' U2' R2 U2' R2' U R2 U2' R2' U2 R2 U R2' U' R2",
        "R2' U2' R2 U2' R2' U' R2 U2 R2' U2' R2 U2' R2' U' R2",
        "R U2' R' U' R U2' R' U2 R U2' R2' U' R2 U2' R2' U2' R",
        "R U2' R' U' R U2' R' U2 R2 U2' R2 U' R2' U2' R2 U2' R",
        "R U2 R' U R U2 R' U2' R U2' R2' U' R2 U2' R2' U2' R",
        "R U2 R' U R U2 R' U2' R2 U2' R2 U' R2' U2' R2 U2' R",
        "R U2 R U2' R' U' R U2' R' U2 R U2' R2' U' R2 U2' R2'",
        "R U2 R U2' R' U' R U2' R' U2 R2 U2' R2 U' R2' U2' R2",
        "R U2' R U2 R' U R U2 R' U2' R U2' R2' U' R2 U2' R2'",
        "R U2' R U2 R' U R U2 R' U2' R2 U2' R2 U' R2' U2' R2",
        "R U2 R2 U2' R2' U2' R' U' R2' U2 R2 U R U2 R2 U2 R2",
        "R2' U2 R2' U R' U2 R2' U2 R2 U2 R2' U2' R2 U2' R U' R'",
        "R2' U2 R2' U R' U2 R2' U' R2 U2' R2' U2 R2 U R U' R'",
        "R2' U2 R' U R2' U2 R2' U2 R2 U2 R2' U R' U' R U2' R2",
        "R' U2 R2 U2' R2' U' R2 U' R' U' R' U2 R U R U' R'",
        "R U2' R' U2' R2 U R' U R' U' R2 U' R2' U R U2' R'",
        "R2 U R U2 R2 U2' R2' U R2 U2' R2' U2 R2 U R2 U' R2'",
        "R2 U R U2 R2 U2' R2' U' R2 U2 R2' U2' R2 U2' R2 U' R2'",
      ],
      [
        "R2 U2 R2' U2 R2 U R2' U2' R2 U2 R2' U2 R2 U R2'",
        "R2 U2 R2' U2 R2 U' R2' U2 R2 U2' R2' U' R2 U R2'",
        "R2' U2 R2 U2 R2' U R2 U2' R2' U2 R2 U2 R2' U R2",
        "R2' U2 R2 U2 R2' U' R2 U2 R2' U2' R2 U' R2' U R2",
        "R U2 R' U2' R U' R' U' R' U2' R U R' U R2 U R'",
        "R U' R U2' R2' U2 R2 U R2' U2' R2 U2 R2' U2 R U R'",
        "R U' R U2' R2' U2 R2 U' R2' U2 R2 U2' R2' U' R U R'",
        "R U' R2 U2' R2 U2 R2' U R2 U2' R2' U2 R2 U2 R U R'",
        "R U' R2 U2' R2 U2 R2' U' R2 U2 R2' U2' R2 U' R U R'",
        "R2 U2 R2 U2 R2' U R2 U2 R U R2 U2 R2' U2 R2 U R2'",
        "R2 U2 R2' U2 R2 U' R2' U2 R2' U2' R2 U' R2' U2' R' U2' R2'",
        "R2 U' R U2' R2 U2 R2' U R2 U2' R2' U2 R2 U2 R2 U R2'",
        "R2 U' R U2' R2 U2 R2' U' R2 U2 R2' U2' R2 U' R2 U R2'",
        "R2' U2 R2 U2 R2' U' R2 U2 R2 U2' R2' U' R2 U2' R U2' R2",
        "R2' U2 R2' U2 R2 U R2' U2 R' U R2' U2 R2 U2 R2' U R2",
        "R2' U2 R2' U2 R2 U2' R2 U2' R2' U2' R2 U' R U2' R2 U2' R2",
        "R2' U' R' U2' R2' U2 R2 U R2' U2' R2 U2 R2' U2 R2' U R2",
        "R2' U' R' U2' R2' U2 R2 U' R2' U2 R2 U2' R2' U' R2' U R2",
        "R U2' R2' U2 R2 U R2' U R U R U2' R' U' R'",
        "R2 U2' R2 U' R U2' R2 U R2' U2 R2 U2' R2' U' R'",
      ],
      [
        "R2 U R2 U' R2 U' R2' U2 R U R U2' R U' R2'",
        "R U2' R U R U2 R2' U' R2 U' R2 U R2 U2' R2'",
        "R2' U2' R2 U R2 U' R2 U' R2' U2 R U R U2' R",
        "R2' U' R U2' R U R U2 R2' U' R2 U' R2 U R2",
        "R2 U R' U2 R' U' R' U2' R2 U R2' U R2' U' R2'",
        "R2 U2 R2' U' R2' U R2' U R2 U2' R' U' R' U2 R'",
        "R' U2 R' U' R' U2' R2 U R2' U R2' U' R2' U2 R2",
        "R2' U' R2' U R2' U R2 U2' R' U' R' U2 R' U R2",
        "R U2' R2 U R2 U' R2 U' R2' U2 R U R U2' R U' R2",
        "R U' R U2' R U R U2 R2' U' R2 U' R2 U R2 U2' R2",
        "R2 U2' R2 U R2 U' R2 U' R2' U2 R U R U2' R U' R",
        "R2 U' R U2' R U R U2 R2' U' R2 U' R2 U R2 U2' R",
        "R' U2' R2 U R2 U' R2 U' R2' U2 R U R U2' R U' R'",
        "R' U' R U2' R U R U2 R2' U' R2 U' R2 U R2 U2' R'",
        "R U R' U2 R' U' R' U2' R2 U R2' U R2' U' R2' U2 R",
        "R U2 R2' U' R2' U R2' U R2 U2' R' U' R' U2 R' U R",
        "R2' U R' U2 R' U' R' U2' R2 U R2' U R2' U' R2' U2 R'",
        "R2' U2 R2' U' R2' U R2' U R2 U2' R' U' R' U2 R' U R'",
        "R' U R' U2 R' U' R' U2' R2 U R2' U R2' U' R2' U2 R2'",
        "R' U2 R2' U' R2' U R2' U R2 U2' R' U' R' U2 R' U R2'",
      ],
      [
        "R U2' R U R U2 R2' U' R2 U' R2 U2 R2 U2 R2'",
        "R' U2' R U' R U R' U2 R U2 R' U2 R' U2' R",
        "R2' U R2' U2 R U2 R' U2 R U R U' R2 U2' R U R'",
        "R' U' R U2 R U R' U2 R' U2' R2 U' R' U R' U2' R",
        "R U R U R2 U R2 U' R2' U' R U R2' U2' R' U2' R2' U' R2",
        "R U2' R' U2 R U' R' U' R2 U2 R2' U R U' R U2' R' U R'",
        "R U' R' U2 R U2' R' U' R U2' R' U R U R' U R U R'",
        "R U' R' U2' R U2 R' U R U2 R' U2 R U R' U R U R'",
        "R2 U' R2' U2' R U2 R' U R U' R U R' U2 R' U' R2 U R2'",
        "R2 U' R2' U2' R2 U R2' U2 R2 U' R2' U' R2 U' R2' U' R2 U2' R2'",
        "R2' U' R2 U2' R2' U R2 U2 R2' U' R2 U' R2' U' R2 U' R2' U2' R2",
        "R' U R U R' U R U' R U R' U2 R U2 R' U R' U' R",
        "R' U2 R U2 R2 U2' R U2' R U2 R' U2 R2 U2' R U' R U R'",
        "R' U2 R' U2' R2' U R U' R' U R2' U' R2' U R2' U' R2 U2 R2",
        "R2 U R' U R' U' R2 U' R' U R' U2' R U R' U2 R U' R'",
        "R2 U R' U' R' U2 R2' U2' R2' U2' R2 U' R2' U' R' U2 R2 U2 R2'",
        "R2 U2 R2' U R2 U2' R2' U R2 U' R2' U R2 U R2' U2' R2 U' R2'",
        "R2 U2 R2' U R2 U2' R2' U2 R2 U' R2' U' R2 U R2' U' R2 U' R2'",
        "R2 U2 R2' U2' R2 U' R2' U R2 U R2' U2' R2 U2 R2' U R2 U' R2'",
        "R2 U2 R2' U2' R2 U' R2' U R2 U' R2' U2 R2 U2' R2' U2' R2 U' R2'",
      ],
      [
        "R U2 R' U R' U' R U2' R' U2' R U2' R U2 R'",
        "R' U2 R' U' R' U2' R2 U R2' U R2' U2' R2' U2' R2",
        "R U R' U2' R' U' R U2' R U2 R2' U R U' R U2 R'",
        "R2 U' R2 U2' R' U2' R U2' R' U' R' U R2' U2 R' U' R",
        "R U' R' U2' R2 U R2' U R' U' R2' U' R2 U2 R U' R U2 R'",
        "R2 U R2' U2' R' U' R U2' R U2 R2' U R U' R U2' R U' R2'",
        "R2 U2 R2' U R2 U2 R2' U R2 U2' R2' U2 R2 U2 R2' U2 R2 U2' R2'",
        "R2 U2 R2' U R2 U2 R2' U R2' U2' R2 U2 R2' U2 R2 U2 R2' U2' R2",
        "R2 U2 R2' U R2 U2 R2' U' R2 U2 R2' U2' R2 U' R2' U2 R2 U2' R2'",
        "R2 U2 R2' U R2 U2 R2' U' R2' U2 R2 U2' R2' U' R2 U2 R2' U2' R2",
        "R2' U R2 U2' R' U' R U2' R U2 R2' U R U' R U2' R2 U' R2",
        "R2' U2 R2 U R2' U2 R2 U R2 U2' R2' U2 R2 U2 R2' U2 R2 U2' R2'",
        "R2' U2 R2 U R2' U2 R2 U R2' U2' R2 U2 R2' U2 R2 U2 R2' U2' R2",
        "R2' U2 R2 U R2' U2 R2 U' R2 U2 R2' U2' R2 U' R2' U2 R2 U2' R2'",
        "R2' U2 R2 U R2' U2 R2 U' R2' U2 R2 U2' R2' U' R2 U2 R2' U2' R2",
        "R2' U2' R U2 R2' U2 R' U2 R2' U2' R2' U2 R2' U R2 U2' R' U2 R2",
        "R2' U' R2' U' R U' R' U R' U' R2 U R' U R U' R U2 R2",
        "R' U' R2' U R' U' R2 U' R2' U R2' U R2' U' R2' U' R2 U2 R",
        "R' U' R' U' R2' U' R2' U R2 U R' U' R2 U' R2' U R2 U2 R",
        "R2' U2' R2 U' R U R' U' R2' U2 R2 U R U' R' U' R2' U R2",
      ],
      [
        "R2 U2' R2' U2' R2' U R2' U R2 U2' R' U' R' U2 R'",
        "R' U2 R U2' R U2' R' U2' R U' R' U R' U2 R",
        "R U' R' U2 R2' U R' U' R' U2' R U2' R' U2' R2 U' R2",
        "R' U2 R U' R U R2' U2 R U2' R U' R' U2' R' U R",
        "R U R' U2' R U' R' U2 R U' R U R2' U R U' R U' R2'",
        "R U' R U2' R2 U' R2 U2' R' U2' R U2' R' U' R' U R2' U2 R2'",
        "R2 U R U2' R2' U2' R2 U' R' U' R' U2 R U' R' U2' R U2' R2'",
        "R2 U R2' U R2 U' R2' U R2 U R2' U2' R2 U2 R2' U' R2 U2' R2'",
        "R2 U R2' U R2 U' R2' U R2 U' R2' U2 R2 U2' R2' U R2 U2' R2'",
        "R2 U R2' U2 R2 U2 R2' U2' R2 U R2' U' R2 U R2' U2 R2 U2' R2'",
        "R2 U R2' U2 R2 U' R2' U' R2 U R2' U' R2 U2 R2' U' R2 U2' R2'",
        "R2 U R2' U' R2 U2' R2' U R2 U' R2' U R2 U R2' U R2 U2' R2'",
        "R2 U R2' U' R2 U2' R2' U2 R2 U' R2' U' R2 U R2' U2 R2 U2' R2'",
        "R2 U R' U R U' R2' U2 R U2' R U R' U' R' U R2 U2' R2'",
        "R2 U2' R2' U2' R U R2 U R2' U2 R2 U2 R2 U2' R U R U' R2'",
        "R2' U R U2' R2 U2 R' U' R U2 R' U' R' U' R2 U' R2 U2' R2",
        "R2' U R2 U R2' U' R2 U R2' U R2 U2' R2' U2 R2 U' R2' U2' R2",
        "R2' U R2 U R2' U' R2 U R2' U' R2 U2 R2' U2' R2 U R2' U2' R2",
        "R2' U R2 U2 R2' U2 R2 U2' R2' U R2 U' R2' U R2 U2 R2' U2' R2",
        "R2' U R2 U2 R2' U' R2 U' R2' U R2 U' R2' U2 R2 U' R2' U2' R2",
      ],
      [
        "R2' U2 R2 U2 R2 U' R2 U' R2' U2 R U R U2' R",
        "R U2' R' U2 R' U2 R U2 R' U R U' R U2' R'",
        "R U2' R' U R' U' R2 U2' R' U2 R' U R U2 R U' R'",
        "R' U R U2' R2 U' R U R U2 R' U2 R U2 R2' U R2'",
        "R U' R' U R' U2 R U2 R' U R U' R U R' U R U R'",
        "R2 U2 R2 U' R2' U R2' U' R2' U R' U' R U R2' U2' R' U2 R'",
        "R2 U2' R2' U' R2 U' R2' U' R2 U' R2' U2 R2 U R2' U2' R2 U' R2'",
        "R2 U' R2' U2' R' U2' R2' U R U' R2' U' R2 U R2 U R",
        "R2' U R2 U' R' U2 R' U R U' R U R' U2 R U2' R2' U' R2",
        "R2' U2' R2 U' R2' U' R2 U' R2' U' R2 U2 R2' U R2 U2' R2' U' R2",
        "R' U R U R' U R U R' U2' R U' R' U2' R U2 R' U' R",
        "R' U R U R' U R U2 R' U2 R U R' U2 R U2' R' U' R",
        "R' U R U' R U2' R2 U2 R' U2 R U2' R U2' R2 U2 R U2 R'",
        "R' U R' U2' R U' R U R2' U2 R2 U' R' U' R U2 R' U2' R",
        "R' U2' R2' U' R' U R2' U R2' U' R2 U2 R2' U2' R' U' R U R2'",
        "R' U' R' U2' R2' U2 R2 U' R2' U R2' U R' U' R2' U2' R2 U R2",
        "R U2' R' U R' U2' R2' U R2 U R U' R2 U' R2' U2 R U R'",
        "R2 U R' U2 R' U R' U' R2 U2' R' U2 R' U R U2 R2 U' R2'",
        "R2 U2 R2' U2' R2 U R2' U2 R2 U2' R2' U R2 U2' R2' U' R2 U2' R2'",
        "R2 U2 R2' U2' R2 U R2' U2 R2 U2' R2' U R2' U2' R2 U' R2' U2' R2",
      ],
      [
        "R2' U R U R' U' R2 U2 R U2' R U' R' U R' U2 R'",
        "R2' U2' R U R U' R2' U' R2 U R2' U2 R2 U2' R' U' R",
        "R2' U2 R2 U' R U2' R2' U2 R' U R U2 R2 U2' R2 U2' R2",
        "R2 U R U' R2 U' R2 U2 R2' U' R2 U' R U R' U' R2'",
        "R' U R' U' R2 U' R U R U' R' U R U R2' U' R'",
        "R U R2' U2 R2 U2 R2' U R U2 R U2' R' U2' R U' R'",
        "R U2 R2' U R2 U2' R U2 R2 U' R2 U R U2' R' U' R'",
        "R U2 R2' U2 R2 U2 R U2' R2 U2' R2 U R U2' R' U' R'",
        "R U2' R' U2 R U' R U2' R' U' R' U' R U R U2' R2'",
        "R2' U2 R2' U R' U' R2' U2 R2 U R U' R' U' R2' U R2",
        "R2' U2' R2' U R2' U' R2 U2 R2 U2' R U R2 U' R2 U R2",
        "R' U2' R2 U R' U' R' U2 R' U2 R2 U R U' R2 U2' R2",
        "R' U' R' U' R U' R2 U R2 U R U R U2' R U' R'",
        "R2 U R2' U2 R2 U2 R2' U R2 U2 R2' U' R2 U R2' U R2 U2 R2'",
        "R2 U R2' U2 R2 U2 R2' U R2 U2' R2' U' R2 U' R2' U R2 U2' R2'",
        "R2 U R2' U2 R2' U2 R2 U R2' U2 R2 U' R2 U R2' U R2 U2 R2'",
        "R2 U R' U2' R' U2' R2' U2 R U2 R2 U R2 U' R2 U' R2 U' R",
        "R2 U2 R2' U' R2 U R2 U2' R2' U' R2 U2' R2' U2' R2' U2 R2 U2 R2'",
        "R2 U2 R2' U' R2 U R2' U2' R2 U' R2' U R2 U2 R2' U2' R2 U' R2'",
        "R2 U2 R2' U' R2 U R2' U2' R2 U' R2' U2' R2 U2' R2' U2 R2 U2 R2'",
      ],
      [
        "R U2 R2' U' R U R U2' R U2' R2' U' R' U R2' U2 R2'",
        "R' U2 R U2' R' U R' U2 R U R U R' U' R' U2 R2",
        "R U' R U R2' U R' U' R' U R U' R' U' R2 U R",
        "R2' U' R' U R2' U R2' U2' R2 U R2' U R' U' R U R2",
        "R2 U2' R2' U R' U2 R2 U2' R U' R' U2' R2' U2 R2' U2 R2'",
        "R U R U R' U R2' U' R2' U' R' U' R' U2 R' U R",
        "R2 U2 R2 U' R2 U R2' U2' R2' U2 R' U' R2' U R2' U' R2'",
        "R2 U2 R' U' R' U R2 U R2' U' R2 U2' R2' U2 R U R'",
        "R2 U2' R2 U' R U R2 U2' R2' U' R' U R U R2 U' R2'",
        "R2 U' R' U' R U R2' U2' R' U2 R' U R U' R U2' R",
        "R' U2' R2 U2' R2' U2' R' U2 R2' U2 R2' U' R' U2 R U R",
        "R' U2' R2 U' R2' U2 R' U2' R2' U R2' U' R' U2 R U R",
        "R' U' R2 U2' R2' U2' R2 U' R' U2' R' U2 R U2 R' U R",
        "R2 U R2' U R2 U' R2' U2 R2 U2 R2' U R2 U2' R2' U2' R2 U' R2'",
        "R2 U R2' U' R' U' R U R2 U' R' U2 R' U' R' U R2 U2' R'",
        "R2 U R2' U' R' U' R U2' R U2 R2 U2' R2 U2 R U R2' U' R2'",
        "R2 U2 R2' U R2 U2 R2 U2' R2 U R' U' R' U2 R U R U' R'",
        "R2 U2 R2' U2' R2 U2' R2' U R2 U R2' U2' R2 U2 R2' U R2 U' R2'",
        "R2 U2 R2' U2' R2 U2' R2' U R2 U' R2' U2 R2 U2' R2' U2' R2 U' R2'",
        "R2 U' R U R2 U2 R2' U' R' U R2' U2' R2' U R2 U' R2' U' R2",
      ],
      [
        "R U R' U2 R' U' R' U' R2' U' R2' U R' U R",
        "R U R U2 R' U' R2' U R2' U2' R' U2 R2' U' R2 U2' R'",
        "R U R U2 R' U' R2' U2 R2' U2 R' U2' R2' U2' R2 U2' R'",
        "R U R2 U' R' U' R U R' U' R' U R2' U R U' R",
        "R2' U' R2 U R U R' U' R2' U2' R2 U R U' R2 U2' R2",
        "R2' U' R2' U R2' U' R' U2 R2' U2' R2' U R2 U' R2 U2 R2",
        "R2 U2 R' U' R' U R U R U2 R' U R' U2' R U2 R'",
        "R2' U2 R2' U R' U' R2' U2' R U2' R U R U' R2' U2 R",
        "R U2' R U' R U R' U2 R' U2' R2' U R U' R' U' R2",
        "R' U R U2 R2' U2' R2 U' R2' U R2 U R' U' R' U2 R2",
        "R U R' U2 R U2 R' U2' R' U' R2 U2' R2' U2' R2 U' R'",
        "R2 U R U' R' U R2' U R2 U2' R2' U R2' U R' U' R2'",
        "R2' U2 R2' U2 R2' U2' R' U' R U2' R2 U2 R' U R2' U2' R2",
        "R2 U2 R2' U R2 U' R2' U R2 U' R2 U2' R2' U' R2 U2' R2' U2 R2'",
        "R2 U2 R2' U R2 U' R2' U R2 U' R2' U2' R2 U' R2' U2' R2 U2 R2'",
        "R2 U2' R U2' R U R U' R U R2' U R' U2 R2' U2 R U' R'",
        "R2' U2 R2 U R2' U' R2 U R2' U' R2 U2' R2' U' R2 U2' R2' U2 R2",
        "R2' U2 R2 U R2' U' R2 U R2' U' R2' U2' R2 U' R2' U2' R2 U2 R2",
        "R' U R U' R2' U2 R2 U2 R' U2' R2 U R2 U2 R2 U2' R U' R'",
        "R' U' R U2' R U2' R' U2 R' U R U2 R' U' R2 U' R2'",
      ],
      [
        "R2 U2' R2 U' R U R2 U2 R' U2 R' U' R' U R2 U2' R'",
        "R2' U2' R U R U' R' U' R' U2' R U' R U2 R' U2' R",
        "R2 U R2 U' R2 U R U2' R2 U2 R2 U' R2' U R2' U2' R2'",
        "R2 U R2' U' R' U' R U R2 U2 R2' U' R' U R2' U2 R2'",
        "R' U' R' U2' R U R2 U2' R2 U2' R U2 R2 U2 R2' U2 R",
        "R' U' R' U2' R U R2 U' R2 U2 R U2' R2 U R2' U2 R",
        "R' U' R U2' R' U2' R U2 R U R2' U2 R2 U2 R2'",
        "R U' R' U2' R2 U2 R2' U R2 U' R2' U' R U R U2' R2'",
        "R' U2 R' U R' U' R U2' R U2 R2 U' R' U R U R2'",
        "R' U' R2' U R U R' U' R U R U' R2 U' R' U R'",
        "R2 U2' R2 U2' R2 U2 R U R' U2 R2' U2' R U' R2 U2 R2'",
        "R2' U' R' U R U' R2 U' R2' U2 R2 U' R2 U' R U R2",
        "R' U' R U2' R U R U R2 U R2 U' R U' R' U' R'",
        "R U2 R' U R2 U2' R' U' R U R' U2 R' U2 R U R U' R2'",
        "R2' U2 R U2' R2' U2 R2 U2' R U R' U' R2' U R U R U2' R",
        "R2' U2 R' U2' R2 U2 R2' U2' R2' U R' U' R2' U R U R U2' R",
        "R2' U2' R U2 R' U R U2 R U R2' U2 R' U' R2' U' R2 U2 R2'",
        "R2' U2' R2' U R2' U R2 U' R' U2 R' U2' R' U2 R2' U2 R2' U2' R",
        "R' U R U2 R2' U2' R' U R' U' R U R U2' R' U2' R2' U2 R'",
        "R' U R' U' R2 U R U R U' R' U R U2' R2' U2 R2 U2' R2",
      ],
      [
        "R U R' U2 R2 U2 R2' U' R U2 R U2 R' U2' R'",
        "R2 U2 R2' U2' R2 U' R2' U2 R2 U R2' U' R2 U2' R2'",
        "R2' U2 R2 U2' R2' U' R2 U2 R2' U R2 U' R2' U2' R2",
        "R2 U2' R2' U2 R2 U2 R2' U2 R2 U R2' U' R2 U2' R2'",
        "R2' U2' R2 U2 R2' U2 R2 U2 R2' U R2 U' R2' U2' R2",
        "R U2 R U2' R' U2' R' U R2 U2' R2' U2' R U' R'",
        "R2 U2 R2' U R2 U' R2' U2' R2 U R2' U2 R2 U2' R2'",
        "R2 U2 R2' U R2 U' R2' U2' R2 U2' R2' U2' R2 U2 R2'",
        "R2' U2 R2 U R2' U' R2 U2' R2' U R2 U2 R2' U2' R2",
        "R2' U2 R2 U R2' U' R2 U2' R2' U2' R2 U2' R2' U2 R2",
        "R2 U2 R2' U2' R2 U2' R2' U2' R2 U' R2' U R2 U2 R2'",
        "R2' U2 R2 U2' R2' U2' R2 U2' R2' U' R2 U R2' U2 R2",
        "R2 U2' R2' U' R2 U R2' U2 R2 U2 R2' U2 R2 U2' R2'",
        "R2 U2' R2' U' R2 U R2' U2 R2 U' R2' U2' R2 U2 R2'",
        "R2' U2' R2 U' R2' U R2 U2 R2' U2 R2 U2 R2' U2' R2",
        "R2' U2' R2 U' R2' U R2 U2 R2' U' R2 U2' R2' U2 R2",
        "R' U2' R' U2 R U2 R U' R2' U2 R2 U2 R' U R",
        "R2 U2' R2' U2 R2 U R2' U2' R2 U' R2' U R2 U2 R2'",
        "R2' U2' R2 U2 R2' U R2 U2' R2' U' R2 U R2' U2 R2",
        "R' U' R U2' R2' U2' R2 U R' U2' R' U2' R U2 R",
      ],
      [
        "R U2 R2' U2' R' U' R U2' R2 U2 R2 U' R2 U R2' U R2",
        "R2 U2' R2' U' R2 U R2 U' R U R2 U2 R2' U' R' U R",
        "R2 U2 R U R' U2 R2' U' R2 U' R U' R2 U R2 U R2'",
        "R U R' U' R2' U2 R2 U R U' R2 U R2 U' R2' U2' R2",
        "R2 U R2' U R2 U' R2 U2 R2 U2' R U' R' U2' R2' U2 R",
        "R2 U R2' U2 R2 U' R' U R U2 R' U2' R' U2 R U2 R'",
        "R2 U R2' U2 R2 U' R' U2' R' U2' R U2 R U2' R' U' R'",
        "R2' U R2 U R2 U' R U' R2 U' R2' U2 R' U R U2 R2",
        "R2' U R2 U R2' U2' R' U2' R2 U2 R U R' U2 R2' U2' R2'",
        "R' U2 R U2 R' U2' R' U2 R U R' U' R2 U2 R2' U R2",
        "R' U' R' U2' R U2 R U2' R' U2' R' U' R2 U2 R2' U R2",
        "R2' U2' R2' U2 R' U R U2 R2 U2' R' U2' R2' U R2 U R2'",
        "R U R2 U R' U R2 U2 R2 U2' R U2 R2 U2 R U' R2' U' R'",
        "R U R2 U R' U R2 U2' R2 U2 R U2' R2 U R U' R2' U' R'",
        "R U2' R' U' R2 U2 R' U' R2' U2 R2' U2 R2' U' R' U2 R2 U2' R'",
        "R2 U R2 U2' R2' U' R2 U2' R2' U R2' U' R2 U2 R2' U R2 U R2'",
        "R2 U R2' U2' R2 U' R2' U2' R2 U R2' U' R2 U2 R2' U R2 U R2'",
        "R2' U R2 U2' R2' U' R2 U2' R2' U R2 U' R2' U2 R2 U R2' U R2",
        "R2' U R2' U2' R2 U' R2' U2' R2 U R2 U' R2' U2 R2 U R2' U R2",
        "R2 U' R' U R U' R U2' R2' U2' R U R' U' R U2 R U2 R2",
      ],
      [
        "R2' U2 R2 U R2' U' R2' U R' U' R2' U2' R2 U R U' R'",
        "R' U2' R2 U2 R U R' U2 R2' U2' R2' U R2' U' R2 U' R2'",
        "R2 U2 R2 U2' R U' R' U2' R2' U2 R U2 R2 U' R2' U' R2",
        "R U R U2 R' U2' R' U2 R U2 R U R2' U2' R2 U' R2'",
        "R U2' R' U2' R U2 R U2' R' U' R U R2' U2' R2 U' R2'",
        "R2 U' R2' U' R2 U2 R U2 R2' U2' R' U' R U2' R2 U2 R2",
        "R2 U' R2' U' R2' U R' U R2' U R2 U2' R U' R' U2' R2'",
        "R2' U' R2 U2' R2' U R U2 R U2 R' U2' R' U2 R U R",
        "R2' U' R2 U2' R2' U R U' R' U2' R U2 R U2' R' U2' R",
        "R2' U' R2 U' R2' U R2' U2' R2' U2 R' U R U2 R2 U2' R'",
        "R' U' R U R2 U2' R2' U' R' U R2' U' R2' U R2 U2 R2'",
        "R2' U2' R' U' R U2' R2 U R2' U R' U R2' U' R2' U' R2",
        "R2 U' R2 U2 R2' U R2 U2 R2' U' R2' U R2 U2' R2' U' R2 U' R2'",
        "R2 U' R2' U2 R2 U R2' U2 R2 U' R2' U R2 U2' R2' U' R2 U' R2'",
        "R2' U' R2 U2 R2' U R2 U2 R2' U' R2 U R2' U2' R2 U' R2' U' R2",
        "R2' U' R2' U2 R2 U R2' U2 R2 U' R2 U R2' U2' R2 U' R2' U' R2",
        "R' U2 R U R2' U2' R U R2 U2' R2 U2' R2 U R U2' R2' U2 R",
        "R' U' R2' U' R U' R2' U2 R2' U2' R' U2 R2' U' R' U R2",
        "R' U' R2' U' R U' R2' U2' R2' U2 R' U2' R2' U2' R' U R2",
        "R2' U R2 U2 R U' R2 U' R2 U R2' U R2 U2' R2' U' R2' U R'",
      ],
      [
        "R2 U2' R2' U2 R2 U2 R2' U2 R2 U2' R2'",
        "R2' U2' R2 U2 R2' U2 R2 U2 R2' U2' R2",
        "R2 U2 R2' U2' R2 U' R2' U2 R2 U2' R2'",
        "R2' U2 R2 U2' R2' U' R2 U2 R2' U2' R2",
        "R2 U2' R2' U2 R2 U' R2' U2' R2 U2 R2'",
        "R2' U2' R2 U2 R2' U' R2 U2' R2' U2 R2",
        "R2 U2 R2' U2' R2 U R2' U2' R2 U2 R2'",
        "R2' U2 R2 U2' R2' U R2 U2' R2' U2 R2",
        "R U2' R2' U2 R2 U2 R2' U R U R U2' R'",
        "R' U2' R U R U R2' U2 R2 U2 R2' U2' R",
        "R U2 R' U' R' U' R2 U' R2' U2 R2 U2' R'",
        "R2 U2 R2 U2' R2' U' R2 U2' R U' R2 U2' R2'",
        "R2' U2 R2' U2' R2 U' R2' U2' R' U' R2' U2' R2",
        "R2 U2' R2' U' R' U2' R2' U' R2 U2' R2' U2 R2'",
        "R2' U2' R2 U' R U2' R2 U' R2' U2' R2 U2 R2",
        "R' U2' R2 U2 R2' U' R2 U' R' U' R' U2 R",
        "R2 U2' R2' U' R2 U2' R2' U2 R2 U2' R2' U' R2 U2' R2'",
        "R2 U2' R2' U' R2 U2' R2' U2 R2' U2' R2 U' R2' U2' R2",
        "R2' U2' R2 U' R2' U2' R2 U2 R2 U2' R2' U' R2 U2' R2'",
        "R2' U2' R2 U' R2' U2' R2 U2 R2' U2' R2 U' R2' U2' R2",
      ],
      [
        "R2 U2 R2' U2' R2 U R2' U2 R2 U2' R2'",
        "R2' U2 R2 U2' R2' U R2 U2 R2' U2' R2",
        "R2 U2' R2' U2 R2 U' R2' U2 R2 U2' R2'",
        "R2' U2' R2 U2 R2' U' R2 U2 R2' U2' R2",
        "R2 U2 R2' U2' R2 U2' R2' U2' R2 U2 R2'",
        "R2' U2 R2 U2' R2' U2' R2 U2' R2' U2 R2",
        "R2 U2' R2' U2 R2 U R2' U2' R2 U2 R2'",
        "R2' U2' R2 U2 R2' U R2 U2' R2' U2 R2",
        "R U2 R2' U2' R2 U R2' U R U R U2' R'",
        "R2 U2 R2' U R' U2 R2' U R2 U2 R2' U2' R2'",
        "R2' U2 R2 U R U2 R2 U R2' U2 R2 U2' R2",
        "R U2 R' U' R' U' R2 U2' R2' U2' R2 U2 R'",
        "R' U2 R2 U2' R2' U2' R2 U' R' U' R' U2 R",
        "R2 U2' R2 U2 R2' U R2 U2 R U R2 U2 R2'",
        "R2' U2' R2' U2 R2 U R2' U2 R' U R2' U2 R2",
        "R' U2' R U R U R2' U R2 U2' R2' U2 R",
        "R2 U2 R2' U R' U2 R2' U2' R2 U2' R2' U2 R2 U2' R",
        "R2' U2 R2 U R U2 R2 U2' R2' U2' R2 U2 R2' U2' R'",
        "R' U2 R2 U2' R2' U2 R2 U' R2' U R U R U2' R'",
        "R2 U2' R2' U' R' U2' R2' U' R2 U2' R U' R2 U2' R2'",
      ],
      [
        "R2 U R2' U R2 U2' R2' U2 R2 U R2' U R2 U2' R2'",
        "R2 U R2' U' R2 U2 R2' U2' R2 U2' R2' U R2 U2' R2'",
        "R2 U2 R2' U' R2 U2 R2' U2 R2 U2' R2' U R2 U' R2'",
        "R2 U2 R2' U' R2 U' R2' U2' R2 U2 R2' U' R2 U' R2'",
        "R2' U R2 U R2' U2' R2 U2 R2' U R2 U R2' U2' R2",
        "R2' U R2 U' R2' U2 R2 U2' R2' U2' R2 U R2' U2' R2",
        "R2' U2 R2 U' R2' U2 R2 U2 R2' U2' R2 U R2' U' R2",
        "R2' U2 R2 U' R2' U' R2 U2' R2' U2 R2 U' R2' U' R2",
        "R U2' R U2 R' U' R' U2 R2 U2 R2' U' R U' R'",
        "R U R' U R2 U2' R2' U2' R U R U2' R' U2 R'",
        "R U R U R2' U' R2 U2 R2' U2 R2 U2' R2' U R U' R'",
        "R U R U R2' U' R2 U' R2' U2' R2 U2 R2' U' R U' R'",
        "R U R' U R2 U2' R2' U2 R2 U R2' U R2 U' R' U' R'",
        "R U R' U' R2 U2 R2' U2' R2 U2' R2' U R2 U' R' U' R'",
        "R2 U R2' U R2 U2' R2 U2 R2' U R2 U2 R U' R2 U2' R2'",
        "R2 U2 R2' U R' U2' R2' U' R2 U2' R2' U2 R2' U' R2 U' R2'",
        "R2' U R2 U R2' U2' R2' U2 R2 U R2' U2 R' U' R2' U2' R2",
        "R2' U2 R2 U R U2' R2 U' R2' U2' R2 U2 R2 U' R2' U' R2",
        "R2' U2' R2' U2 R2 U R2' U2' R' U' R2' U2' R2 U R U' R'",
        "R U2' R' U2' R' U R U' R U' R2' U R U R' U' R",
      ],
      [
        "R2 U2' R2' U R2 U R2' U2 R2 U2' R2' U R2 U R2'",
        "R2 U2' R2' U R2 U2' R2' U2' R2 U2 R2' U' R2 U R2'",
        "R2 U' R2' U R2 U2' R2' U2 R2 U2 R2' U' R2 U2 R2'",
        "R2 U' R2' U' R2 U2 R2' U2' R2 U' R2' U' R2 U2 R2'",
        "R2' U2' R2 U R2' U R2 U2 R2' U2' R2 U R2' U R2",
        "R2' U2' R2 U R2' U2' R2 U2' R2' U2 R2 U' R2' U R2",
        "R2' U' R2 U R2' U2' R2 U2 R2' U2 R2 U' R2' U2 R2",
        "R2' U' R2 U' R2' U2 R2 U2' R2' U' R2 U' R2' U2 R2",
        "R' U2 R' U2' R U R U2' R2' U2' R2 U R'",
        "R' U' R U' R2' U2 R2 U2 R' U' R' U2 R U2' R",
        "R2 U2' R2' U' R' U2 R2' U R2 U2 R2' U2' R2' U R2 U R2'",
        "R2 U' R2' U' R2 U2 R2 U2' R2' U' R2 U2' R U R2 U2 R2'",
        "R2' U2' R2 U' R U2 R2 U R2' U2 R2 U2' R2 U R2' U R2",
        "R2' U' R2 U' R2' U2 R2' U2' R2 U' R2' U2' R' U R2' U2 R2",
        "R' U' R U R2' U2' R2 U2 R2' U2 R2 U' R2' U R",
        "R' U' R U' R2' U2 R2 U2' R2' U' R2 U' R2' U R",
        "R' U' R' U' R2 U R2' U R2 U2 R2' U2' R2 U R'",
        "R' U' R' U' R2 U R2' U2' R2 U2' R2' U2 R2 U' R'",
        "R' U' R2 U2' R2' U2' R2 U R' U R U2' R' U R U2' R'",
        "R' U2 R U2 R U' R' U R' U R2 U' R' U' R U R'",
      ],
      [
        "R' U2' R2 U R' U' R' U2 R U R U' R'",
        "R U R' U' R' U2' R U R U' R2' U2 R",
        "R U2' R U2 R' U' R' U R2 U2' R2' U2' R U' R'",
        "R2 U R2' U2 R2 U2 R2' U2' R2 U R2' U R2 U2' R2'",
        "R2 U R2' U' R2 U2' R2' U2 R2 U' R2' U R2 U2' R2'",
        "R2 U2 R2' U' R2 U R2' U2' R2 U2 R2' U R2 U' R2'",
        "R2 U2 R2' U' R2 U' R2' U2 R2 U2' R2' U2' R2 U' R2'",
        "R2' U R2 U2 R2' U2 R2 U2' R2' U R2 U R2' U2' R2",
        "R2' U R2 U' R2' U2' R2 U2 R2' U' R2 U R2' U2' R2",
        "R2' U2 R2 U' R2' U R2 U2' R2' U2 R2 U R2' U' R2",
        "R2' U2 R2 U' R2' U' R2 U2 R2' U2' R2 U2' R2' U' R2",
        "R U R' U2 R2 U2 R2' U' R U R U2' R' U2 R'",
        "R U R2 U2' R' U2' R2 U2 R2 U2' R U2 R2' U2 R2' U' R'",
        "R U2' R2 U2 R2' U' R' U' R2' U2 R2 U R U2 R2 U2 R2",
        "R U2 R2 U R2' U2 R2 U2 R2 U2' R2' U R2 U R2' U2' R2",
        "R U2 R2 U2' R' U2' R' U2 R2 U2 R2' U' R U R' U2' R'",
        "R2 U2 R U R' U' R2' U2' R2 U R U' R2 U2 R2 U2' R2'",
        "R' U2 R U2' R' U R U2' R U2 R' U R U2 R2' U2' R",
        "R' U2 R2' U R2 U2 R2' U2 R2' U2' R2 U R2' U R2 U2' R2'",
        "R U R U R2' U' R2 U R2' U2' R2 U2 R2' U R U' R'",
      ],
      [
        "R U2 R2' U' R U R U2' R' U' R'",
        "R' U' R U R U2 R' U' R' U R2 U2' R'",
        "R' U2 R' U2' R U R U' R2' U2 R2 U2 R'",
        "R2 U2' R2' U R2 U R2' U2' R2 U2 R2' U2 R2 U R2'",
        "R2 U2' R2' U R2 U' R2' U2 R2 U2' R2' U' R2 U R2'",
        "R2 U' R2' U R2 U2 R2' U2' R2 U R2' U' R2 U2 R2'",
        "R2 U' R2' U2' R2 U2' R2' U2 R2 U' R2' U' R2 U2 R2'",
        "R2' U2' R2 U R2' U R2 U2' R2' U2 R2 U2 R2' U R2",
        "R2' U2' R2 U R2' U' R2 U2 R2' U2' R2 U' R2' U R2",
        "R2' U' R2 U R2' U2 R2 U2' R2' U R2 U' R2' U2 R2",
        "R2' U' R2 U2' R2' U2' R2 U2 R2' U' R2 U' R2' U2 R2",
        "R' U' R U2' R2' U2' R2 U R' U' R' U2 R U2' R",
        "R' U2 R2' U2' R2 U R U R2 U2' R2' U' R' U2' R2' U2' R2'",
        "R' U' R2' U2 R U2 R2' U2' R2' U2 R' U2' R2 U2' R2",
        "R2 U2 R U2 R2 U R2' U2 R2 U2' R2 U R2' U' R2 U2 R2'",
        "R2 U2' R2' U R2 U' R2' U2 R2' U2' R2 U' R2' U2' R' U2' R2'",
        "R2' U2 R' U2 R2' U R2 U2 R2' U2' R2' U R2 U' R2' U2 R2",
        "R2' U2' R2 U R2' U' R2 U2 R2 U2' R2' U' R2 U2' R U2' R2",
        "R' U' R U R2' U2 R2 U2' R2' U R2 U' R2' U R",
        "R' U' R U2' R2' U2' R2 U2 R2' U' R2 U' R2' U R",
      ],
      [
        "R U' R' U2 R2 U R2' U' R2 U2 R2' U R U R U2' R2'",
        "R U' R' U2' R2 U R' U R U' R' U2 R' U2' R2 U' R2'",
        "R2' U' R2' U2' R2' U2 R' U R2' U2' R2' U R2 U' R2' U' R",
        "R2 U R2' U2 R U2' R U R' U' R U' R2' U2 R U R'",
        "R2 U2 R' U' R' U' R2 U2' R2' U R2 U' R2' U2' R U R'",
        "R' U R2 U R2' U' R2 U2 R2 U' R U2' R2 U2 R2 U R2",
        "R U' R2' U2 R2' U R2 U2 R U2 R2 U2 R2' U R U R U2' R2'",
        "R2' U2 R U2 R U' R U2 R2 U' R2 U' R2 U' R2' U R' U' R'",
        "R2' U' R2' U R2' U R' U R2' U2' R2' U R2 U2' R2 U2' R U' R",
        "R2' U' R2' U2' R2' U2 R' U R2' U2 R2' U R2 U R2' U' R2 U' R'",
        "R2' U' R' U2 R2 U R2 U2 R U' R2 U2' R' U' R2' U2 R U2' R2'",
        "R' U R U R' U R2' U2 R2 U2 R U' R2 U R2 U' R2' U2 R2'",
        "R2 U' R2' U' R2' U2' R U2' R2 U2 R2 U2' R U2 R U2 R' U2 R2'",
        "R U R2 U R' U R2' U2' R2 U' R2' U R2 U R' U' R2 U' R2",
        "R2 U2 R U2 R2' U2' R' U' R U2' R2 U2 R' U R2' U R2 U2 R2'",
        "R2 U2' R2' U' R2 U2' R' U R' U' R2' U R2 U R U' R2 U' R2",
        "R2 U2' R2' U' R2 U' R U2' R2' U2 R' U R U2 R2 U2' R' U2' R2'",
        "R2' U R2' U R U' R2' U' R2 U R2' U2 R2 U' R U' R2' U' R'",
        "R2' U R2' U R' U' R2' U' R2 U R U' R U2 R2' U R2 U2 R2'",
        "R2' U R2' U R' U' R2' U' R2 U R U' R2 U2 R2 U R2' U2 R2",
      ],
      [
        "R2 U R2 U2 R2 U2' R U' R2 U2 R2 U' R2' U R2 U R'",
        "R' U R U2 R2' U' R U' R' U R U2' R U2 R2' U R2",
        "R' U R U2' R2' U' R2 U R2' U2' R2 U' R' U' R' U2 R2",
        "R U' R2' U' R2 U R2' U2' R2' U R' U2 R2' U2' R2' U' R2'",
        "R2' U2' R U R U R2' U2 R2 U' R2' U R2 U2 R' U' R",
        "R2' U' R2 U2' R' U2 R' U' R U R' U R2 U2' R' U' R",
        "R U' R' U' R U' R2 U2' R2' U2' R' U R2' U' R2' U R2 U2' R2",
        "R2 U R U2' R2' U' R2' U2' R' U R2' U2 R U R2 U2' R' U2 R2",
        "R2 U R2 U2 R2 U2' R U' R2 U2' R2 U' R2' U' R2 U R2'",
        "R2 U R2 U' R2 U' R U' R2 U2 R2 U' R2' U2 R2' U2 R' U R'",
        "R2 U2' R' U2' R' U R' U2' R2' U R2' U R2' U R2 U' R",
        "R' U R2 U2' R2 U' R2' U2' R' U2' R2' U2' R2 U' R' U' R' U2 R2",
        "R2 U' R2' U2 R2 U' R2' U2' R2 U R2 U2 R2' U R2 U2 R2' U' R2'",
        "R2 U' R2' U2 R2 U' R2' U2' R2 U R2' U2 R2 U R2' U2 R2 U' R2'",
        "R2' U' R2 U2 R2' U' R2 U2' R2' U R2 U2 R2' U R2 U2 R2' U' R2",
        "R2' U' R2 U2 R2' U' R2 U2' R2' U R2' U2 R2 U R2' U2 R2 U' R2",
        "R2 U2 R2' U R2 U2 R2 U' R U R2 U' R2' U' R' U R2' U R2'",
        "R2 U' R2 U' R U R2 U R2' U' R' U R2' U2' R2' U' R2 U2' R2'",
        "R2 U' R2 U' R U R2 U R2' U' R' U R' U2' R2 U' R2' U2' R2",
        "R2 U' R2 U' R' U R2 U R2' U' R2 U2' R2' U R' U R2",
      ],
      [
        "R' U2' R U' R' U2 R U2' R' U2' R2 U R' U2 R U2 R'",
        "R2 U2 R2 U R U' R2 U2' R2 U2 R U R' U2 R U' R' U2' R",
        "R2 U' R2' U2 R2 U R2' U2' R2 U2' R2' U R2 U2' R2' U2 R2 U' R2'",
        "R2 U' R2' U2 R2 U R2' U2' R2 U2' R2' U' R2 U2 R2' U2' R2 U R2'",
        "R2 U' R2' U2' R2 U' R2' U2 R2 U2 R2' U' R2 U' R2' U2 R2 U' R2'",
        "R2' U' R2 U2 R2' U R2 U2' R2' U2' R2 U R2' U2' R2 U2 R2' U' R2",
        "R2' U' R2 U2 R2' U R2 U2' R2' U2' R2 U' R2' U2 R2 U2' R2' U R2",
        "R2' U' R2 U2' R2' U' R2 U2 R2' U2 R2 U' R2' U' R2 U2 R2' U' R2",
        "R' U2' R' U2 R2 U R' U' R2 U2 R' U' R2' U2 R2' U2 R2'",
        "R U R' U2 R U2 R' U2 R' U2 R U2 R' U' R U R' U R",
        "R2 U R U2 R U' R2 U' R' U2' R' U R' U2 R2' U R' U' R2",
        "R2 U R2' U2 R2 U' R' U R U2 R2' U' R U' R' U R U2' R'",
        "R2 U2 R2' U R2 U2 R' U R' U2 R' U2' R2 U' R' U R' U2 R",
        "R2 U2' R' U' R U2' R2' U R U' R U2 R' U' R U' R' U2' R'",
        "R2' U2 R2 U R2' U2 R2' U R' U2 R' U2' R2 U' R' U R' U2 R",
        "R2' U2 R2' U R2 U R2' U2' R' U2' R U2' R' U' R2' U R2' U2 R'",
        "R U' R2' U2' R U R U2' R' U R' U2 R2' U2 R' U' R U' R2'",
        "R U' R' U2 R2 U R2' U' R2 U2 R2' U R U R' U R2 U2 R2'",
        "R2 U2' R U2' R' U2 R' U' R2' U2' R2' U2 R2 U R2 U2 R' U2 R2'",
        "R U2' R' U2 R2' U' R U2' R2' U R U' R2 U2 R' U R2' U2 R'",
      ],
      [
        "R U2 R' U R U2' R' U2 R U2 R2' U' R U2' R' U2' R",
        "R U2 R U2' R2' U' R U R2' U2' R U R2 U2' R2 U2' R2 U' R'",
        "R2 U R2' U2 R2 U R2' U2' R2 U2' R2' U R2 U R2' U2' R2 U R2'",
        "R2 U R2' U2' R2 U' R2' U2 R2 U2 R2' U R2 U2' R2' U2 R2 U' R2'",
        "R2 U R2' U2' R2 U' R2' U2 R2 U2 R2' U' R2 U2 R2' U2' R2 U R2'",
        "R2' U R2 U2 R2' U R2 U2' R2' U2' R2 U R2' U R2 U2' R2' U R2",
        "R2' U R2 U2' R2' U' R2 U2 R2' U2 R2 U R2' U2' R2 U2 R2' U' R2",
        "R2' U R2 U2' R2' U' R2 U2 R2' U2 R2 U' R2' U2 R2 U2' R2' U R2",
        "R2' U2' R2' U' R' U R2' U2 R2' U2' R' U' R U2' R' U R U2 R'",
        "R' U' R U2' R' U2' R U2' R U2' R' U2' R U R' U' R U' R'",
        "R' U' R U' R' U' R U2' R U2' R' U2' R U' R' U2 R' U R",
        "R' U R2 U2 R2 U' R2 U2 R2 U2' R2 U2 R U' R2' U2' R2' U' R",
        "R' U R2' U R U2 R2 U2' R U R U R U2' R U' R2 U' R",
        "R' U2 R U2' R2 U R' U2 R2 U' R' U R2' U2' R U' R2 U2' R",
        "R2' U2 R' U2 R U2' R U R2 U2 R2 U2' R2' U' R2' U2' R U2' R2",
        "R' U R U2' R2' U' R2 U R2' U2' R2 U' R' U' R U' R2' U2' R2",
        "R' U R2 U2 R' U' R' U2 R U' R U2' R2 U2' R U R' U R2",
        "R2 U2' R2 U' R2' U' R2 U2 R U2 R' U2 R U R2 U' R2 U2' R",
        "R2 U2' R2' U' R2 U2' R2 U' R U2' R U2 R2' U R U' R U2' R'",
        "R2' U2 R U R' U2 R2 U' R' U R' U2' R U R' U R U2 R",
      ],
      [
        "R U2' R' U2' R U' R2' U2 R U2 R' U2' R U R' U2 R",
        "R' U' R U' R' U R U2' R' U2' R U2' R U2' R' U2' R U' R'",
        "R2 U R2' U2' R2 U R2' U R2 U2' R2' U2' R2 U R2' U2 R2 U R2'",
        "R2 U R2' U2' R2 U2 R2' U' R2 U2 R2' U2 R2 U' R2' U2' R2 U R2'",
        "R2 U' R2' U2 R2 U2' R2' U R2 U2 R2' U2 R2 U' R2' U2' R2 U R2'",
        "R2' U R2 U2' R2' U R2 U R2' U2' R2 U2' R2' U R2 U2 R2' U R2",
        "R2' U R2 U2' R2' U2 R2 U' R2' U2 R2 U2 R2' U' R2 U2' R2' U R2",
        "R2' U' R2 U2 R2' U2' R2 U R2' U2 R2 U2 R2' U' R2 U2' R2' U R2",
        "R' U2 R U R' U2' R U' R' U2' R2' U2 R2' U R' U' R2' U2' R2'",
        "R' U' R2 U2' R2 U2' R2 U R U2' R2' U R U' R2' U2' R U2 R",
        "R U' R2 U' R U2' R U R U R U2' R2 U2 R U R2' U R'",
        "R U' R2' U2' R2' U' R U2 R2 U2' R2 U2 R2 U' R2 U2 R2 U R'",
        "R2 U2' R U2' R2' U' R2' U2' R2 U2 R2 U R U2' R U2 R' U2 R2'",
        "R2 U2' R2' U' R U' R' U' R2 U2' R2' U R2 U' R2' U2' R U R'",
        "R U R' U2 R' U' R U2' R' U2' R U2' R U' R' U' R U' R'",
        "R U2' R2 U' R U2' R2' U R' U' R2 U2 R' U R2 U2' R U2 R'",
        "R U2' R2 U' R2 U R U2 R' U2 R U2 R2 U' R2' U' R2 U2' R2",
        "R U2 R U R' U R U2' R' U R' U' R2 U2 R' U R U2 R2'",
        "R U2 R' U' R U R' U R2 U2' R' U' R U R2' U2' R2 U' R2'",
        "R2 U R' U R U2' R2 U2' R U' R U2 R' U' R' U2 R2 U R'",
      ],
      [
        "R' U2 R U2 R' U R2 U2' R' U2' R U2 R' U' R U2' R'",
        "R U R' U R U' R' U2 R U2 R' U2 R' U2 R U2 R'",
        "R U R2' U2 R2' U2 R2' U' R' U2 R2 U' R' U R2 U2 R' U2' R'",
        "R U2' R' U' R U2 R' U R U2 R2 U2' R2 U' R U R2 U2 R2",
        "R2 U R2' U2' R2 U2 R2' U' R2 U2' R2' U2' R2 U R2' U2 R2 U' R2'",
        "R2 U' R2' U2 R2 U2' R2' U R2 U2' R2' U2' R2 U R2' U2 R2 U' R2'",
        "R2 U' R2' U2 R2 U' R2' U' R2 U2 R2' U2 R2 U' R2' U2' R2 U' R2'",
        "R2' U R2 U2' R2' U2 R2 U' R2' U2' R2 U2' R2' U R2 U2 R2' U' R2",
        "R2' U' R2 U2 R2' U2' R2 U R2' U2' R2 U2' R2' U R2 U2 R2' U' R2",
        "R2' U' R2 U2 R2' U' R2 U' R2' U2 R2 U2 R2' U' R2 U2' R2' U' R2",
        "R U2 R' U R' U' R2 U2' R' U2 R' U R2' U2 R2' U R2 U2 R2'",
        "R U2 R' U R' U' R2 U2' R' U2 R' U R' U2 R2 U R2' U2 R2",
        "R2 U' R' U R2' U2 R' U R' U2' R' U' R2 U' R U2 R U R2",
        "R2' U' R U' R' U2 R2' U2 R' U R' U2' R U R U2' R2' U' R",
        "R' U2' R U R' U' R U' R2' U2 R U R' U' R2 U2 R2' U R2",
        "R' U2' R' U' R U' R' U2 R U' R U R2' U2' R U' R' U2' R2",
        "R' U2 R2' U R2' U' R' U2' R U2' R' U2' R2' U R2 U R2' U2 R2'",
        "R' U2 R2' U R' U2 R2 U' R U R2' U2' R U' R2' U2 R' U2' R",
        "R' U' R U2' R U R' U2 R U2 R' U2 R' U R U R' U R",
        "R2' U2 R2 U R' U R U R2' U2 R2 U' R2' U R2 U2 R' U' R",
      ],
      [
        "R2' U2' R2 U R2' U R U2' R U R U2 R2' U' R2 U' R'",
        "R U2' R' U2 R U R2' U' R2 U' R2' U2 R U2 R U2' R'",
        "R' U2' R' U' R2 U2' R2' U R U' R U2 R' U2' R' U2' R2",
        "R U2' R' U R U R' U' R U R U2' R' U2' R U' R' U' R'",
        "R2' U2' R2 U2 R2 U' R2 U' R2' U2 R U R U2' R U R2' U' R2",
        "R' U2' R U2 R U2' R' U2' R' U2 R U' R U R' U2' R U' R'",
        "R2 U2 R2' U2' R2 U R2' U R2 U2 R2' U2 R2 U2' R2' U R2 U' R2'",
        "R2 U2 R2' U2' R2 U R2' U R2 U' R2' U2' R2 U2 R2' U' R2 U' R2'",
        "R2 U2 R2' U' R U R' U2' R2 U R2' U2' R2 U2 R2' U' R U' R'",
        "R2 U2 R2' U' R U R' U2' R2 U' R2' U2 R2 U2' R2' U R U' R'",
        "R2 U2 R2' U' R2 U R2' U' R2 U' R2' U' R2 U2 R2' U' R2 U' R2'",
        "R2' U2 R2 U2' R2' U R2 U R2' U2 R2 U2 R2' U2' R2 U R2' U' R2",
        "R2' U2 R2 U2' R2' U R2 U R2' U' R2 U2' R2' U2 R2 U' R2' U' R2",
        "R2' U2 R2 U2' R2' U' R2 U2 R U R' U' R2' U2' R2 U R U' R'",
        "R2' U2 R2 U' R2' U R2 U' R2' U' R2 U' R2' U2 R2 U' R2' U' R2",
        "R U2 R' U2 R' U2' R U' R' U2' R U2' R U R' U2' R U' R'",
        "R U2 R' U2' R' U2 R U R' U2 R U' R U R' U2' R U' R'",
        "R U2' R U2' R' U' R' U R U2' R U2 R2' U' R2 U2' R' U2 R'",
        "R2 U R2' U R2 U' R2' U R2 U2' R2' U R2 U2 R2' U' R2 U' R2'",
        "R2 U2' R2' U2 R2 U' R2' U R2 U2 R2' U2 R2 U2' R2' U R2 U' R2'",
      ],
      [
        "R2 U2 R2' U' R2 U' R' U2 R' U' R' U2' R2 U R2'",
        "R' U2 R U2' R' U' R2 U R2' U R2 U2' R' U2' R' U2 R",
        "R U2 R U R2' U2 R2 U' R' U R' U2' R U2 R U2 R2'",
        "R U2 R' U2' R' U2 R U2 R U2' R' U R' U' R U2 R'",
        "R2 U2 R2' U2' R2' U R2' U R2 U2' R' U' R' U2 R' U' R2 U R2'",
        "R' U2 R U' R' U' R U R' U' R' U2 R U2 R' U R",
        "R2 U' R2' U R2 U R2' U2' R2 U2 R2' U' R2 U2' R2' U R2 U R2'",
        "R2 U' R2' U R2 U' R2' U2 R2 U2' R2' U R2 U2' R2' U R2 U R2'",
        "R2' U' R2 U R2' U R2 U2' R2' U2 R2 U' R2' U2' R2 U R2' U R2",
        "R2' U' R2 U R2' U' R2 U2 R2' U2' R2 U R2' U2' R2 U R2' U R2",
        "R' U2' R' U2' R2' U' R2' U R2 U R' U R2 U2' R2' U2 R U2' R2",
        "R U2 R2 U' R' U R2 U R2' U' R2' U' R' U' R' U2 R2' U R2",
        "R2 U2 R2' U2' R2 U R2' U' R2 U R2' U2 R2 U2' R2' U R2 U R2'",
        "R2 U2 R2' U2' R2 U R2' U' R2 U2' R2' U2' R2 U2 R2' U' R2 U R2'",
        "R2 U2 R2' U2' R2 U2' R2' U2' R' U' R U R2 U2 R2' U' R'",
        "R2 U' R2' U' R2 U R2' U' R2 U2 R2' U' R2 U2' R2' U R2 U R2'",
        "R2' U2 R2 U2' R2' U R2 U' R2' U R2 U2 R2' U2' R2 U R2' U R2",
        "R2' U2 R2 U2' R2' U R2 U' R2' U2' R2 U2' R2' U2 R2 U' R2' U R2",
        "R2' U' R2 U' R2' U R2 U' R2' U2 R2 U' R2' U2' R2 U R2' U R2",
        "R' U2 R' U2 R U R U' R' U2 R' U2' R2 U R2' U2 R U2' R",
      ],
      [
        "R U R2' U R2 U2' R' U' R' U2 R' U' R2 U' R2' U2 R2",
        "R U2 R' U2' R' U2' R2 U R2' U R2 U' R' U2' R U2 R'",
        "R2' U2 R U2 R U2' R' U R' U' R2 U2 R2' U R U2 R",
        "R U R U R' U2 R U2 R' U' R' U R U' R' U' R U2 R'",
        "R U R' U2 R U' R' U R' U2' R U2 R U2 R' U2' R' U2 R",
        "R2' U R2 U' R' U2 R' U' R' U2' R2 U R2' U R2' U2' R2' U2 R2",
        "R U2 R U2 R' U' R' U2 R2' U2 R2 U' R U R2 U2' R' U2 R2'",
        "R U2 R' U2' R2 U2' R2' U2' R2 U' R' U2' R2' U2 R U2 R'",
        "R U2 R' U2' R' U' R U R U2' R' U2 R' U2' R U' R U2 R'",
        "R U2 R' U2' R' U' R U' R' U2 R U2' R U2 R' U2 R U2 R'",
        "R U2 R' U2' R' U' R2 U R2' U' R2 U' R2' U R U2' R U2 R'",
        "R' U2' R2 U R' U' R' U2 R U2 R' U' R2 U' R' U R'",
        "R U R' U R2 U2' R2' U2 R2 U' R2' U2 R U' R' U R2 U2' R2'",
        "R U R' U2 R U' R' U R' U2' R U' R' U2' R U2 R U2' R'",
        "R U R' U2 R U' R' U2 R' U2 R U R' U2 R U2' R U2' R'",
        "R U R' U' R2 U2 R2' U2' R2 U R2' U2 R U' R' U R2 U2' R2'",
        "R U R' U' R2' U2 R2 U R U' R' U2' R2' U R2 U2 R2' U2' R2",
        "R U R' U' R2' U2 R2 U R U' R' U2' R2' U2' R2 U2' R2' U2 R2",
        "R U2' R U2 R2' U R2 U2' R' U2 R' U' R U R U2 R' U2 R'",
        "R2 U R2' U R2 U2' R2' U R2 U R2' U R2 U' R2' U R2 U2' R2'",
      ],
      [
        "R' U' R2 U' R2' U2 R U R U2' R U R2' U R2 U2' R2'",
        "R' U2' R U2 R U2 R2' U' R2 U' R2' U R U2 R' U2' R",
        "R2 U2' R' U2' R' U2 R U' R U R2' U2' R2 U' R' U2' R'",
        "R2 U' R2' U R U2' R U R U2 R2' U' R2 U' R2 U2 R2 U2' R2'",
        "R' U' R U2' R' U R U' R U2 R' U2' R' U2' R U2 R U2' R'",
        "R' U' R' U' R U2' R' U2' R U R U' R' U R U R' U2' R",
        "R U2 R2' U' R U R U2' R' U2' R U R2' U R U' R U' R'",
        "R' U2' R U2 R U R2' U' R2 U R2' U R2 U' R' U2 R' U2' R",
        "R' U2' R U2 R U R' U R U2' R' U2 R' U2' R U2' R' U2' R",
        "R' U2' R U2 R U R' U' R' U2 R U2' R U2 R' U R' U2' R",
        "R' U2' R U2 R2' U2 R2 U2 R2' U R U2 R2 U2' R' U2' R U' R'",
        "R' U2' R' U2' R U R U2' R2 U2' R2' U R' U' R2' U2 R U2' R2",
        "R2 U' R2' U R2 U2' R2' U2 R2 U2 R2' U R2 U R2' U2' R2 U2 R2'",
        "R2 U' R2' U R2 U2' R2' U2 R2 U2 R2' U R2 U' R2' U2 R2 U2' R2'",
        "R2 U' R2' U' R2 U2 R2' U R2 U2' R2' U R2 U' R2' U R2 U R2'",
        "R2 U' R2' U' R2 U2 R2' U R2 U2' R2' U2 R2 U' R2' U' R2 U R2'",
        "R2 U' R2' U' R2 U2 R2' U2' R2 U' R2' U R2 U R2' U2' R2 U2 R2'",
        "R2 U' R2' U' R2 U2 R2' U2' R2 U' R2' U R2 U' R2' U2 R2 U2' R2'",
        "R2 U' R2' U' R2 U2 R2' U' R2 U2 R2' U2' R2 U R2' U' R2 U R2'",
        "R2 U' R2' U' R2 U2 R2' U' R2 U' R2' U' R2 U R2' U' R2 U2 R2'",
      ],
      [
        "R2 U R2' U R2 U R2' U2 R2 U2 R2' U R2 U' R2'",
        "R2' U R2 U R2' U R2 U2 R2' U2 R2 U R2' U' R2",
        "R' U R' U2 R U R U' R2' U2' R2 U R' U2' R",
        "R U R' U' R2' U2 R2 U R U' R' U R2' U2 R2",
        "R2 U R2' U R2 U R2' U2 R2' U2 R2 U R2' U2 R' U2 R2'",
        "R2 U R2' U' R' U2 R2' U R2 U2 R2' U2 R2' U R2 U' R2'",
        "R2' U R2 U R2' U R2 U2 R2 U2 R2' U R2 U2 R U2 R2",
        "R2' U R2 U' R U2 R2 U R2' U2 R2 U2 R2 U R2' U' R2",
        "R U2 R U R2 U2 R2' U2 R2 U R2 U R' U R U2 R'",
        "R2' U2' R2 U' R U2' R2' U2 R' U R U2 R2 U2' R2 U2 R2",
        "R2 U R2' U R2 U R2' U' R2 U2' R2' U2 R2 U2' R2' U2' R2 U' R2'",
        "R2 U R2' U R2 U2' R2' U2' R2 U2 R2' U2' R2 U' R2' U R2 U' R2'",
        "R2 U R2' U' R' U2 R2' U R2 U2 R' U2 R2 U R2' U2 R' U2 R2'",
        "R2 U2 R2' U R2 U2' R2' U2 R2 U2 R2' U2' R2 U R2' U R2 U2' R2'",
        "R2 U2 R2' U R2 U2' R2' U' R2 U2' R2' U2 R2 U' R2' U R2 U2' R2'",
        "R2 U2 R2' U R2 U' R2' U' R2 U R2' U2' R2 U2 R2' U R2 U' R2'",
        "R2 U2 R2' U R2 U' R2' U' R2 U' R2' U2 R2 U2' R2' U2' R2 U' R2'",
        "R2 U2 R2' U R2' U2' R2 U' R2' U2' R2 U2 R2 U' R2' U R2 U2' R2'",
        "R2 U2 R2' U' R2 U2 R2 U2' R2' U' R2 U2' R2' U R2' U R2 U2' R2'",
        "R2 U2 R2' U' R2 U2 R2' U2' R2 U' R2' U2' R2 U R2' U R2 U2' R2'",
      ],
      [
        "R U' R U2' R' U' R' U R2 U2 R2' U' R U2 R'",
        "R2 U' R2' U' R2 U' R2' U2' R2 U2' R2' U' R2 U R2'",
        "R2' U' R2 U' R2' U' R2 U2' R2' U2' R2 U' R2' U R2",
        "R' U' R U R2 U2' R2' U' R' U R U' R2 U2' R2'",
        "R2 U' R2' U R' U2' R2' U' R2 U2' R2' U2' R2' U' R2 U R2'",
        "R2 U' R2' U' R2 U' R2' U2' R2' U2' R2 U' R2' U2' R' U2' R2'",
        "R2' U' R2 U R U2' R2 U' R2' U2' R2 U2' R2 U' R2' U R2",
        "R2' U' R2 U' R2' U' R2 U2' R2 U2' R2' U' R2 U2' R U2' R2",
        "R' U2' R' U' R2' U2' R2 U2' R2' U' R2' U' R U' R' U2' R",
        "R2 U2 R2' U R' U2 R2 U2' R U' R' U2' R2' U2 R2' U2' R2'",
        "R U' R U2' R' U' R U2' R U2 R2 U R2' U2 R2 U' R U2 R'",
        "R U' R U2' R' U' R' U2' R2 U2' R2' U2 R2 U2' R2' U R U2 R'",
        "R2 U R U2' R2 U' R2' U2' R' U R2' U2' R2 U2' R2' U' R2 U R2'",
        "R2 U2 R' U R U2 R' U R U2 R2' U R2 U2 R2' U' R U2 R'",
        "R2 U2 R' U R U2 R' U R2 U2 R2 U R2' U2 R2 U' R U2 R'",
        "R2 U2' R2' U R2 U2' R2 U2 R2' U R2 U2 R2' U' R2' U' R2 U2 R2'",
        "R2 U2' R2' U R2 U2' R2' U2 R2 U R2' U2 R2 U' R2' U' R2 U2 R2'",
        "R2 U2' R2' U2 R2' U2 R2 U2 R2' U R' U2 R U' R2 U' R2' U2 R2",
        "R2 U2' R2' U' R2 U R2' U R2 U R2' U2' R2 U2 R2' U2 R2 U R2'",
        "R2 U2' R2' U' R2 U R2' U R2 U' R2' U2 R2 U2' R2' U' R2 U R2'",
      ],
      [
        "R2 U R2' U' R2 U2' R2' U2' R2 U' R2' U' R2 U' R2'",
        "R2' U R2 U' R2' U2' R2 U2' R2' U' R2 U' R2' U' R2",
        "R' U2 R U' R2' U2 R2 U R' U' R' U2' R U' R",
        "R2' U2' R2 U' R U R' U' R2' U2' R2 U R U' R'",
        "R2 U R2' U' R2 U2' R2 U2' R2' U' R2 U2' R U R2 U' R2'",
        "R2 U2' R U2' R2 U' R2' U2' R2 U2' R2 U' R2' U' R2 U' R2'",
        "R2' U R2 U' R2' U2' R2' U2' R2 U' R2' U2' R' U R2' U' R2",
        "R2' U2' R' U2' R2' U' R2 U2' R2' U2' R2' U' R2 U' R2' U' R2",
        "R U2' R' U' R U' R2' U' R2' U2' R2 U2' R2' U' R' U2' R'",
        "R2' U2' R2' U2 R2' U2' R' U' R U2' R2 U2 R' U R2' U2 R2",
        "R2 U R2' U2 R2 U2 R2' U2' R2 U R2' U R2 U R2' U' R2 U2' R2'",
        "R2 U R2' U2 R2 U2 R2' U2' R2 U2 R2' U R2 U' R2' U' R2 U' R2'",
        "R2 U R2' U' R2 U R2' U2 R2 U2' R2' U2 R2 U2 R2' U' R2 U' R2'",
        "R2 U R2' U' R2 U2' R2' U2 R2 U' R2' U R2 U R2' U' R2 U2' R2'",
        "R2 U R2' U' R2 U2' R2' U2' R2 U R U2' R2 U' R2' U2' R' U R2'",
        "R2 U2 R2' U' R2 U R2' U2' R2 U2 R2' U R2 U2 R2' U' R2 U2' R2'",
        "R2 U2 R2' U' R2 U R2' U2' R2' U2 R2 U R2' U2 R2 U' R2 U2' R2'",
        "R2 U2 R2' U' R2 U' R U2 R' U R2' U2 R2 U2 R2' U2 R2' U2' R2",
        "R2 U2 R2' U' R2 U' R2 U2 R2' U R2 U2 R2' U2' R2' U R2 U2' R2'",
        "R2 U2 R2' U' R2 U' R2' U2 R2 U R2' U2 R2 U2' R2' U R2 U2' R2'",
      ],
      [
        "R U2' R' U R2 U2' R2' U' R U R U2 R' U R'",
        "R2 U' R2' U R2 U2 R2' U2 R2 U R2' U R2 U R2'",
        "R2' U' R2 U R2' U2 R2 U2 R2' U R2 U R2' U R2",
        "R2 U2 R2' U R' U' R U R2 U2 R2' U' R' U R",
        "R2 U2 R U2 R2 U R2' U2 R2 U2 R2 U R2' U R2 U R2'",
        "R2 U' R2' U R2 U2 R2 U2 R2' U R2 U2 R U' R2 U R2'",
        "R2' U2 R' U2 R2' U R2 U2 R2' U2 R2' U R2 U R2' U R2",
        "R2' U' R2 U R2' U2 R2' U2 R2 U R2' U2 R' U' R2' U R2",
        "R' U2 R U R' U R2 U R2 U2 R2' U2 R2 U R U2 R",
        "R2 U2 R2 U2' R2 U2 R U R' U2 R2' U2' R U' R2 U2' R2'",
        "R U2' R' U R2 U2' R2' U' R2 U2' R' U' R U2' R' U' R U2' R2'",
        "R U2' R' U R2' U2' R2 U' R2' U2' R2' U' R U2' R' U' R U2' R2'",
        "R U2' R' U R2' U2' R2 U' R2' U2' R' U2 R' U R U2 R' U R'",
        "R U2' R' U' R2 U2 R2' U2' R2 U2 R2' U2 R U R U2 R' U R'",
        "R2 U2 R U2 R2 U R2' U2 R U2 R2' U R2 U2 R U' R2 U R2'",
        "R2 U2' R2' U R2 U R2 U2' R2' U' R2 U2' R2' U2 R2' U' R2 U2 R2'",
        "R2 U2' R2' U R2 U R2' U2' R2 U2 R2' U2 R2 U2' R2' U R2 U2 R2'",
        "R2 U2' R2' U R2 U R2' U2' R2 U' R2' U2' R2 U2 R2' U' R2 U2 R2'",
        "R2 U2' R2' U R2 U' R2' U2 R2 U2' R2' U' R2 U2' R2' U R2 U2 R2'",
        "R2 U2' R2' U R2 U' R2' U2 R2' U2' R2 U' R2' U2' R2 U R2 U2 R2'",
      ],
      [
        "R2 U2 R2' U R2 U2 R2' U2 R2 U2' R2' U' R2 U2' R2'",
        "R2 U2 R2' U R2 U2 R2' U2 R2' U2' R2 U' R2' U2' R2",
        "R2 U2 R2' U R2 U' R2' U2' R2 U2 R2' U2 R2 U2' R2'",
        "R2' U2 R2 U R2' U2 R2 U2 R2 U2' R2' U' R2 U2' R2'",
        "R2' U2 R2 U R2' U2 R2 U2 R2' U2' R2 U' R2' U2' R2",
        "R2' U2 R2 U R2' U' R2 U2' R2' U2 R2 U2 R2' U2' R2",
        "R2 U2 R2' U R2 U' R2 U2' R2' U' R2 U2' R2' U2 R2'",
        "R2 U2 R2' U R2 U' R2' U2' R2 U' R2' U2' R2 U2 R2'",
        "R2' U2 R2 U R2' U' R2 U2' R2' U' R2 U2' R2' U2 R2",
        "R2' U2 R2 U R2' U' R2' U2' R2 U' R2' U2' R2 U2 R2",
        "R U R' U' R2' U2' R2 U R U' R2 U R2 U2' R2' U2' R2",
        "R2 U2 R2' U R2 U2 R U2 R2 U2' R2' U2 R2 U2 R2' U2' R2",
        "R2 U2 R2' U2' R' U2' R2' U' R2 U2' R2' U2 R2' U2 R2 U2' R2'",
        "R2 U2 R2' U' R' U2 R2' U2' R2' U R2 U2' R2' U' R' U2' R",
        "R2' U2 R2 U R2' U2 R' U2 R2' U2' R2 U2 R2' U2 R2 U2' R2'",
        "R2' U2 R2 U2' R U2' R2 U' R2' U2' R2 U2 R2 U2 R2' U2' R2",
        "R U R2' U' R' U2 R2' U2' R2' U R2 U' R' U2' R2' U2' R2",
        "R' U R2' U2 R2 U2 R U' R2 U R2 U2' R2' U2' R2 U' R",
        "R U2 R2' U R2' U2 R' U R U2 R2 U' R U R U2' R'",
        "R2 U2 R2' U R2 U2 R U2 R2 U2' R2' U' R2 U2' R2' U2 R2",
      ],
      [
        "R2 U2' R2' U' R2 U R2' U2 R2 U2' R2' U2' R2 U2 R2'",
        "R2 U2' R2' U' R2 U2' R2' U2' R2 U2 R2' U R2 U2 R2'",
        "R2 U2' R2' U' R2 U2' R2' U2' R2' U2 R2 U R2' U2 R2",
        "R2' U2' R2 U' R2' U R2 U2 R2' U2' R2 U2' R2' U2 R2",
        "R2' U2' R2 U' R2' U2' R2 U2' R2 U2 R2' U R2 U2 R2'",
        "R2' U2' R2 U' R2' U2' R2 U2' R2' U2 R2 U R2' U2 R2",
        "R2 U2' R2' U' R2 U R2 U2 R2' U R2 U2 R2' U2' R2'",
        "R2 U2' R2' U' R2 U R2' U2 R2 U R2' U2 R2 U2' R2'",
        "R2' U2' R2 U' R2' U R2 U2 R2' U R2 U2 R2' U2' R2",
        "R2' U2' R2 U' R2' U R2' U2 R2 U R2' U2 R2 U2' R2",
        "R' U' R U R2 U2 R2' U' R' U R2' U' R2' U2 R2 U2 R2'",
        "R' U' R2 U R U2' R2 U2 R2 U' R2' U R U2 R2 U2 R2'",
        "R2 U2' R2' U2 R' U2 R2' U R2 U2 R2' U2' R2' U2' R2 U2 R2'",
        "R2 U2' R2' U' R2 U2' R U2' R2 U2 R2' U2' R2 U2' R2' U2 R2",
        "R2' U2' R2 U R U2' R2 U2 R2 U' R2' U2 R2 U R U2 R'",
        "R2' U2' R2 U2 R U2 R2 U R2' U2 R2 U2' R2 U2' R2' U2 R2",
        "R2' U2' R2 U' R2' U2' R' U2' R2' U2 R2 U2' R2' U2' R2 U2 R2'",
        "R2 U2' R2' U2 R' U2 R2' U R2 U2 R2' U R2' U2 R2 U2' R2'",
        "R2 U2' R2' U' R2 U R2 U2 R2' U2' R2 U2' R2' U2 R2 U2' R",
        "R2 U2' R2' U' R2 U2' R U2' R2 U2 R2' U R2 U2 R2' U2' R2",
      ],
      [
        "R2 U2 R2' U R2 U2 R2' U2' R2 U2' R2' U' R2 U2' R2'",
        "R2 U2 R2' U R2 U2 R2' U2' R2' U2' R2 U' R2' U2' R2",
        "R2 U2 R2' U2' R2 U2' R2' U2 R2 U R2' U' R2 U2' R2'",
        "R2' U2 R2 U R2' U2 R2 U2' R2 U2' R2' U' R2 U2' R2'",
        "R2' U2 R2 U R2' U2 R2 U2' R2' U2' R2 U' R2' U2' R2",
        "R2' U2 R2 U2' R2' U2' R2 U2 R2' U R2 U' R2' U2' R2",
        "R2 U2' R2 U2 R2' U R2 U2 R2' U R2' U' R2 U2' R2'",
        "R2 U2' R2' U2 R2 U R2' U2 R2 U R2' U' R2 U2' R2'",
        "R2' U2' R2 U2 R2' U R2 U2 R2' U R2 U' R2' U2' R2",
        "R2' U2' R2' U2 R2 U R2' U2 R2 U R2 U' R2' U2' R2",
        "R2' U2 R2 U2 R2' U' R2' U R' U' R2' U2 R2 U R U' R'",
        "R2 U2 R2' U2' R2 U2' R2 U2 R2' U R2 U2 R U2 R2 U2' R2'",
        "R2 U2 R2' U2' R2 U2' R2' U2 R2 U2' R U2' R2 U' R2' U2' R2",
        "R2' U2 R2 U2 R U R2' U' R2 U2 R2 U2' R U R2 U' R'",
        "R2' U2 R2 U2' R2' U2' R2 U2 R2' U2' R' U2' R2' U' R2 U2' R2'",
        "R2' U2 R2 U2' R2' U2' R2' U2 R2 U R2' U2 R' U2 R2' U2' R2",
        "R' U2 R U R2 U2 R2' U' R2 U2 R2 U2' R U R2 U2' R2'",
        "R U2 R' U' R' U R2' U2' R' U' R U2' R2 U' R2 U2' R'",
        "R U2' R2 U2 R2' U R2 U2 R2' U2' R U2' R2' U' R2 U2' R2'",
        "R U2' R2 U2 R2' U R2 U2 R2' U2' R2 U2' R2 U' R2' U2' R2",
      ],
      [
        "R2 U2' R2' U2 R2 U2 R2' U2' R2 U' R2' U R2 U2 R2'",
        "R2 U2' R2' U' R2 U2' R2' U2 R2 U2 R2' U R2 U2 R2'",
        "R2 U2' R2' U' R2 U2' R2' U2 R2' U2 R2 U R2' U2 R2",
        "R2' U2' R2 U2 R2' U2 R2 U2' R2' U' R2 U R2' U2 R2",
        "R2' U2' R2 U' R2' U2' R2 U2 R2 U2 R2' U R2 U2 R2'",
        "R2' U2' R2 U' R2' U2' R2 U2 R2' U2 R2 U R2' U2 R2",
        "R2 U2 R2 U2' R2' U' R2 U2' R2' U' R2' U R2 U2 R2'",
        "R2 U2 R2' U2' R2 U' R2' U2' R2 U' R2' U R2 U2 R2'",
        "R2' U2 R2 U2' R2' U' R2 U2' R2' U' R2 U R2' U2 R2",
        "R2' U2 R2' U2' R2 U' R2' U2' R2 U' R2 U R2' U2 R2",
        "R2 U2' R2' U2' R2 U R2 U' R U R2 U2' R2' U' R'",
        "R U2' R' U' R2' U2' R2 U R2' U2' R2' U2 R' U' R2' U2 R2",
        "R2 U2' R2' U2 R2 U2 R2 U2' R2' U' R2 U2' R U2' R2 U2 R2'",
        "R2 U2' R2' U2 R2 U2 R2' U2' R2 U2 R U2 R2 U R2' U2 R2",
        "R2 U2' R2' U2' R' U' R2 U R2' U2' R2' U2 R' U' R2' U R",
        "R2' U2' R2 U2 R2' U2 R2 U2' R2' U2 R' U2 R2' U R2 U2 R2'",
        "R2' U2' R2 U2 R2' U2 R2' U2' R2 U' R2' U2' R' U2' R2' U2 R2",
        "R U2 R2 U2' R2' U2 R2 U2 R2' U2' R2 U' R2 U R2' U2 R2",
        "R U2 R2 U2' R2' U' R2 U2' R2' U2 R U2 R2' U R2 U2 R2'",
        "R U2 R2 U2' R2' U' R2 U2' R2' U2 R2 U2 R2 U R2' U2 R2",
      ],
    ];

    const drawMegaminxLL = (colorScheme, state, size) => {
      const color = getColor(colorScheme);
      const coloredState = map(color, state);

      return formatString(coloredState, size);
    };

    const getColor = ({ U, R: Right, F, L, Bl, Br }) =>
      cond([
        [equals(0), always(U)],
        [equals(1), always(F)],
        [equals(2), always(Right)],
        [equals(3), always(Br)],
        [equals(4), always(Bl)],
        [T, always(L)],
      ]);

    const formatString = (list, size) =>
      reduce(
        flip(replace('{}')),
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="${size}" height="${size}">
  <g stroke-linejoin="round">
    <polygon
      points="80.2229123600034,132.367048291092 68,94.7487921443737 100,71.4994312482022 132,94.7487921443737 119.777087639997,132.367048291092"
      stroke="#1E1E1E"
      stroke-width="4"
      fill="{}"
    />

    <polygon
      points="119.777087639997,132.367048291092 106.513112147391,173.19828709199 93.4868878526086,173.19828709199 80.2229123600034,132.367048291092"
      stroke="#1E1E1E"
      stroke-width="4"
      fill="{}"
    />
    <polygon
      points="119.777087639997,132.367048291092 162.708697210182,132.36980465773 149.442719099992,173.19828709199 106.513112147391,173.19828709199"
      stroke="#1E1E1E"
      stroke-width="4"
      fill="{}"
    />
    <polygon
      points="132,94.7487921443737 166.73402188981,119.981129159454 162.708697210182,132.36980465773 119.777087639997,132.367048291092"
      stroke="#1E1E1E"
      stroke-width="4"
      fill="{}"
    />
    <polygon
      points="132,94.7487921443737 145.26921841351,53.9192568717434 180,79.1526467251942 166.73402188981,119.981129159454"
      stroke="#1E1E1E"
      stroke-width="4"
      fill="{}"
    />
    <polygon
      points="100,71.4994312482022 134.73078158649,46.2626343382162 145.26921841351,53.9192568717434 132,94.7487921443737"
      stroke="#1E1E1E"
      stroke-width="4"
      fill="{}"
    />
    <polygon
      points="100,71.4994312482022 65.2692184135095,46.2626343382162 100,21.0292444847653 134.73078158649,46.2626343382162"
      stroke="#1E1E1E"
      stroke-width="4"
      fill="{}"
    />
    <polygon
      points="68,94.7487921443737 54.7307815864905,53.9192568717434 65.2692184135095,46.2626343382162 100,71.4994312482022"
      stroke="#1E1E1E"
      stroke-width="4"
      fill="{}"
    />
    <polygon
      points="68,94.7487921443737 33.2659781101904,119.981129159454 20,79.1526467251942 54.7307815864905,53.9192568717434"
      stroke="#1E1E1E"
      stroke-width="4"
      fill="{}"
    />
    <polygon
      points="80.2229123600034,132.367048291092 37.2913027898181,132.36980465773 33.2659781101904,119.981129159454 68,94.7487921443737"
      stroke="#1E1E1E"
      stroke-width="4"
      fill="{}"
    />
    <polygon
      points="80.2229123600034,132.367048291092 93.4868878526086,173.19828709199 50.5572809000084,173.19828709199 37.2913027898181,132.36980465773"
      stroke="#1E1E1E"
      stroke-width="4"
      fill="{}"
    />
    <polygon
      points="50.5572809000084,173.19828709199 38.1966011250105,190.211303259031 85.1671842700026,190.211303259031 93.4868878526086,173.19828709199"
      stroke="#1E1E1E"
      stroke-width="4"
      fill="{}"
    />

    <polygon
      points="106.513112147391,173.19828709199 93.4868878526086,173.19828709199 85.1671842700025,190.211303259031 114.832815729997,190.211303259031"
      stroke="#1E1E1E"
      stroke-width="4"
      fill="{}"
    />
    <polygon
      points="149.442719099992,173.19828709199 161.80339887499,190.211303259031 114.832815729997,190.211303259031 106.513112147391,173.19828709199"
      stroke="#1E1E1E"
      stroke-width="4"
      fill="{}"
    />
    <polygon
      points="149.442719099992,173.19828709199 161.80339887499,190.211303259031 176.318107302494,145.539624084803 162.708697210182,132.36980465773"
      stroke="#1E1E1E"
      stroke-width="4"
      fill="{}"
    />
    <polygon
      points="166.73402188981,119.981129159454 162.708697210182,132.36980465773 176.318107302494,145.539624084803 185.485291572496,117.325931974764"
      stroke="#1E1E1E"
      stroke-width="4"
      fill="{}"
    />
    <polygon
      points="180,79.1526467251942 200,72.6542528005361 185.485291572496,117.325931974764 166.73402188981,119.981129159454"
      stroke="#1E1E1E"
      stroke-width="4"
      fill="{}"
    />
    <polygon
      points="180,79.1526467251942 200,72.6542528005361 162,45.0456367363323 145.26921841351,53.9192568717434"
      stroke="#1E1E1E"
      stroke-width="4"
      fill="{}"
    />
    <polygon
      points="134.73078158649,46.2626343382162 145.26921841351,53.9192568717434 162,45.0456367363323 138,27.6086160642037"
      stroke="#1E1E1E"
      stroke-width="4"
      fill="{}"
    />
    <polygon
      points="100,21.0292444847653 100,0 138,27.6086160642037 134.73078158649,46.2626343382162"
      stroke="#1E1E1E"
      stroke-width="4"
      fill="{}"
    />
    <polygon
      points="100,21.0292444847653 100,0 62,27.6086160642037 65.2692184135095,46.2626343382162"
      stroke="#1E1E1E"
      stroke-width="4"
      fill="{}"
    />
    <polygon
      points="54.7307815864905,53.9192568717434 65.2692184135095,46.2626343382162 62,27.6086160642037 38,45.0456367363324"
      stroke="#1E1E1E"
      stroke-width="4"
      fill="{}"
    />
    <polygon
      points="20,79.1526467251942 0,72.6542528005361 38,45.0456367363324 54.7307815864905,53.9192568717434"
      stroke="#1E1E1E"
      stroke-width="4"
      fill="{}"
    />
    <polygon
      points="20,79.1526467251942 0,72.6542528005361 14.514708427504,117.325931974764 33.2659781101904,119.981129159454"
      stroke="#1E1E1E"
      stroke-width="4"
      fill="{}"
    />
    <polygon
      points="37.2913027898181,132.36980465773 33.2659781101904,119.981129159454 14.514708427504,117.325931974764 23.6818926975065,145.539624084803"
      stroke="#1E1E1E"
      stroke-width="4"
      fill="{}"
    />
    <polygon
      points="50.5572809000084,173.19828709199 38.1966011250105,190.211303259031 23.6818926975065,145.539624084803 37.2913027898181,132.36980465773"
      stroke="#1E1E1E"
      stroke-width="4"
      fill="{}"
    />
  </g>
</svg>`,
        list
      );

    /* src/Components/Train.svelte generated by Svelte v3.4.4 */

    const file$3 = "src/Components/Train.svelte";

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = Object.create(ctx);
    	child_ctx.time = list[i];
    	return child_ctx;
    }

    function get_each_context_1$1(ctx, list, i) {
    	const child_ctx = Object.create(ctx);
    	child_ctx.caseIndex = list[i];
    	return child_ctx;
    }

    // (112:2) {#each selectedCases as caseIndex}
    function create_each_block_1$1(ctx) {
    	var div, t_value = path([ctx.caseIndex, 'name'], algInfo), t;

    	return {
    		c: function create() {
    			div = element("div");
    			t = text(t_value);
    			add_location(div, file$3, 112, 4, 2606);
    		},

    		m: function mount(target, anchor) {
    			insert(target, div, anchor);
    			append(div, t);
    		},

    		p: function update(changed, ctx) {
    			if ((changed.selectedCases) && t_value !== (t_value = path([ctx.caseIndex, 'name'], algInfo))) {
    				set_data(t, t_value);
    			}
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(div);
    			}
    		}
    	};
    }

    // (115:2) {#if R.length(times)}
    function create_if_block_1(ctx) {
    	var div, t0, t1_value = path([0, 'caseName'], ctx.times), t1, t2, dispose;

    	return {
    		c: function create() {
    			div = element("div");
    			t0 = text("Unselect last case : (");
    			t1 = text(t1_value);
    			t2 = text(")");
    			add_location(div, file$3, 115, 4, 2694);
    			dispose = listen(div, "click", ctx.removeCase);
    		},

    		m: function mount(target, anchor) {
    			insert(target, div, anchor);
    			append(div, t0);
    			append(div, t1);
    			append(div, t2);
    		},

    		p: function update(changed, ctx) {
    			if ((changed.times) && t1_value !== (t1_value = path([0, 'caseName'], ctx.times))) {
    				set_data(t1, t1_value);
    			}
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(div);
    			}

    			dispose();
    		}
    	};
    }

    // (123:2) {#if R.length(times)}
    function create_if_block$2(ctx) {
    	var div3, h4, t1, div0, t2_value = path([0, 'caseName'], ctx.times), t2, t3, t4_value = path([0, 'time'], ctx.times), t4, t5, div1, t6_value = path([0, 'scramble'], ctx.times), t6, t7, div2, raw_value = ctx.getImage(ctx.colorScheme, path([path([0, 'caseIndex'], ctx.times), 'state'], algInfo));

    	return {
    		c: function create() {
    			div3 = element("div");
    			h4 = element("h4");
    			h4.textContent = "Last case:";
    			t1 = space();
    			div0 = element("div");
    			t2 = text(t2_value);
    			t3 = text(": ");
    			t4 = text(t4_value);
    			t5 = space();
    			div1 = element("div");
    			t6 = text(t6_value);
    			t7 = space();
    			div2 = element("div");
    			add_location(h4, file$3, 124, 6, 2888);
    			add_location(div0, file$3, 125, 6, 2914);
    			add_location(div1, file$3, 126, 6, 2994);
    			add_location(div2, file$3, 127, 6, 3044);
    			div3.className = "last-case svelte-1ffpj4h";
    			add_location(div3, file$3, 123, 4, 2858);
    		},

    		m: function mount(target, anchor) {
    			insert(target, div3, anchor);
    			append(div3, h4);
    			append(div3, t1);
    			append(div3, div0);
    			append(div0, t2);
    			append(div0, t3);
    			append(div0, t4);
    			append(div3, t5);
    			append(div3, div1);
    			append(div1, t6);
    			append(div3, t7);
    			append(div3, div2);
    			div2.innerHTML = raw_value;
    		},

    		p: function update(changed, ctx) {
    			if ((changed.times) && t2_value !== (t2_value = path([0, 'caseName'], ctx.times))) {
    				set_data(t2, t2_value);
    			}

    			if ((changed.times) && t4_value !== (t4_value = path([0, 'time'], ctx.times))) {
    				set_data(t4, t4_value);
    			}

    			if ((changed.times) && t6_value !== (t6_value = path([0, 'scramble'], ctx.times))) {
    				set_data(t6, t6_value);
    			}

    			if ((changed.colorScheme || changed.times) && raw_value !== (raw_value = ctx.getImage(ctx.colorScheme, path([path([0, 'caseIndex'], ctx.times), 'state'], algInfo)))) {
    				div2.innerHTML = raw_value;
    			}
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(div3);
    			}
    		}
    	};
    }

    // (136:4) {#each times as time}
    function create_each_block$1(ctx) {
    	var t0_value = path(['caseName'], ctx.time), t0, t1, t2_value = path(['time'], ctx.time), t2, t3, br;

    	return {
    		c: function create() {
    			t0 = text(t0_value);
    			t1 = text(": ");
    			t2 = text(t2_value);
    			t3 = space();
    			br = element("br");
    			add_location(br, file$3, 137, 6, 3314);
    		},

    		m: function mount(target, anchor) {
    			insert(target, t0, anchor);
    			insert(target, t1, anchor);
    			insert(target, t2, anchor);
    			insert(target, t3, anchor);
    			insert(target, br, anchor);
    		},

    		p: function update(changed, ctx) {
    			if ((changed.times) && t0_value !== (t0_value = path(['caseName'], ctx.time))) {
    				set_data(t0, t0_value);
    			}

    			if ((changed.times) && t2_value !== (t2_value = path(['time'], ctx.time))) {
    				set_data(t2, t2_value);
    			}
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(t0);
    				detach(t1);
    				detach(t2);
    				detach(t3);
    				detach(br);
    			}
    		}
    	};
    }

    function create_fragment$3(ctx) {
    	var updating_value, t0, div3, div0, t1, t2, updating_value_1, t3, div1, t4, t5_value = length(ctx.selectedCases), t5, t6, t7, t8, br0, t9, br1, t10, br2, t11, t12, br3, t13, br4, t14, div2, current;

    	function header_value_binding(value_1) {
    		ctx.header_value_binding.call(null, value_1);
    		updating_value = true;
    		add_flush_callback(() => updating_value = false);
    	}

    	let header_props = {
    		train: false,
    		selection: true
    	};
    	if (ctx.value !== void 0) {
    		header_props.value = ctx.value;
    	}
    	var header = new Header({ props: header_props, $$inline: true });

    	add_binding_callback(() => bind(header, 'value', header_value_binding));
    	header.$on("viewUpdate", ctx.changeMode);

    	function timer_value_binding(value_2) {
    		ctx.timer_value_binding.call(null, value_2);
    		updating_value_1 = true;
    		add_flush_callback(() => updating_value_1 = false);
    	}

    	let timer_props = {};
    	if (ctx.value !== void 0) {
    		timer_props.value = ctx.value;
    	}
    	var timer = new Timer({ props: timer_props, $$inline: true });

    	add_binding_callback(() => bind(timer, 'value', timer_value_binding));
    	timer.$on("newTime", ctx.newTime_handler);

    	var each_value_1 = ctx.selectedCases;

    	var each_blocks_1 = [];

    	for (var i = 0; i < each_value_1.length; i += 1) {
    		each_blocks_1[i] = create_each_block_1$1(get_each_context_1$1(ctx, each_value_1, i));
    	}

    	var if_block0 = (length(ctx.times)) && create_if_block_1(ctx);

    	var if_block1 = (length(ctx.times)) && create_if_block$2(ctx);

    	var each_value = ctx.times;

    	var each_blocks = [];

    	for (var i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
    	}

    	return {
    		c: function create() {
    			header.$$.fragment.c();
    			t0 = space();
    			div3 = element("div");
    			div0 = element("div");
    			t1 = text(ctx.scramble);
    			t2 = space();
    			timer.$$.fragment.c();
    			t3 = space();
    			div1 = element("div");
    			t4 = text("Selected Cases : ");
    			t5 = text(t5_value);
    			t6 = space();

    			for (var i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].c();
    			}

    			t7 = space();
    			if (if_block0) if_block0.c();
    			t8 = space();
    			br0 = element("br");
    			t9 = space();
    			br1 = element("br");
    			t10 = space();
    			br2 = element("br");
    			t11 = space();
    			if (if_block1) if_block1.c();
    			t12 = space();
    			br3 = element("br");
    			t13 = space();
    			br4 = element("br");
    			t14 = space();
    			div2 = element("div");

    			for (var i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}
    			div0.className = "scramble svelte-1ffpj4h";
    			set_style(div0, "font-size", "" + ctx.scrambleSize + "px");
    			add_location(div0, file$3, 101, 2, 2257);
    			add_location(div1, file$3, 110, 2, 2511);
    			add_location(br0, file$3, 119, 2, 2805);
    			add_location(br1, file$3, 120, 2, 2814);
    			add_location(br2, file$3, 121, 2, 2823);
    			add_location(br3, file$3, 132, 2, 3183);
    			add_location(br4, file$3, 133, 2, 3192);
    			div2.className = "times";
    			add_location(div2, file$3, 134, 2, 3201);
    			div3.className = "mn svelte-1ffpj4h";
    			add_location(div3, file$3, 100, 0, 2238);
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			mount_component(header, target, anchor);
    			insert(target, t0, anchor);
    			insert(target, div3, anchor);
    			append(div3, div0);
    			append(div0, t1);
    			append(div3, t2);
    			mount_component(timer, div3, null);
    			append(div3, t3);
    			append(div3, div1);
    			append(div1, t4);
    			append(div1, t5);
    			append(div3, t6);

    			for (var i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].m(div3, null);
    			}

    			append(div3, t7);
    			if (if_block0) if_block0.m(div3, null);
    			append(div3, t8);
    			append(div3, br0);
    			append(div3, t9);
    			append(div3, br1);
    			append(div3, t10);
    			append(div3, br2);
    			append(div3, t11);
    			if (if_block1) if_block1.m(div3, null);
    			append(div3, t12);
    			append(div3, br3);
    			append(div3, t13);
    			append(div3, br4);
    			append(div3, t14);
    			append(div3, div2);

    			for (var i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div2, null);
    			}

    			current = true;
    		},

    		p: function update(changed, ctx) {
    			var header_changes = {};
    			if (!updating_value && changed.value) {
    				header_changes.value = ctx.value;
    			}
    			header.$set(header_changes);

    			if (!current || changed.scramble) {
    				set_data(t1, ctx.scramble);
    			}

    			if (!current || changed.scrambleSize) {
    				set_style(div0, "font-size", "" + ctx.scrambleSize + "px");
    			}

    			var timer_changes = {};
    			if (!updating_value_1 && changed.value) {
    				timer_changes.value = ctx.value;
    			}
    			timer.$set(timer_changes);

    			if ((!current || changed.selectedCases) && t5_value !== (t5_value = length(ctx.selectedCases))) {
    				set_data(t5, t5_value);
    			}

    			if (changed.R || changed.selectedCases || changed.algInfo) {
    				each_value_1 = ctx.selectedCases;

    				for (var i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1$1(ctx, each_value_1, i);

    					if (each_blocks_1[i]) {
    						each_blocks_1[i].p(changed, child_ctx);
    					} else {
    						each_blocks_1[i] = create_each_block_1$1(child_ctx);
    						each_blocks_1[i].c();
    						each_blocks_1[i].m(div3, t7);
    					}
    				}

    				for (; i < each_blocks_1.length; i += 1) {
    					each_blocks_1[i].d(1);
    				}
    				each_blocks_1.length = each_value_1.length;
    			}

    			if (length(ctx.times)) {
    				if (if_block0) {
    					if_block0.p(changed, ctx);
    				} else {
    					if_block0 = create_if_block_1(ctx);
    					if_block0.c();
    					if_block0.m(div3, t8);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (length(ctx.times)) {
    				if (if_block1) {
    					if_block1.p(changed, ctx);
    				} else {
    					if_block1 = create_if_block$2(ctx);
    					if_block1.c();
    					if_block1.m(div3, t12);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (changed.R || changed.times) {
    				each_value = ctx.times;

    				for (var i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$1(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(changed, child_ctx);
    					} else {
    						each_blocks[i] = create_each_block$1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div2, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}
    				each_blocks.length = each_value.length;
    			}
    		},

    		i: function intro(local) {
    			if (current) return;
    			header.$$.fragment.i(local);

    			timer.$$.fragment.i(local);

    			current = true;
    		},

    		o: function outro(local) {
    			header.$$.fragment.o(local);
    			timer.$$.fragment.o(local);
    			current = false;
    		},

    		d: function destroy(detaching) {
    			header.$destroy(detaching);

    			if (detaching) {
    				detach(t0);
    				detach(div3);
    			}

    			timer.$destroy();

    			destroy_each(each_blocks_1, detaching);

    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();

    			destroy_each(each_blocks, detaching);
    		}
    	};
    }

    function instance$3($$self, $$props, $$invalidate) {
    	

      const dispatch = createEventDispatcher();
      const changeMode = event =>
        dispatch('viewUpdate', {
          mode: path(['detail', 'mode'], event),
          selectedCases: selectedCases || [],
        });

      let { selectedCases, value } = $$props;

      const getImage = (cs, state) =>
        drawMegaminxLL(cs, state || repeat(0, 27), 80);

      let currentCase;
      let times = [];
      const auf = ['', 'U', 'U2', "U'", "U2'"];
      const randomItem = array =>
        path([Math.floor(Math.random() * array.length)], array);

      const updateTimesArray = time =>
        prepend(
          {
            time,
            scramble,
            caseName,
            caseIndex: currentCase,
          },
          times
        );

      const getScrambleCase = () => { const $$result = [
        join(' ', [
          randomItem(auf),
          randomItem(
            path([(currentCase = randomItem(selectedCases))], megaPllMap)
          ),
          randomItem(auf),
        ]),
        path([currentCase, 'name'], algInfo),
      ]; return $$result; };

      const removeCase = () => {
        $$invalidate('selectedCases', selectedCases = without([path([0, 'caseIndex'], times)], selectedCases));
        if (equals(0, length(selectedCases))) {
          changeMode({ detail: { mode: 0 } });
        } else {
          [scramble, caseName] = getScrambleCase(); $$invalidate('scramble', scramble); $$invalidate('caseName', caseName);
        }
      };

      let [scramble, caseName] = getScrambleCase();

    	const writable_props = ['selectedCases', 'value'];
    	Object.keys($$props).forEach(key => {
    		if (!writable_props.includes(key) && !key.startsWith('$$')) console.warn(`<Train> was created with unknown prop '${key}'`);
    	});

    	function header_value_binding(value_1) {
    		value = value_1;
    		$$invalidate('value', value);
    	}

    	function timer_value_binding(value_2) {
    		value = value_2;
    		$$invalidate('value', value);
    	}

    	function newTime_handler(event) {
    	      times = updateTimesArray(path(['detail', 'time'], event)); $$invalidate('times', times);
    	      [scramble, caseName] = getScrambleCase(); $$invalidate('scramble', scramble); $$invalidate('caseName', caseName);
    	    }

    	$$self.$set = $$props => {
    		if ('selectedCases' in $$props) $$invalidate('selectedCases', selectedCases = $$props.selectedCases);
    		if ('value' in $$props) $$invalidate('value', value = $$props.value);
    	};

    	let scrambleSize, colorScheme;

    	$$self.$$.update = ($$dirty = { value: 1 }) => {
    		if ($$dirty.value) { $$invalidate('scrambleSize', scrambleSize = nth(1, value) || 30); }
    		if ($$dirty.value) { $$invalidate('colorScheme', colorScheme = nth(2, value)); }
    	};

    	return {
    		changeMode,
    		selectedCases,
    		value,
    		getImage,
    		times,
    		updateTimesArray,
    		getScrambleCase,
    		removeCase,
    		scramble,
    		caseName,
    		scrambleSize,
    		colorScheme,
    		header_value_binding,
    		timer_value_binding,
    		newTime_handler
    	};
    }

    class Train extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, ["selectedCases", "value"]);

    		const { ctx } = this.$$;
    		const props = options.props || {};
    		if (ctx.selectedCases === undefined && !('selectedCases' in props)) {
    			console.warn("<Train> was created without expected prop 'selectedCases'");
    		}
    		if (ctx.value === undefined && !('value' in props)) {
    			console.warn("<Train> was created without expected prop 'value'");
    		}
    	}

    	get selectedCases() {
    		throw new Error("<Train>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set selectedCases(value) {
    		throw new Error("<Train>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get value() {
    		throw new Error("<Train>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set value(value) {
    		throw new Error("<Train>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/Components/Selection.svelte generated by Svelte v3.4.4 */

    const file$4 = "src/Components/Selection.svelte";

    function get_each_context_1$2(ctx, list, i) {
    	const child_ctx = Object.create(ctx);
    	child_ctx.index = list[i];
    	return child_ctx;
    }

    function get_each_context$2(ctx, list, i) {
    	const child_ctx = Object.create(ctx);
    	child_ctx.name = list[i].name;
    	child_ctx.cases = list[i].cases;
    	child_ctx.i = i;
    	return child_ctx;
    }

    // (104:6) {#if R.includes(index, [8, 23, 34, 42, 53, 68, 76])}
    function create_if_block$3(ctx) {
    	var tr;

    	return {
    		c: function create() {
    			tr = element("tr");
    			add_location(tr, file$4, 104, 8, 2380);
    		},

    		m: function mount(target, anchor) {
    			insert(target, tr, anchor);
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(tr);
    			}
    		}
    	};
    }

    // (103:4) {#each cases as index}
    function create_each_block_1$2(ctx) {
    	var t0, td, raw_value = ctx.getImage(ctx.colorScheme, path([ctx.index, 'state'], algInfo)), raw_after, t1, br, t2, t3_value = path([ctx.index, 'name'], algInfo), t3, t4, td_class_value, dispose;

    	var if_block = (includes(ctx.index, [8, 23, 34, 42, 53, 68, 76])) && create_if_block$3();

    	function click_handler_1() {
    		return ctx.click_handler_1(ctx);
    	}

    	return {
    		c: function create() {
    			if (if_block) if_block.c();
    			t0 = space();
    			td = element("td");
    			raw_after = element('noscript');
    			t1 = space();
    			br = element("br");
    			t2 = space();
    			t3 = text(t3_value);
    			t4 = space();
    			add_location(br, file$4, 110, 8, 2608);
    			td.className = td_class_value = "" + (includes(ctx.index, ctx.selectedCases) ? 'selected' : 'notSelected') + " svelte-63lf37";
    			add_location(td, file$4, 106, 6, 2405);
    			dispose = listen(td, "click", click_handler_1);
    		},

    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert(target, t0, anchor);
    			insert(target, td, anchor);
    			append(td, raw_after);
    			raw_after.insertAdjacentHTML("beforebegin", raw_value);
    			append(td, t1);
    			append(td, br);
    			append(td, t2);
    			append(td, t3);
    			append(td, t4);
    		},

    		p: function update(changed, new_ctx) {
    			ctx = new_ctx;
    			if (includes(ctx.index, [8, 23, 34, 42, 53, 68, 76])) {
    				if (!if_block) {
    					if_block = create_if_block$3();
    					if_block.c();
    					if_block.m(t0.parentNode, t0);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}

    			if ((changed.colorScheme) && raw_value !== (raw_value = ctx.getImage(ctx.colorScheme, path([ctx.index, 'state'], algInfo)))) {
    				detach_before(raw_after);
    				raw_after.insertAdjacentHTML("beforebegin", raw_value);
    			}

    			if ((changed.selectedCases) && td_class_value !== (td_class_value = "" + (includes(ctx.index, ctx.selectedCases) ? 'selected' : 'notSelected') + " svelte-63lf37")) {
    				td.className = td_class_value;
    			}
    		},

    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);

    			if (detaching) {
    				detach(t0);
    				detach(td);
    			}

    			dispose();
    		}
    	};
    }

    // (99:2) {#each algGroup as { name, cases }
    function create_each_block$2(ctx) {
    	var tr0, t0, th, t1_value = ctx.name, t1, t2, tr1, t3, each_1_anchor, dispose;

    	function click_handler() {
    		return ctx.click_handler(ctx);
    	}

    	var each_value_1 = ctx.cases;

    	var each_blocks = [];

    	for (var i_1 = 0; i_1 < each_value_1.length; i_1 += 1) {
    		each_blocks[i_1] = create_each_block_1$2(get_each_context_1$2(ctx, each_value_1, i_1));
    	}

    	return {
    		c: function create() {
    			tr0 = element("tr");
    			t0 = space();
    			th = element("th");
    			t1 = text(t1_value);
    			t2 = space();
    			tr1 = element("tr");
    			t3 = space();

    			for (var i_1 = 0; i_1 < each_blocks.length; i_1 += 1) {
    				each_blocks[i_1].c();
    			}

    			each_1_anchor = empty();
    			add_location(tr0, file$4, 99, 4, 2204);
    			th.colSpan = "8";
    			th.className = "svelte-63lf37";
    			add_location(th, file$4, 100, 4, 2215);
    			add_location(tr1, file$4, 101, 4, 2279);
    			dispose = listen(th, "click", click_handler);
    		},

    		m: function mount(target, anchor) {
    			insert(target, tr0, anchor);
    			insert(target, t0, anchor);
    			insert(target, th, anchor);
    			append(th, t1);
    			insert(target, t2, anchor);
    			insert(target, tr1, anchor);
    			insert(target, t3, anchor);

    			for (var i_1 = 0; i_1 < each_blocks.length; i_1 += 1) {
    				each_blocks[i_1].m(target, anchor);
    			}

    			insert(target, each_1_anchor, anchor);
    		},

    		p: function update(changed, new_ctx) {
    			ctx = new_ctx;
    			if (changed.R || changed.algGroup || changed.selectedCases || changed.algInfo || changed.getImage || changed.colorScheme) {
    				each_value_1 = ctx.cases;

    				for (var i_1 = 0; i_1 < each_value_1.length; i_1 += 1) {
    					const child_ctx = get_each_context_1$2(ctx, each_value_1, i_1);

    					if (each_blocks[i_1]) {
    						each_blocks[i_1].p(changed, child_ctx);
    					} else {
    						each_blocks[i_1] = create_each_block_1$2(child_ctx);
    						each_blocks[i_1].c();
    						each_blocks[i_1].m(each_1_anchor.parentNode, each_1_anchor);
    					}
    				}

    				for (; i_1 < each_blocks.length; i_1 += 1) {
    					each_blocks[i_1].d(1);
    				}
    				each_blocks.length = each_value_1.length;
    			}
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(tr0);
    				detach(t0);
    				detach(th);
    				detach(t2);
    				detach(tr1);
    				detach(t3);
    			}

    			destroy_each(each_blocks, detaching);

    			if (detaching) {
    				detach(each_1_anchor);
    			}

    			dispose();
    		}
    	};
    }

    function create_fragment$4(ctx) {
    	var updating_value, t0, table, th, t1, t2_value = length(algInfo), t2, t3, t4_value = length(ctx.selectedCases), t4, t5, current, dispose;

    	function header_value_binding(value_1) {
    		ctx.header_value_binding.call(null, value_1);
    		updating_value = true;
    		add_flush_callback(() => updating_value = false);
    	}

    	let header_props = {
    		train: length(ctx.selectedCases),
    		selection: false
    	};
    	if (ctx.value !== void 0) {
    		header_props.value = ctx.value;
    	}
    	var header = new Header({ props: header_props, $$inline: true });

    	add_binding_callback(() => bind(header, 'value', header_value_binding));
    	header.$on("viewUpdate", ctx.changeMode);

    	var each_value = algGroup;

    	var each_blocks = [];

    	for (var i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$2(get_each_context$2(ctx, each_value, i));
    	}

    	return {
    		c: function create() {
    			header.$$.fragment.c();
    			t0 = space();
    			table = element("table");
    			th = element("th");
    			t1 = text("All Cases: ");
    			t2 = text(t2_value);
    			t3 = text(", Selected: ");
    			t4 = text(t4_value);
    			t5 = space();

    			for (var i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}
    			th.colSpan = "8";
    			th.className = "svelte-63lf37";
    			add_location(th, file$4, 94, 2, 2036);
    			table.className = "svelte-63lf37";
    			add_location(table, file$4, 93, 0, 2026);
    			dispose = listen(th, "click", ctx.selectAllNone);
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			mount_component(header, target, anchor);
    			insert(target, t0, anchor);
    			insert(target, table, anchor);
    			append(table, th);
    			append(th, t1);
    			append(th, t2);
    			append(th, t3);
    			append(th, t4);
    			append(table, t5);

    			for (var i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(table, null);
    			}

    			current = true;
    		},

    		p: function update(changed, ctx) {
    			var header_changes = {};
    			if (changed.R || changed.selectedCases) header_changes.train = length(ctx.selectedCases);
    			if (!updating_value && changed.value) {
    				header_changes.value = ctx.value;
    			}
    			header.$set(header_changes);

    			if ((!current || changed.selectedCases) && t4_value !== (t4_value = length(ctx.selectedCases))) {
    				set_data(t4, t4_value);
    			}

    			if (changed.algGroup || changed.R || changed.selectedCases || changed.algInfo || changed.getImage || changed.colorScheme) {
    				each_value = algGroup;

    				for (var i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$2(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(changed, child_ctx);
    					} else {
    						each_blocks[i] = create_each_block$2(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(table, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}
    				each_blocks.length = each_value.length;
    			}
    		},

    		i: function intro(local) {
    			if (current) return;
    			header.$$.fragment.i(local);

    			current = true;
    		},

    		o: function outro(local) {
    			header.$$.fragment.o(local);
    			current = false;
    		},

    		d: function destroy(detaching) {
    			header.$destroy(detaching);

    			if (detaching) {
    				detach(t0);
    				detach(table);
    			}

    			destroy_each(each_blocks, detaching);

    			dispose();
    		}
    	};
    }

    function instance$4($$self, $$props, $$invalidate) {
    	

      const dispatch = createEventDispatcher();

      let { selectedCases, value } = $$props;

      const changeMode = event =>
        dispatch('viewUpdate', {
          mode: path(['detail', 'mode'], event),
          selectedCases,
        });

      const getImage = (cs, state) =>
        drawMegaminxLL(cs, state || repeat(0, 27), 100);

      const selectAllNone = () =>
        { const $$result = equals(0, length(selectedCases))
          ? (selectedCases = range(0, length(algInfo)))
          : (selectedCases = []); $$invalidate('selectedCases', selectedCases); return $$result; };

      const selectGroup = i => {
        const groupCases = path([i, 'cases'], algGroup);

        if (equals(difference(selectedCases, groupCases), selectedCases)) {
          $$invalidate('selectedCases', selectedCases = concat(groupCases, selectedCases));
        } else {
          $$invalidate('selectedCases', selectedCases = without(groupCases, selectedCases));
        }
      };

      const select = i =>
        { const $$result = includes(i, selectedCases)
          ? (selectedCases = without([i], selectedCases))
          : (selectedCases = append$1(i, selectedCases)); $$invalidate('selectedCases', selectedCases); return $$result; };

    	const writable_props = ['selectedCases', 'value'];
    	Object.keys($$props).forEach(key => {
    		if (!writable_props.includes(key) && !key.startsWith('$$')) console.warn(`<Selection> was created with unknown prop '${key}'`);
    	});

    	function header_value_binding(value_1) {
    		value = value_1;
    		$$invalidate('value', value);
    	}

    	function click_handler({ i }) {
    		return selectGroup(i);
    	}

    	function click_handler_1({ index }) {
    		return select(index);
    	}

    	$$self.$set = $$props => {
    		if ('selectedCases' in $$props) $$invalidate('selectedCases', selectedCases = $$props.selectedCases);
    		if ('value' in $$props) $$invalidate('value', value = $$props.value);
    	};

    	let colorScheme;

    	$$self.$$.update = ($$dirty = { value: 1 }) => {
    		if ($$dirty.value) { $$invalidate('colorScheme', colorScheme = nth(2, value)); }
    	};

    	return {
    		selectedCases,
    		value,
    		changeMode,
    		getImage,
    		selectAllNone,
    		selectGroup,
    		select,
    		colorScheme,
    		header_value_binding,
    		click_handler,
    		click_handler_1
    	};
    }

    class Selection extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, ["selectedCases", "value"]);

    		const { ctx } = this.$$;
    		const props = options.props || {};
    		if (ctx.selectedCases === undefined && !('selectedCases' in props)) {
    			console.warn("<Selection> was created without expected prop 'selectedCases'");
    		}
    		if (ctx.value === undefined && !('value' in props)) {
    			console.warn("<Selection> was created without expected prop 'value'");
    		}
    	}

    	get selectedCases() {
    		throw new Error("<Selection>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set selectedCases(value) {
    		throw new Error("<Selection>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get value() {
    		throw new Error("<Selection>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set value(value) {
    		throw new Error("<Selection>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/App.svelte generated by Svelte v3.4.4 */

    function create_fragment$5(ctx) {
    	var updating_value, switch_instance_anchor, current;

    	function switch_instance_value_binding(value_1) {
    		ctx.switch_instance_value_binding.call(null, value_1);
    		updating_value = true;
    		add_flush_callback(() => updating_value = false);
    	}

    	var switch_value = ctx.mode[ctx.viewMode];

    	function switch_props(ctx) {
    		let switch_instance_props = { selectedCases: ctx.selectedCases };
    		if (ctx.value !== void 0) {
    			switch_instance_props.value = ctx.value;
    		}
    		return {
    			props: switch_instance_props,
    			$$inline: true
    		};
    	}

    	if (switch_value) {
    		var switch_instance = new switch_value(switch_props(ctx));

    		add_binding_callback(() => bind(switch_instance, 'value', switch_instance_value_binding));
    		switch_instance.$on("viewUpdate", ctx.handleView);
    	}

    	return {
    		c: function create() {
    			if (switch_instance) switch_instance.$$.fragment.c();
    			switch_instance_anchor = empty();
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			if (switch_instance) {
    				mount_component(switch_instance, target, anchor);
    			}

    			insert(target, switch_instance_anchor, anchor);
    			current = true;
    		},

    		p: function update(changed, ctx) {
    			var switch_instance_changes = {};
    			if (changed.selectedCases) switch_instance_changes.selectedCases = ctx.selectedCases;
    			if (!updating_value && changed.value) {
    				switch_instance_changes.value = ctx.value;
    			}

    			if (switch_value !== (switch_value = ctx.mode[ctx.viewMode])) {
    				if (switch_instance) {
    					group_outros();
    					const old_component = switch_instance;
    					on_outro(() => {
    						old_component.$destroy();
    					});
    					old_component.$$.fragment.o(1);
    					check_outros();
    				}

    				if (switch_value) {
    					switch_instance = new switch_value(switch_props(ctx));

    					add_binding_callback(() => bind(switch_instance, 'value', switch_instance_value_binding));
    					switch_instance.$on("viewUpdate", ctx.handleView);

    					switch_instance.$$.fragment.c();
    					switch_instance.$$.fragment.i(1);
    					mount_component(switch_instance, switch_instance_anchor.parentNode, switch_instance_anchor);
    				} else {
    					switch_instance = null;
    				}
    			}

    			else if (switch_value) {
    				switch_instance.$set(switch_instance_changes);
    			}
    		},

    		i: function intro(local) {
    			if (current) return;
    			if (switch_instance) switch_instance.$$.fragment.i(local);

    			current = true;
    		},

    		o: function outro(local) {
    			if (switch_instance) switch_instance.$$.fragment.o(local);
    			current = false;
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(switch_instance_anchor);
    			}

    			if (switch_instance) switch_instance.$destroy(detaching);
    		}
    	};
    }

    function instance$5($$self, $$props, $$invalidate) {
    	

      document.title = 'Megaminx PLL Trainer';
      let selectedCases = [];
      const handleView = event => {
        $$invalidate('viewMode', viewMode = path(['detail', 'mode'], event));
        $$invalidate('selectedCases', selectedCases = path(['detail', 'selectedCases'], event));
      };

      let viewMode = 0;
      const mode = [Selection, Train];

      let value = [
        50,
        30,
        {
          U: 'Black',
          R: 'Grey',
          F: 'Yellow',
          L: 'Orange',
          Bl: 'LightBlue',
          Br: 'Green',
        },
      ];

    	function switch_instance_value_binding(value_1) {
    		value = value_1;
    		$$invalidate('value', value);
    	}

    	return {
    		selectedCases,
    		handleView,
    		viewMode,
    		mode,
    		value,
    		switch_instance_value_binding
    	};
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$5, create_fragment$5, safe_not_equal, []);
    	}
    }

    const app = new App({
      target: document.body,
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
